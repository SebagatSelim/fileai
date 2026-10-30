"""Document processing pipeline (FR-08 – FR-10, UC-04 – UC-08).

Upload returns straight away; this module does the slow work in a background thread:
read file -> extract text / OCR -> AI analysis -> embedding -> duplicate check -> AWAITING_REVIEW.
"""
import logging
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

from flask import current_app

from ..extensions import db
from ..models import DocumentEmbedding, DocumentKeyword, DocumentMetadata, File, utcnow
from .ai import get_analyzer, get_embedder
from .ai.embeddings import build_embedding_text
from .extraction import ExtractionError, extract_text
from .folders import align_with_existing, clean_segments, folder_paths, path_string
from .index import bump
from .search import find_similar
from .storage import get_storage
from .validation import CANONICAL_EXTENSION

log = logging.getLogger(__name__)

_running: set[int] = set()
_running_lock = threading.Lock()


def init_pipeline(app) -> None:
    if app.config["PROCESSING_MODE"] == "thread":
        app.extensions["pipeline_executor"] = ThreadPoolExecutor(
            max_workers=app.config["PROCESSING_WORKERS"], thread_name_prefix="doc-pipeline"
        )


def submit(file_id: int) -> None:
    """Queue a document for processing (or process it now in sync mode, used by tests)."""
    app = current_app._get_current_object()
    if app.config["PROCESSING_MODE"] == "sync":
        process_document(file_id)
        return
    with _running_lock:
        if file_id in _running:
            return
        _running.add(file_id)
    app.extensions["pipeline_executor"].submit(_run_in_context, app, file_id)


def is_running(file_id: int) -> bool:
    return file_id in _running


def _run_in_context(app, file_id: int) -> None:
    try:
        with app.app_context():
            process_document(file_id)
    except Exception:
        log.exception("Pipeline crashed for file %s", file_id)
    finally:
        with _running_lock:
            _running.discard(file_id)


def requeue_stuck_jobs() -> int:
    """Restart documents left half-processed by a crash or restart (NFR-04: recover within 60 s)."""
    cutoff = utcnow() - timedelta(seconds=current_app.config["STUCK_JOB_SECONDS"])
    stuck = File.query.filter(File.status.in_(("UPLOADED", "PROCESSING")), File.updated_at < cutoff).all()
    count = 0
    for file in stuck:
        if not is_running(file.file_id):
            submit(file.file_id)
            count += 1
    if count:
        log.info("Re-queued %s stuck document(s)", count)
    return count


def set_keywords(file: File, keywords: list[str]) -> None:
    """Replace a file's keywords, keeping their order and ignoring case-only duplicates."""
    unique: list[str] = []
    seen: set[str] = set()
    for keyword in keywords:
        keyword = str(keyword).strip()[:100]
        if keyword and keyword.lower() not in seen:
            seen.add(keyword.lower())
            unique.append(keyword)
    existing = {kw.keyword.lower(): kw for kw in file.keywords}
    updated = []
    for position, keyword in enumerate(unique[:15]):
        obj = existing.pop(keyword.lower(), None) or DocumentKeyword(keyword=keyword)
        obj.keyword, obj.position = keyword, position
        updated.append(obj)
    file.keywords = updated


def refresh_embedding(file: File) -> list[float]:
    """(Re)compute the document's embedding from its current metadata and text."""
    meta = file.meta
    embedder = get_embedder()
    vector = embedder.embed(build_embedding_text(
        title=meta.title or "", summary=meta.summary or "", keywords=[k.keyword for k in file.keywords],
        category=meta.category or "", subject=meta.subject or "", document_type=meta.document_type or "",
        folder_path=path_string(file.folder) or (meta.suggested_folder_path or ""),
        filename=file.display_name, body=meta.extracted_text or "",
    ))
    if file.embedding is None:
        file.embedding = DocumentEmbedding(model_name=embedder.name, dimensions=len(vector), embedding=vector)
    else:
        file.embedding.model_name, file.embedding.dimensions, file.embedding.embedding = embedder.name, len(vector), vector
        file.embedding.created_at = utcnow()
    return vector


def process_document(file_id: int) -> None:
    file = db.session.get(File, file_id)
    if file is None:
        return
    user_id = file.user_id
    file.status, file.error_message, file.updated_at = "PROCESSING", None, utcnow()
    db.session.commit()
    try:
        data = get_storage().read(file.storage_key)
        text, method = extract_text(data, file.file_type)

        existing = list(folder_paths(file.user_id).values())
        result = get_analyzer().analyze(text, file.original_name, existing, CANONICAL_EXTENSION[file.file_type])
        folder = align_with_existing(clean_segments(result.suggested_folder_path), existing) or ["Other"]

        meta = file.meta or DocumentMetadata()
        file.meta = meta
        meta.title, meta.summary = result.title, result.summary
        meta.category, meta.subject, meta.document_type = result.category, result.subject, result.document_type
        meta.suggested_filename, meta.suggested_folder_path = result.suggested_filename, "/".join(folder)
        meta.classification_confidence = result.confidence
        meta.extracted_text, meta.extraction_method, meta.ai_model = text, method, result.model
        meta.is_user_approved, meta.approved_at = False, None
        set_keywords(file, result.keywords)
        vector = refresh_embedding(file)

        _record_duplicates(file, meta, vector)
        file.status, file.updated_at = "AWAITING_REVIEW", utcnow()
        db.session.commit()
    except ExtractionError as exc:
        _fail(file_id, str(exc))
    except Exception:
        log.exception("Processing failed for file %s", file_id)
        _fail(file_id, "Processing failed unexpectedly. Please retry.")
    finally:
        bump(user_id)


def _record_duplicates(file: File, meta: DocumentMetadata, vector: list[float]) -> None:
    exact = (
        File.query.filter(File.user_id == file.user_id, File.hash_value == file.hash_value,
                          File.file_id != file.file_id, File.status.in_(("AWAITING_REVIEW", "STORED")))
        .order_by(File.file_id).first()
    )
    if exact:
        meta.duplicate_of_file_id, meta.duplicate_type, meta.duplicate_score = exact.file_id, "EXACT", 1
        return
    similar = find_similar(file.user_id, vector, get_embedder().name, file.file_id,
                           current_app.config["SIMILARITY_THRESHOLD"], limit=1)
    if similar:
        meta.duplicate_of_file_id, meta.duplicate_type, meta.duplicate_score = similar[0][0], "SIMILAR", similar[0][1]
    else:
        meta.duplicate_of_file_id = meta.duplicate_type = meta.duplicate_score = None


def _fail(file_id: int, message: str) -> None:
    db.session.rollback()
    file = db.session.get(File, file_id)
    if file is not None:
        file.status, file.error_message, file.updated_at = "FAILED", message[:500], utcnow()
        db.session.commit()
