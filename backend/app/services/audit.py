"""Audit log helper (UC-10)."""
from flask import has_request_context, request

from ..extensions import db
from ..models import AuditLog


def record(user_id: int, action: str, file_id: int | None = None, details: str | None = None) -> None:
    """Add an audit row to the current session. The caller commits."""
    ip = None
    if has_request_context():
        ip = (request.headers.get("X-Forwarded-For", "").split(",")[0].strip() or request.remote_addr or None)
    db.session.add(AuditLog(
        user_id=user_id, file_id=file_id, action=action,
        details=(details or "")[:500] or None, ip_address=(ip or "")[:45] or None,
    ))
