"""Small helpers shared by the API modules."""
from flask import request
from flask_jwt_extended import get_jwt_identity

from ..errors import not_found, validation_error
from ..extensions import db
from ..models import File


def current_user_id() -> int:
    return int(get_jwt_identity())


def json_body() -> dict:
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise validation_error("Request body must be a JSON object.")
    return data


def get_owned_file(file_id: int) -> File:
    """Fetch a file only if it belongs to the signed-in user (404 otherwise, so IDs can't be probed)."""
    file = db.session.get(File, file_id)
    if file is None or file.user_id != current_user_id():
        raise not_found()
    return file


def optional_str(data: dict, key: str, max_len: int, required: bool = False) -> str | None:
    if key not in data or data[key] is None:
        if required:
            raise validation_error(f"{key} is required.", {key: "Required"})
        return None
    value = str(data[key]).strip()
    if required and not value:
        raise validation_error(f"{key} is required.", {key: "Required"})
    if len(value) > max_len:
        raise validation_error(f"{key} must be {max_len} characters or fewer.", {key: "Too long"})
    return value
