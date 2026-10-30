"""Serves files for local storage via short-lived signed links (the local stand-in for S3 pre-signed URLs)."""
from flask import Blueprint, current_app, send_file

from ..errors import APIError
from ..services.storage import LocalStorage, get_storage, read_download_token

bp = Blueprint("files", __name__)


@bp.get("/files/<token>/<path:filename>")
def serve_file_named(token: str, filename: str):
    return serve_file(token)


@bp.get("/files/<token>")
def serve_file(token: str):
    storage = get_storage()
    payload = read_download_token(token, current_app.config["DOWNLOAD_URL_EXPIRES_SEC"])
    if payload is None or not isinstance(storage, LocalStorage):
        raise APIError(403, "LINK_EXPIRED", "This download link is invalid or has expired.")
    path = storage.path_for(payload["k"])
    if not path.exists():
        raise APIError(404, "NOT_FOUND", "File not found.")
    response = send_file(path, mimetype=payload["m"], as_attachment=not payload["i"], download_name=payload["f"],
                         max_age=0)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "private, no-store"
    return response
