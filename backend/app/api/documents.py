"""Documents: upload, AI review, approve, browse, edit, download, delete (FR-02 – FR-08, UC-03 – UC-10)."""
import re
import uuid

import sqlalchemy as sa
from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import jwt_required

from ..errors import APIError, validation_error
from ..extensions import db
from ..models import AuditLog, DocumentMetadata, File, utcnow
from ..serializers import document_json, suggestions_json
from ..services import audit, pipeline
from ..services.folders import clean_segments, ensure_folder_path, folder_paths, path_string
from ..services.index import bump
from ..services.search import find_similar
from ..services.storage import get_storage
from ..services.validation import CANONICAL_EXTENSION, validate_upload
from .helpers import current_user_id, get_owned_file, json_body, optional_str

bp = Blueprint("documents", __name__)

SORTS = {"uploaded_at": File.uploaded_at, "name": sa.func.coalesce(File.generated_name, File.original_name)}
KNOWN_EXTENSIONS = {"pdf", "docx", "txt", "png", "jpg", "jpeg"}


def _storage_used(user_id: int) -> int:
    return int(db.session.scalar(
        sa.select(sa.func.coalesce(sa.func.sum(File.file_size_bytes), 0)).where(File.user_id == user_id)
    ))


def _similar_documents(file: File) -> list[dict]:
    if file.embedding is None:
        return []
    matches = find_similar(file.user_id, file.embedding.embedding, file.embedding.model_name, file.file_id,
                           current_app.config["SIMILARITY_THRESHOLD"], limit=5)
    if not matches:
        return []
    names = {f.file_id: f.display_name for f in File.query.filter(File.file_id.in_([m[0] for m in matches]))}
    return [{"file_id": fid, "name": names.get(fid), "similarity": score} for fid, score in matches]


def _clean_filename(name: str, file_type: str) -> str:
    """Remove characters that are illegal in filenames and force the real extension."""
    name = re.sub(r'[\\/:*?"<>|\x00-\x1f]+', "_", name).strip(" .")
    if "." in name and name.rsplit(".", 1)[1].lower() in KNOWN_EXTENSIONS:
        name = name.rsplit(".", 1)[0]
    name = name.strip(" .")[:240]
    if not name:
        raise validation_error("Filename cannot be empty.", {"filename": "Required"})
    return name + CANONICAL_EXTENSION[file_type]


def _apply_metadata(file: File, data: dict) -> list[str]:
    """Apply editable fields from approve/PATCH. Returns which kinds of change happened."""
    meta = file.meta or DocumentMetadata()
    file.meta = meta
    changes = []
    for key, limit in (("title", 255), ("category", 100), ("subject", 150), ("document_type", 100)):
        value = optional_str(data, key, limit)
        if value is not None:
            setattr(meta, key, value)
            changes.append("update")
    if "summary" in data:
        meta.summary = (optional_str(data, "summary", 5000) or None)
        changes.append("update")
    if "keywords" in data:
        keywords = data["keywords"]
        if not isinstance(keywords, list):
            raise validation_error("keywords must be a list.", {"keywords": "Must be a list"})
        pipeline.set_keywords(file, [str(k) for k in keywords])
        changes.append("update")
    if data.get("filename") is not None:
        file.generated_name = _clean_filename(str(data["filename"]), file.file_type)
        changes.append("update")
    if "folder_path" in data:
        segments = clean_segments(data["folder_path"])
        old = file.folder_id
        file.folder = ensure_folder_path(file.user_id, segments) if segments else None
        db.session.flush()
        if file.folder_id != old:
            changes.append("move")
    if changes:
        meta.updated_at = file.updated_at = utcnow()
    return changes


# ---------------------------------------------------------------- upload
@bp.post("/documents")
@jwt_required()
def upload():
    user_id = current_user_id()
    upload_file = request.files.get("file")
    if upload_file is None:
        raise validation_error("No file selected.", {"file": "Required"})
    data = upload_file.read()
    cfg = current_app.config
    checked = validate_upload(upload_file.filename, data, cfg["ALLOWED_EXTENSIONS"], cfg["MAX_UPLOAD_MB"])

    quota = cfg["STORAGE_QUOTA_MB"] * 1024 * 1024
    if _storage_used(user_id) + checked.size > quota:
        raise APIError(413, "STORAGE_QUOTA_EXCEEDED", "Your storage is full. Delete some documents and try again.")

    allow_duplicate = str(request.form.get("allow_duplicate", "false")).lower() in ("1", "true", "yes")
    if not allow_duplicate:
        existing = (File.query.filter(File.user_id == user_id, File.hash_value == checked.sha256,
                                      File.status != "FAILED").order_by(File.file_id).first())
        if existing:
            raise APIError(
                409, "DUPLICATE_FILE", f'You already have this file: "{existing.display_name}".',
                existing_file={"file_id": existing.file_id, "name": existing.display_name,
                               "folder_path": path_string(existing.folder), "status": existing.status},
            )

    key = f"users/{user_id}/{uuid.uuid4().hex}{checked.extension}"
    get_storage().save(key, data, checked.mime_type)
    file = File(
        user_id=user_id, original_name=checked.original_name, file_type=checked.file_type,
        mime_type=checked.mime_type, file_size_bytes=checked.size, hash_value=checked.sha256,
        storage_key=key, status="PROCESSING",
    )
    db.session.add(file)
    db.session.flush()
    audit.record(user_id, "UPLOAD", file.file_id, checked.original_name)
    db.session.commit()
    bump(user_id)

    pipeline.submit(file.file_id)
    db.session.refresh(file)
    return jsonify({"file_id": file.file_id, "status": file.status}), 202


# ---------------------------------------------------------------- AI review
@bp.get("/documents/<int:file_id>/analysis")
@jwt_required()
def analysis(file_id: int):
    file = get_owned_file(file_id)
    if file.status in ("UPLOADED", "PROCESSING") and not pipeline.is_running(file.file_id):
        # Worker died or the server restarted mid-way: resume (NFR-04).
        age = (utcnow() - file.updated_at).total_seconds()
        if age > current_app.config["STUCK_JOB_SECONDS"]:
            pipeline.submit(file.file_id)
            db.session.refresh(file)
    return jsonify({
        "file_id": file.file_id,
        "status": file.status,
        "original_name": file.original_name,
        "file_type": file.file_type,
        "suggestions": suggestions_json(file) if file.status in ("AWAITING_REVIEW", "STORED") else None,
        "similar_documents": _similar_documents(file) if file.status in ("AWAITING_REVIEW", "STORED") else [],
        "duplicate_of": document_json(file)["duplicate_of"],
        "error_message": file.error_message,
    })


@bp.post("/documents/<int:file_id>/approve")
@jwt_required()
def approve(file_id: int):
    file = get_owned_file(file_id)
    if file.status in ("UPLOADED", "PROCESSING"):
        raise APIError(409, "STILL_PROCESSING", "The document is still being analysed. Please wait a moment.")
    data = json_body()
    if not str(data.get("filename") or "").strip():
        raise validation_error("Filename is required.", {"filename": "Required"})
    if not clean_segments(data.get("folder_path")):
        raise validation_error("Please choose a folder.", {"folder_path": "Required"})
    _apply_metadata(file, data)
    meta = file.meta
    meta.is_user_approved, meta.approved_at = True, utcnow()
    file.status, file.error_message, file.updated_at = "STORED", None, utcnow()
    pipeline.refresh_embedding(file)
    audit.record(file.user_id, "APPROVE", file.file_id, file.display_name)
    db.session.commit()
    bump(file.user_id)
    return jsonify(document_json(file))


@bp.post("/documents/<int:file_id>/reprocess")
@jwt_required()
def reprocess(file_id: int):
    file = get_owned_file(file_id)
    if file.status == "PROCESSING" and pipeline.is_running(file.file_id):
        raise APIError(409, "STILL_PROCESSING", "The document is already being analysed.")
    file.status, file.error_message, file.updated_at = "PROCESSING", None, utcnow()
    db.session.commit()
    pipeline.submit(file.file_id)
    db.session.refresh(file)
    return jsonify({"file_id": file.file_id, "status": file.status}), 202


# ---------------------------------------------------------------- browse
@bp.get("/documents")
@jwt_required()
def list_documents():
    user_id = current_user_id()
    args = request.args
    query = File.query.filter(File.user_id == user_id)

    status = (args.get("status") or "STORED").upper()
    if status != "ALL":
        statuses = [s.strip() for s in status.split(",") if s.strip()]
        query = query.filter(File.status.in_(statuses))
    if args.get("folder_id"):
        try:
            query = query.filter(File.folder_id == int(args["folder_id"]))
        except ValueError:
            raise validation_error("folder_id must be a number.")
    if args.get("type"):
        query = query.filter(File.file_type == args["type"].upper())
    if args.get("category"):
        query = query.join(DocumentMetadata, DocumentMetadata.file_id == File.file_id).filter(
            DocumentMetadata.category == args["category"])

    sort_column = SORTS.get(args.get("sort", "uploaded_at"), File.uploaded_at)
    query = query.order_by(sort_column.asc() if args.get("order") == "asc" else sort_column.desc(), File.file_id.desc())

    try:
        page = max(int(args.get("page", 1)), 1)
        per_page = min(max(int(args.get("per_page", 20)), 1), 100)
    except ValueError:
        raise validation_error("page and per_page must be numbers.")
    total = query.order_by(None).count()
    items = query.offset((page - 1) * per_page).limit(per_page).all()
    paths = folder_paths(user_id)
    return jsonify({"items": [document_json(f, paths) for f in items], "page": page, "per_page": per_page, "total": total})


@bp.get("/documents/<int:file_id>")
@jwt_required()
def get_document(file_id: int):
    file = get_owned_file(file_id)
    data = document_json(file)
    data["text_preview"] = (file.meta.extracted_text or "")[:3000] if file.meta else ""
    data["similar_documents"] = _similar_documents(file)
    audit.record(file.user_id, "VIEW", file.file_id)
    db.session.commit()
    return jsonify(data)


@bp.patch("/documents/<int:file_id>")
@jwt_required()
def update_document(file_id: int):
    file = get_owned_file(file_id)
    data = json_body()
    changes = _apply_metadata(file, data)
    if changes:
        if file.meta.title is not None:
            pipeline.refresh_embedding(file)
        audit.record(file.user_id, "MOVE" if changes == ["move"] else "UPDATE", file.file_id, file.display_name)
    db.session.commit()
    bump(file.user_id)
    return jsonify(document_json(file))


# ---------------------------------------------------------------- download / delete
@bp.get("/documents/<int:file_id>/download")
@jwt_required()
def download(file_id: int):
    file = get_owned_file(file_id)
    inline = str(request.args.get("inline", "false")).lower() in ("1", "true", "yes")
    expires = current_app.config["DOWNLOAD_URL_EXPIRES_SEC"]
    url = get_storage().download_url(file.storage_key, file.display_name, file.mime_type, inline, expires)
    if not inline:
        audit.record(file.user_id, "DOWNLOAD", file.file_id, file.display_name)
        db.session.commit()
    return jsonify({"url": url, "expires_in": expires, "filename": file.display_name})


@bp.delete("/documents/<int:file_id>")
@jwt_required()
def delete_document(file_id: int):
    file = get_owned_file(file_id)
    user_id, name, key = file.user_id, file.display_name, file.storage_key
    AuditLog.query.filter_by(file_id=file.file_id).update({"file_id": None})
    DocumentMetadata.query.filter_by(duplicate_of_file_id=file.file_id).update(
        {"duplicate_of_file_id": None, "duplicate_type": None, "duplicate_score": None})
    db.session.delete(file)
    audit.record(user_id, "DELETE", None, name)
    db.session.commit()
    try:
        get_storage().delete(key)
    except Exception:
        current_app.logger.exception("Could not delete stored object %s", key)
    bump(user_id)
    return "", 204
