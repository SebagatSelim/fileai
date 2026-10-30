"""Health check and public client settings."""
from flask import Blueprint, current_app, jsonify

from ..services.ai import provider_info
from ..services.extraction import ocr_available
from ..services.storage import get_storage

bp = Blueprint("health", __name__)


@bp.get("/health")
def health():
    cfg = current_app.config
    return jsonify({
        "status": "ok",
        **provider_info(),
        "ocr_available": ocr_available(),
        "storage_backend": get_storage().name,
        "max_upload_mb": cfg["MAX_UPLOAD_MB"],
        "low_confidence_threshold": cfg["CLASSIFICATION_CONFIDENCE_THRESHOLD"],
        "allowed_extensions": cfg["ALLOWED_EXTENSIONS"],
    })
