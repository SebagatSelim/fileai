import io

import pytest

from app import create_app
from app.api import auth as auth_module
from app.config import TestConfig
from app.extensions import db
from app.services.index import clear_cache

PASSWORD = "Passw0rd!"


@pytest.fixture
def app(tmp_path):
    app = create_app(TestConfig, LOCAL_STORAGE_DIR=str(tmp_path / "uploads"))
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()
    clear_cache()
    auth_module._failures.clear()


@pytest.fixture
def client(app):
    return app.test_client()


def register(client, email="user@example.com", password=PASSWORD, name="Test User"):
    return client.post("/api/auth/register", json={"name": name, "email": email, "password": password})


def login(client, email="user@example.com", password=PASSWORD):
    return client.post("/api/auth/login", json={"email": email, "password": password})


@pytest.fixture
def auth(client):
    """Register + log in a user; returns request headers."""
    register(client)
    token = login(client).get_json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def make_user_headers(client, email):
    register(client, email=email)
    return {"Authorization": f"Bearer {login(client, email=email).get_json()['access_token']}"}


def upload(client, headers, filename, data: bytes, allow_duplicate=False):
    return client.post(
        "/api/documents",
        data={"file": (io.BytesIO(data), filename), "allow_duplicate": "true" if allow_duplicate else "false"},
        headers=headers,
        content_type="multipart/form-data",
    )


def approve_suggestions(client, headers, file_id):
    analysis = client.get(f"/api/documents/{file_id}/analysis", headers=headers).get_json()
    s = analysis["suggestions"]
    return client.post(f"/api/documents/{file_id}/approve", headers=headers, json={
        "title": s["title"], "filename": s["suggested_filename"], "folder_path": s["suggested_folder_path"],
        "category": s["category"], "keywords": s["keywords"], "summary": s["summary"],
    })
