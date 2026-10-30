"""Consistent JSON errors: {"error": {"code": ..., "message": ..., "fields": {...}}}."""
import logging

from flask import jsonify
from werkzeug.exceptions import HTTPException

log = logging.getLogger(__name__)


class APIError(Exception):
    def __init__(self, status: int, code: str, message: str, fields: dict | None = None, **extra):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.fields = fields
        self.extra = extra

    def to_response(self):
        body = {"code": self.code, "message": self.message}
        if self.fields:
            body["fields"] = self.fields
        body.update(self.extra)
        return jsonify({"error": body}), self.status


def validation_error(message: str, fields: dict | None = None) -> APIError:
    return APIError(400, "VALIDATION_ERROR", message, fields)


def not_found(message: str = "Document not found.") -> APIError:
    return APIError(404, "NOT_FOUND", message)


_HTTP_CODES = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    413: "FILE_TOO_LARGE",
    429: "TOO_MANY_REQUESTS",
}


def register_error_handlers(app):
    @app.errorhandler(APIError)
    def _api_error(err: APIError):
        return err.to_response()

    @app.errorhandler(HTTPException)
    def _http_error(err: HTTPException):
        status = err.code or 500
        message = err.description or err.name
        if status == 413:
            message = f"File is larger than the {app.config['MAX_UPLOAD_MB']} MB limit."
        return jsonify({"error": {"code": _HTTP_CODES.get(status, "HTTP_ERROR"), "message": message}}), status

    @app.errorhandler(Exception)
    def _unexpected(err: Exception):
        log.exception("Unhandled error")
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Something went wrong on the server."}}), 500
