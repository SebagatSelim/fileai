"""REST API blueprints, all mounted under /api."""
from flask import Flask


def register_blueprints(app: Flask) -> None:
    from .auth import bp as auth_bp
    from .dashboard import bp as dashboard_bp
    from .documents import bp as documents_bp
    from .files import bp as files_bp
    from .folders import bp as folders_bp
    from .health import bp as health_bp
    from .search import bp as search_bp
    from .users import bp as users_bp

    for blueprint in (auth_bp, documents_bp, search_bp, folders_bp, dashboard_bp, users_bp, health_bp, files_bp):
        app.register_blueprint(blueprint, url_prefix="/api")
