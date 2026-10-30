"""Turn models into the JSON shapes described in docs/06-api-specification.md."""
from datetime import datetime

from .models import File, User
from .services.folders import path_string


def iso(value: datetime | None) -> str | None:
    return value.strftime("%Y-%m-%dT%H:%M:%SZ") if value else None


def user_json(user: User) -> dict:
    return {"user_id": user.user_id, "name": user.name, "email": user.email, "created_at": iso(user.created_at)}


def document_json(file: File, folder_paths: dict[int, list[str]] | None = None) -> dict:
    meta = file.meta
    if folder_paths is not None:
        folder_path = "/".join(folder_paths[file.folder_id]) if file.folder_id in folder_paths else None
    else:
        folder_path = path_string(file.folder)
    duplicate = None
    if meta is not None and meta.duplicate_type:
        dup_file = meta.duplicate_of
        duplicate = {
            "file_id": meta.duplicate_of_file_id,
            "name": dup_file.display_name if dup_file else None,
            "type": meta.duplicate_type,
            "score": float(meta.duplicate_score) if meta.duplicate_score is not None else None,
        }
    return {
        "file_id": file.file_id,
        "name": file.display_name,
        "original_name": file.original_name,
        "title": meta.title if meta else None,
        "category": meta.category if meta else None,
        "subject": meta.subject if meta else None,
        "document_type": meta.document_type if meta else None,
        "file_type": file.file_type,
        "mime_type": file.mime_type,
        "file_size_bytes": int(file.file_size_bytes),
        "folder_id": file.folder_id,
        "folder_path": folder_path,
        "status": file.status,
        "summary": meta.summary if meta else None,
        "keywords": [k.keyword for k in file.keywords],
        "confidence": float(meta.classification_confidence) if meta and meta.classification_confidence is not None else None,
        "extraction_method": meta.extraction_method if meta else None,
        "is_user_approved": bool(meta.is_user_approved) if meta else False,
        "duplicate_of": duplicate,
        "error_message": file.error_message,
        "uploaded_at": iso(file.uploaded_at),
        "updated_at": iso(file.updated_at),
    }


def suggestions_json(file: File) -> dict | None:
    meta = file.meta
    if meta is None or meta.title is None:
        return None
    return {
        "title": meta.title,
        "summary": meta.summary,
        "category": meta.category,
        "subject": meta.subject,
        "document_type": meta.document_type,
        "keywords": [k.keyword for k in file.keywords],
        "suggested_filename": meta.suggested_filename,
        "suggested_folder_path": [p for p in (meta.suggested_folder_path or "").split("/") if p],
        "confidence": float(meta.classification_confidence) if meta.classification_confidence is not None else None,
    }
