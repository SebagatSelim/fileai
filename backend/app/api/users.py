"""Profile and password (UI 8.9)."""
import sqlalchemy as sa
from flask import Blueprint, current_app, jsonify
from flask_jwt_extended import jwt_required

from ..errors import APIError, validation_error
from ..extensions import db
from ..models import File, User
from ..serializers import user_json
from .auth import check_password, hash_password, normalise_email, validate_email, validate_password
from .helpers import current_user_id, json_body

bp = Blueprint("users", __name__)


def _current_user() -> User:
    user = db.session.get(User, current_user_id())
    if user is None:
        raise APIError(401, "UNAUTHORIZED", "Account no longer exists.")
    return user


def _profile(user: User) -> dict:
    count, used = db.session.execute(
        sa.select(sa.func.count(File.file_id), sa.func.coalesce(sa.func.sum(File.file_size_bytes), 0))
        .where(File.user_id == user.user_id)
    ).one()
    stored = db.session.scalar(
        sa.select(sa.func.count(File.file_id)).where(File.user_id == user.user_id, File.status == "STORED"))
    data = user_json(user)
    data.update({
        "document_count": int(stored or 0),
        "file_count": int(count or 0),
        "storage_used_bytes": int(used or 0),
        "storage_quota_bytes": current_app.config["STORAGE_QUOTA_MB"] * 1024 * 1024,
    })
    return data


@bp.get("/users/me")
@jwt_required()
def get_me():
    return jsonify(_profile(_current_user()))


@bp.patch("/users/me")
@jwt_required()
def update_me():
    user = _current_user()
    data = json_body()
    if "name" in data:
        name = str(data["name"] or "").strip()
        if not name:
            raise validation_error("Name is required.", {"name": "Required"})
        if len(name) > 150:
            raise validation_error("Name must be 150 characters or fewer.", {"name": "Too long"})
        user.name = name
    if "email" in data:
        email = normalise_email(data["email"])
        validate_email(email)
        if email != user.email and User.query.filter_by(email=email).first():
            raise APIError(409, "EMAIL_EXISTS", "An account with this email already exists.", {"email": "Already registered"})
        user.email = email
    db.session.commit()
    return jsonify(_profile(user))


@bp.put("/users/me/password")
@jwt_required()
def change_password():
    user = _current_user()
    data = json_body()
    current = str(data.get("current_password") or "")
    new = str(data.get("new_password") or "")
    if not current or not new:
        raise validation_error("Please enter your current and new password.")
    if not check_password(current, user.password_hash):
        raise APIError(401, "WRONG_PASSWORD", "Your current password is incorrect.", {"current_password": "Incorrect"})
    validate_password(new, "new_password")
    user.password_hash = hash_password(new)
    db.session.commit()
    return "", 204
