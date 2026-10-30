"""Registration and login (FR-01, NFR-02)."""
import re
import threading
import time

import bcrypt
from flask import Blueprint, current_app, jsonify
from flask_jwt_extended import create_access_token, jwt_required

from ..errors import APIError, validation_error
from ..extensions import db
from ..models import User, utcnow
from ..serializers import user_json
from ..services import audit
from .helpers import current_user_id, json_body

bp = Blueprint("auth", __name__)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$")
GENERIC_LOGIN_ERROR = "Invalid email or password."

# Failed-login counter per email (in memory): blocks password guessing.
_failures: dict[str, list[float]] = {}
_failures_lock = threading.Lock()


def password_problems(password: str) -> list[str]:
    """Return the FR-01 rules the password breaks (empty list = OK)."""
    problems = []
    if len(password) < 8:
        problems.append("at least 8 characters")
    if not re.search(r"[A-Z]", password):
        problems.append("an uppercase letter")
    if not re.search(r"[a-z]", password):
        problems.append("a lowercase letter")
    if not re.search(r"\d", password):
        problems.append("a number")
    if not re.search(r"[^A-Za-z0-9\s]", password):  # spaces don't count as special characters
        problems.append("a special character")
    if len(password.encode("utf-8")) > 72:
        problems.append("no more than 72 bytes (BCrypt limit)")
    return problems


def hash_password(password: str) -> str:
    rounds = current_app.config["BCRYPT_ROUNDS"]
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds)).decode("utf-8")


def check_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def normalise_email(value) -> str:
    return str(value or "").strip().lower()


def validate_email(email: str) -> None:
    if not email:
        raise validation_error("Email is required.", {"email": "Required"})
    if len(email) > 255 or not EMAIL_RE.match(email):
        raise validation_error("Please enter a valid email address.", {"email": "Invalid email format"})


def validate_password(password: str, field: str = "password") -> None:
    problems = password_problems(password)
    if problems:
        message = "Password must contain " + ", ".join(problems) + "."
        raise validation_error(message, {field: message})


def _locked_out(email: str) -> bool:
    window = current_app.config["LOGIN_LOCKOUT_SECONDS"]
    now = time.time()
    with _failures_lock:
        attempts = [t for t in _failures.get(email, []) if now - t < window]
        _failures[email] = attempts
        return len(attempts) >= current_app.config["LOGIN_MAX_ATTEMPTS"]


def _note_failure(email: str) -> None:
    with _failures_lock:
        _failures.setdefault(email, []).append(time.time())


@bp.post("/auth/register")
def register():
    data = json_body()
    name = str(data.get("name") or "").strip()
    email = normalise_email(data.get("email"))
    password = str(data.get("password") or "")

    if not name:
        raise validation_error("Name is required.", {"name": "Required"})
    if len(name) > 150:
        raise validation_error("Name must be 150 characters or fewer.", {"name": "Too long"})
    validate_email(email)
    if not password:
        raise validation_error("Password is required.", {"password": "Required"})
    validate_password(password)
    if User.query.filter_by(email=email).first():
        raise APIError(409, "EMAIL_EXISTS", "An account with this email already exists.", {"email": "Already registered"})

    user = User(name=name, email=email, password_hash=hash_password(password))
    db.session.add(user)
    db.session.flush()
    audit.record(user.user_id, "REGISTER")
    db.session.commit()
    return jsonify({"user_id": user.user_id, "message": "Registration successful. You can now sign in."}), 201


@bp.post("/auth/login")
def login():
    data = json_body()
    email = normalise_email(data.get("email"))
    password = str(data.get("password") or "")
    if not email or not password:
        raise validation_error("Please enter all required fields.")
    if _locked_out(email):
        raise APIError(429, "TOO_MANY_ATTEMPTS", "Too many failed sign-in attempts. Please wait a few minutes and try again.")

    user = User.query.filter_by(email=email).first()
    if user is None or not check_password(password, user.password_hash):
        _note_failure(email)
        if user is not None:
            audit.record(user.user_id, "LOGIN_FAILED")
            db.session.commit()
        raise APIError(401, "UNAUTHORIZED", GENERIC_LOGIN_ERROR)

    with _failures_lock:
        _failures.pop(email, None)
    user.last_login_at = utcnow()
    audit.record(user.user_id, "LOGIN")
    db.session.commit()
    expires = current_app.config["JWT_ACCESS_TOKEN_EXPIRES"]
    token = create_access_token(identity=str(user.user_id))
    return jsonify({"access_token": token, "expires_in": int(expires.total_seconds()), "user": user_json(user)})


@bp.get("/auth/me")
@jwt_required()
def me():
    user = db.session.get(User, current_user_id())
    if user is None:
        raise APIError(401, "UNAUTHORIZED", "Account no longer exists.")
    return jsonify(user_json(user))


@bp.post("/auth/logout")
@jwt_required()
def logout():
    # Tokens are stateless; the client discards its token. Kept as an endpoint for a clean API.
    return "", 204
