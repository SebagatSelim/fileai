"""Flask application factory."""
import logging
import threading

from flask import Flask, jsonify
from sqlalchemy import event
from sqlalchemy.engine import Engine

from .config import Config
from .errors import register_error_handlers
from .extensions import cors, db, jwt


def create_app(config_class=Config, **overrides) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_class())
    app.config.update(overrides)
    app.config.setdefault("MAX_CONTENT_LENGTH", (app.config["MAX_UPLOAD_MB"] + 1) * 1024 * 1024)

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")

    db.init_app(app)
    jwt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})
    _register_jwt_errors()
    register_error_handlers(app)

    from .services.pipeline import init_pipeline
    from .services.storage import init_storage

    init_storage(app)
    init_pipeline(app)

    from .api import register_blueprints

    register_blueprints(app)

    from .cli import register_cli

    register_cli(app)
    _resume_unfinished_work_once(app)
    _security_headers(app)
    return app


def _register_jwt_errors() -> None:
    def unauthorized(message: str):
        return jsonify({"error": {"code": "UNAUTHORIZED", "message": message}}), 401

    jwt.unauthorized_loader(lambda reason: unauthorized("Please sign in to continue."))
    jwt.invalid_token_loader(lambda reason: unauthorized("Your session is invalid. Please sign in again."))
    jwt.expired_token_loader(lambda header, payload: unauthorized("Your session has expired. Please sign in again."))


def _resume_unfinished_work_once(app: Flask) -> None:
    """After a restart, re-queue documents that were mid-processing (NFR-04)."""
    if app.config["PROCESSING_MODE"] != "thread":
        return
    done = threading.Event()

    @app.before_request
    def _resume():
        if done.is_set():
            return
        done.set()
        from .services.pipeline import requeue_stuck_jobs

        try:
            requeue_stuck_jobs()
        except Exception:
            app.logger.exception("Could not re-queue unfinished documents")


def _security_headers(app: Flask) -> None:
    @app.after_request
    def _headers(response):
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        return response


@event.listens_for(Engine, "connect")
def _sqlite_foreign_keys(dbapi_connection, connection_record):
    """SQLite (used in tests) only enforces foreign keys when asked to."""
    if dbapi_connection.__class__.__module__.startswith("sqlite3"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
