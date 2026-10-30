"""In-memory per-user index of embeddings and searchable words.

Search (FR-06) and similar-document detection (FR-07) compare one vector against all of a user's
documents. Loading and parsing those vectors from MySQL on every request would be slow for
10,000 documents (NFR-05), so each user's matrix is cached and rebuilt only when their documents change.
"""
import threading
from dataclasses import dataclass

import numpy as np
import sqlalchemy as sa

from ..extensions import db
from ..models import DocumentEmbedding, DocumentKeyword, DocumentMetadata, File
from .folders import folder_paths
from .text import tokenize


@dataclass
class UserIndex:
    signature: tuple
    file_ids: list[int]
    matrix: np.ndarray            # one L2-normalised row per document (or empty)
    strong_terms: list[set[str]]  # words from title, keywords, filename, folder, category
    weak_terms: list[set[str]]    # words from summary and body text


_cache: dict[tuple[int, str, str], UserIndex] = {}
_versions: dict[int, int] = {}
_lock = threading.Lock()


def bump(user_id: int) -> None:
    """Call after any change to a user's documents so the next search rebuilds the index."""
    with _lock:
        _versions[user_id] = _versions.get(user_id, 0) + 1


def _signature(user_id: int, statuses: tuple[str, ...]) -> tuple:
    row = db.session.execute(
        sa.select(sa.func.count(File.file_id), sa.func.max(File.updated_at))
        .where(File.user_id == user_id, File.status.in_(statuses))
    ).one()
    # The DB part catches changes made by other processes; the version catches same-second edits here.
    return (row[0], str(row[1]), _versions.get(user_id, 0))


def get_index(user_id: int, model_name: str, statuses: tuple[str, ...] = ("STORED",)) -> UserIndex:
    key = (user_id, model_name, ",".join(statuses))
    signature = _signature(user_id, statuses)
    cached = _cache.get(key)
    if cached and cached.signature == signature:
        return cached

    rows = db.session.execute(
        sa.select(File, DocumentMetadata, DocumentEmbedding)
        .outerjoin(DocumentMetadata, DocumentMetadata.file_id == File.file_id)
        .outerjoin(DocumentEmbedding, sa.and_(
            DocumentEmbedding.file_id == File.file_id, DocumentEmbedding.model_name == model_name))
        .where(File.user_id == user_id, File.status.in_(statuses))
        .order_by(File.file_id)
    ).all()
    keywords: dict[int, list[str]] = {}
    for kw in DocumentKeyword.query.join(File).filter(File.user_id == user_id).all():
        keywords.setdefault(kw.file_id, []).append(kw.keyword)
    paths = folder_paths(user_id)

    file_ids, vectors, strong, weak = [], [], [], []
    dims = None
    for file, meta, emb in rows:
        file_ids.append(file.file_id)
        if emb is not None:
            dims = dims or len(emb.embedding)
        vectors.append(emb.embedding if emb is not None else None)
        strong_text = " ".join([
            file.display_name.rsplit(".", 1)[0].replace("_", " "),
            meta.title or "" if meta else "",
            meta.category or "" if meta else "",
            meta.subject or "" if meta else "",
            meta.document_type or "" if meta else "",
            " ".join(keywords.get(file.file_id, [])),
            " ".join(paths.get(file.folder_id, [])) if file.folder_id else "",
        ])
        weak_text = " ".join([(meta.summary or "") if meta else "", ((meta.extracted_text or "")[:8000]) if meta else ""])
        strong.append(set(tokenize(strong_text)))
        weak.append(set(tokenize(weak_text)))

    if dims:
        matrix = np.zeros((len(file_ids), dims), dtype=np.float32)
        for i, vector in enumerate(vectors):
            if vector is not None and len(vector) == dims:
                matrix[i] = vector
    else:
        matrix = np.zeros((len(file_ids), 0), dtype=np.float32)

    index = UserIndex(signature, file_ids, matrix, strong, weak)
    with _lock:
        _cache[key] = index
    return index


def cosine_scores(index: UserIndex, vector: list[float]) -> np.ndarray:
    if index.matrix.shape[1] == 0 or len(vector) != index.matrix.shape[1]:
        return np.zeros(len(index.file_ids), dtype=np.float32)
    return index.matrix @ np.asarray(vector, dtype=np.float32)


def clear_cache() -> None:
    with _lock:
        _cache.clear()
        _versions.clear()
