"""Dashboard statistics (UI 8.4)."""
from collections import Counter
from datetime import datetime

import sqlalchemy as sa
from flask import Blueprint, current_app, jsonify
from flask_jwt_extended import jwt_required

from ..extensions import db
from ..models import AuditLog, DocumentMetadata, File, utcnow
from ..serializers import iso
from ..services.ai.base import UNCATEGORISED
from .helpers import current_user_id

bp = Blueprint("dashboard", __name__)


def _last_months(count: int) -> list[str]:
    now = utcnow()
    months, year, month = [], now.year, now.month
    for _ in range(count):
        months.append(f"{year:04d}-{month:02d}")
        month -= 1
        if month == 0:
            year, month = year - 1, 12
    return list(reversed(months))


@bp.get("/dashboard/stats")
@jwt_required()
def stats():
    user_id = current_user_id()
    rows = db.session.execute(
        sa.select(File.status, File.file_size_bytes, File.uploaded_at, DocumentMetadata.category,
                  DocumentMetadata.duplicate_type)
        .outerjoin(DocumentMetadata, DocumentMetadata.file_id == File.file_id)
        .where(File.user_id == user_id)
    ).all()

    status_counts = Counter(r.status for r in rows)
    stored = [r for r in rows if r.status == "STORED"]
    classified = [r for r in stored if r.category and r.category != UNCATEGORISED]
    by_category = Counter(r.category for r in stored if r.category)

    months = _last_months(12)
    uploaded, classified_by_month = Counter(), Counter()
    for r in rows:
        month = r.uploaded_at.strftime("%Y-%m") if isinstance(r.uploaded_at, datetime) else None
        uploaded[month] += 1
        if r.category and r.category != UNCATEGORISED and r.status in ("AWAITING_REVIEW", "STORED"):
            classified_by_month[month] += 1

    logs = (AuditLog.query.filter(AuditLog.user_id == user_id,
                                  AuditLog.action.in_(("UPLOAD", "APPROVE", "MOVE", "UPDATE", "DELETE", "DOWNLOAD")))
            .order_by(AuditLog.created_at.desc(), AuditLog.log_id.desc()).limit(10).all())

    return jsonify({
        "total_documents": len(stored),
        "ai_classified": len(classified),
        "duplicates_found": sum(1 for r in rows if r.duplicate_type and r.status in ("AWAITING_REVIEW", "STORED")),
        "awaiting_review": status_counts["AWAITING_REVIEW"],
        "processing": status_counts["PROCESSING"] + status_counts["UPLOADED"],
        "failed": status_counts["FAILED"],
        "storage_used_bytes": int(sum(r.file_size_bytes for r in rows)),
        "storage_quota_bytes": current_app.config["STORAGE_QUOTA_MB"] * 1024 * 1024,
        "by_category": [{"category": c, "count": n} for c, n in by_category.most_common()],
        "uploads_by_month": [{"month": m, "uploaded": uploaded[m], "classified": classified_by_month[m]} for m in months],
        "recent_activity": [
            {"action": log.action, "file_id": log.file_id,
             "file_name": log.file.display_name if log.file else log.details,
             "details": log.details, "at": iso(log.created_at)}
            for log in logs
        ],
    })
