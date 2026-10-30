"""TC-SRCH and TC-SEC: natural-language search and per-user access control."""
import pytest

from app.demo import SAMPLES
from conftest import approve_suggestions, make_user_headers, upload


@pytest.fixture
def library(client, auth):
    """All demo samples uploaded and approved; returns {original filename: file_id}."""
    ids = {}
    for sample in SAMPLES:
        if sample.get("approve") is False:
            continue
        name = sample["filename"].rsplit(".", 1)[0] + ".txt"
        file_id = upload(client, auth, name, sample["text"].encode()).get_json()["file_id"]
        approve_suggestions(client, auth, file_id)
        ids[sample["filename"]] = file_id
    return ids


@pytest.mark.parametrize("query, expected", [
    ("Find my Semester 1 Database assignment", "Database_Assignment.pdf"),
    ("documents about IPv6 routing", "scan001.pdf"),
    ("internet bill from February", "Invoice_2026.pdf"),
    ("my resume", "Resume.docx"),
    ("flight to Kuala Lumpur", "flight_booking.txt"),
    ("machine learning lecture notes", "week3_notes.txt"),
    ("rental lease contract", "Lease_Agreement.docx"),
])
def test_search_finds_the_right_document_first(client, auth, library, query, expected):
    res = client.post("/api/search", headers=auth, json={"query": query})
    assert res.status_code == 200
    body = res.get_json()
    assert body["results"], f"no results for {query!r}"
    assert body["results"][0]["file_id"] == library[expected]
    assert 0 < body["results"][0]["relevance"] <= 1
    assert body["took_ms"] < 2000  # NFR-01


def test_search_validation_and_empty_results(client, auth, library):
    assert client.post("/api/search", headers=auth, json={"query": "   "}).status_code == 400
    res = client.post("/api/search", headers=auth, json={"query": "quantum chromodynamics"}).get_json()
    assert res["results"] == []


def test_search_never_returns_other_users_documents(client, auth, library):
    other = make_user_headers(client, "other@example.com")
    res = client.post("/api/search", headers=other, json={"query": "database assignment"}).get_json()
    assert res["results"] == []


def test_users_cannot_touch_each_others_documents(client, auth, library):
    other = make_user_headers(client, "intruder@example.com")
    file_id = library["Database_Assignment.pdf"]
    checks = [
        client.get(f"/api/documents/{file_id}", headers=other),
        client.get(f"/api/documents/{file_id}/analysis", headers=other),
        client.get(f"/api/documents/{file_id}/download", headers=other),
        client.patch(f"/api/documents/{file_id}", headers=other, json={"title": "hacked"}),
        client.post(f"/api/documents/{file_id}/approve", headers=other, json={"filename": "x", "folder_path": ["x"]}),
        client.post(f"/api/documents/{file_id}/reprocess", headers=other),
        client.delete(f"/api/documents/{file_id}", headers=other),
    ]
    assert [r.status_code for r in checks] == [404] * len(checks)
    assert client.get(f"/api/documents/{file_id}", headers=auth).get_json()["title"] != "hacked"
    assert client.get("/api/documents", headers=other).get_json()["total"] == 0


@pytest.mark.parametrize("method, path", [
    ("get", "/api/documents"), ("post", "/api/documents"), ("get", "/api/documents/1"),
    ("get", "/api/documents/1/analysis"), ("post", "/api/search"), ("get", "/api/folders"),
    ("get", "/api/dashboard/stats"), ("get", "/api/users/me"), ("get", "/api/categories"),
])
def test_endpoints_require_authentication(client, method, path):
    assert getattr(client, method)(path).status_code == 401


def test_health_is_public(client):
    body = client.get("/api/health").get_json()
    assert body["status"] == "ok" and body["ai_provider"] == "local" and body["max_upload_mb"] == 20
