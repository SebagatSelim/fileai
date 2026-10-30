"""TC-UPL, TC-EXT, TC-AI, TC-DUP: upload, extraction, AI review, approve, edit, download, delete."""
import io

import pytest
from PIL import Image

from app import create_app
from app.config import TestConfig
from app.demo import SAMPLES, make_docx, make_pdf
from app.extensions import db
from app.services.extraction import ocr_available
from conftest import approve_suggestions, upload

ASSIGNMENT = next(s for s in SAMPLES if s["filename"] == "Database_Assignment.pdf")["text"]


def test_upload_txt_is_processed_into_suggestions(client, auth):
    res = upload(client, auth, "notes.txt", ASSIGNMENT.encode())
    assert res.status_code == 202
    file_id = res.get_json()["file_id"]

    analysis = client.get(f"/api/documents/{file_id}/analysis", headers=auth).get_json()
    assert analysis["status"] == "AWAITING_REVIEW"
    s = analysis["suggestions"]
    assert s["category"] == "University"
    assert s["suggested_folder_path"] == ["University", "Year 2", "Semester 1", "Database Systems"]
    assert s["suggested_filename"] == "Semester1_Database_Systems_Assignment.txt"
    assert s["keywords"] and s["summary"] and 0 < s["confidence"] <= 1


@pytest.mark.parametrize("filename, maker, method", [
    ("report.pdf", make_pdf, "PYMUPDF"),
    ("report.docx", make_docx, "PYTHON_DOCX"),
])
def test_pdf_and_docx_text_extraction(client, auth, filename, maker, method):
    file_id = upload(client, auth, filename, maker(ASSIGNMENT)).get_json()["file_id"]
    doc = client.get(f"/api/documents/{file_id}", headers=auth).get_json()
    assert doc["status"] == "AWAITING_REVIEW"
    assert doc["extraction_method"] == method
    assert "normalisation" in doc["text_preview"].lower()


def test_upload_rejects_unsupported_extension(client, auth):
    res = upload(client, auth, "virus.exe", b"MZ\x90\x00")
    assert res.status_code == 400
    assert "Unsupported file format" in res.get_json()["error"]["message"]


def test_upload_rejects_content_that_does_not_match_extension(client, auth):
    res = upload(client, auth, "fake.pdf", b"MZ\x90\x00\x03\x00\x00\x00 not really a pdf")
    assert res.status_code == 400
    assert "does not match" in res.get_json()["error"]["message"]


def test_upload_rejects_empty_and_corrupted_files(client, auth):
    assert upload(client, auth, "empty.txt", b"").status_code == 400
    assert upload(client, auth, "broken.pdf", b"%PDF-1.7 garbage that is not a pdf").status_code == 400


def test_upload_rejects_files_over_the_size_limit(tmp_path):
    app = create_app(TestConfig, LOCAL_STORAGE_DIR=str(tmp_path), MAX_UPLOAD_MB=1)
    with app.app_context():
        db.create_all()
        client = app.test_client()
        client.post("/api/auth/register", json={"name": "A", "email": "a@example.com", "password": "Passw0rd!"})
        token = client.post("/api/auth/login", json={"email": "a@example.com", "password": "Passw0rd!"}).get_json()["access_token"]
        res = upload(client, {"Authorization": f"Bearer {token}"}, "big.txt", b"a" * (1024 * 1024 + 10))
        assert res.status_code == 413
        assert res.get_json()["error"]["code"] == "FILE_TOO_LARGE"
        db.drop_all()


def test_exact_duplicate_is_detected_and_can_be_overridden(client, auth):
    data = ASSIGNMENT.encode()
    first = upload(client, auth, "a.txt", data).get_json()["file_id"]
    dup = upload(client, auth, "copy.txt", data)
    assert dup.status_code == 409
    error = dup.get_json()["error"]
    assert error["code"] == "DUPLICATE_FILE" and error["existing_file"]["file_id"] == first

    forced = upload(client, auth, "copy.txt", data, allow_duplicate=True)
    assert forced.status_code == 202
    analysis = client.get(f"/api/documents/{forced.get_json()['file_id']}/analysis", headers=auth).get_json()
    assert analysis["duplicate_of"]["type"] == "EXACT"
    assert analysis["duplicate_of"]["file_id"] == first


def test_edited_copy_is_flagged_as_similar(client, auth):
    first = upload(client, auth, "a.txt", ASSIGNMENT.encode()).get_json()["file_id"]
    edited = ASSIGNMENT.replace("small library", "small public library") + "\nAppendix: corrected SQL."
    second = upload(client, auth, "b.txt", edited.encode()).get_json()["file_id"]
    analysis = client.get(f"/api/documents/{second}/analysis", headers=auth).get_json()
    assert analysis["duplicate_of"]["type"] == "SIMILAR"
    assert [d["file_id"] for d in analysis["similar_documents"]] == [first]
    assert analysis["similar_documents"][0]["similarity"] >= 0.9


def test_unrelated_documents_are_not_flagged(client, auth):
    upload(client, auth, "a.txt", ASSIGNMENT.encode())
    invoice = next(s for s in SAMPLES if s["filename"] == "Invoice_2026.pdf")["text"]
    file_id = upload(client, auth, "b.txt", invoice.encode()).get_json()["file_id"]
    analysis = client.get(f"/api/documents/{file_id}/analysis", headers=auth).get_json()
    assert analysis["duplicate_of"] is None and analysis["similar_documents"] == []


def test_approve_stores_document_in_new_folders(client, auth):
    file_id = upload(client, auth, "a.txt", ASSIGNMENT.encode()).get_json()["file_id"]
    res = client.post(f"/api/documents/{file_id}/approve", headers=auth, json={
        "title": "My DB Assignment", "filename": "DB_Assignment.pdf",  # wrong extension is corrected
        "folder_path": ["University", "Year 2", "Semester 1", "Database Systems"],
        "category": "University", "keywords": ["SQL", "ER model", "sql"], "summary": "Edited summary",
    })
    assert res.status_code == 200
    doc = res.get_json()
    assert doc["status"] == "STORED" and doc["is_user_approved"]
    assert doc["name"] == "DB_Assignment.txt"
    assert doc["folder_path"] == "University/Year 2/Semester 1/Database Systems"
    assert doc["keywords"] == ["SQL", "ER model"]  # case-insensitive de-duplication

    tree = client.get("/api/folders", headers=auth).get_json()
    assert tree[0]["name"] == "University"
    assert tree[0]["children"][0]["children"][0]["children"][0]["document_count"] == 1


def test_approve_validates_required_fields(client, auth):
    file_id = upload(client, auth, "a.txt", ASSIGNMENT.encode()).get_json()["file_id"]
    assert client.post(f"/api/documents/{file_id}/approve", headers=auth,
                       json={"filename": "", "folder_path": ["A"]}).status_code == 400
    assert client.post(f"/api/documents/{file_id}/approve", headers=auth,
                       json={"filename": "x.txt", "folder_path": []}).status_code == 400


def test_existing_folder_names_are_reused(client, auth):
    first = upload(client, auth, "a.txt", ASSIGNMENT.encode()).get_json()["file_id"]
    client.post(f"/api/documents/{first}/approve", headers=auth, json={
        "filename": "a.txt", "folder_path": ["university", "year 2"]})
    other = ASSIGNMENT.replace("NIT2102 Database Systems", "NIT2103 Web Development").replace("library", "shop")
    second = upload(client, auth, "b.txt", (other + " HTML CSS JavaScript").encode()).get_json()["file_id"]
    path = client.get(f"/api/documents/{second}/analysis", headers=auth).get_json()["suggestions"]["suggested_folder_path"]
    assert path[:2] == ["university", "year 2"]  # the user's own spelling


def test_patch_moves_and_edits_document(client, auth):
    file_id = upload(client, auth, "a.txt", ASSIGNMENT.encode()).get_json()["file_id"]
    approve_suggestions(client, auth, file_id)
    res = client.patch(f"/api/documents/{file_id}", headers=auth, json={
        "folder_path": ["Archive", "2026"], "keywords": ["Archived"], "title": "Old assignment"})
    assert res.status_code == 200
    doc = res.get_json()
    assert doc["folder_path"] == "Archive/2026" and doc["keywords"] == ["Archived"] and doc["title"] == "Old assignment"


def test_download_link_serves_the_file(client, auth):
    data = ASSIGNMENT.encode()
    file_id = upload(client, auth, "a.txt", data).get_json()["file_id"]
    approve_suggestions(client, auth, file_id)
    link = client.get(f"/api/documents/{file_id}/download", headers=auth).get_json()
    assert link["filename"] == "Semester1_Database_Systems_Assignment.txt"
    res = client.get(link["url"])  # no auth header needed: the link is signed and short-lived
    assert res.status_code == 200 and res.data == data
    assert "attachment" in res.headers["Content-Disposition"]
    inline = client.get(client.get(f"/api/documents/{file_id}/download?inline=true", headers=auth).get_json()["url"])
    assert "inline" in inline.headers["Content-Disposition"]
    assert client.get("/api/files/tampered-token").status_code == 403


def test_delete_removes_document_and_stored_file(client, auth, app, tmp_path):
    file_id = upload(client, auth, "a.txt", ASSIGNMENT.encode()).get_json()["file_id"]
    stored = list((tmp_path / "uploads").rglob("*.txt"))
    assert len(stored) == 1
    assert client.delete(f"/api/documents/{file_id}", headers=auth).status_code == 204
    assert client.get(f"/api/documents/{file_id}", headers=auth).status_code == 404
    assert not stored[0].exists()


def test_list_filters_sorting_and_pagination(client, auth):
    for sample in SAMPLES[:4]:
        file_id = upload(client, auth, sample["filename"].rsplit(".", 1)[0] + ".txt", sample["text"].encode()).get_json()["file_id"]
        approve_suggestions(client, auth, file_id)
    everything = client.get("/api/documents?per_page=2", headers=auth).get_json()
    assert everything["total"] == 4 and len(everything["items"]) == 2
    finance = client.get("/api/documents?category=Finance", headers=auth).get_json()
    assert [d["category"] for d in finance["items"]] == ["Finance"]
    by_name = client.get("/api/documents?sort=name&order=asc", headers=auth).get_json()["items"]
    assert [d["name"] for d in by_name] == sorted(d["name"] for d in by_name)
    assert client.get("/api/categories", headers=auth).get_json()[0]["count"] >= 1


@pytest.mark.skipif("ocr_available_flag()", reason="Tesseract is installed; this checks the no-OCR path")
def test_image_without_ocr_fails_with_clear_message(client, auth):
    buffer = io.BytesIO()
    Image.new("RGB", (200, 80), "white").save(buffer, format="PNG")
    file_id = upload(client, auth, "scan.png", buffer.getvalue()).get_json()["file_id"]
    analysis = client.get(f"/api/documents/{file_id}/analysis", headers=auth).get_json()
    assert analysis["status"] == "FAILED"
    assert "OCR" in analysis["error_message"]
    # The user can still enter details manually and store the file.
    res = client.post(f"/api/documents/{file_id}/approve", headers=auth, json={
        "title": "Receipt photo", "filename": "Receipt", "folder_path": ["Finance"], "category": "Finance"})
    assert res.status_code == 200 and res.get_json()["name"] == "Receipt.png"


def ocr_available_flag():
    app = create_app(TestConfig)
    with app.app_context():
        return ocr_available()


def test_reprocess_runs_pipeline_again(client, auth):
    file_id = upload(client, auth, "a.txt", ASSIGNMENT.encode()).get_json()["file_id"]
    res = client.post(f"/api/documents/{file_id}/reprocess", headers=auth)
    assert res.status_code == 202
    assert client.get(f"/api/documents/{file_id}/analysis", headers=auth).get_json()["status"] == "AWAITING_REVIEW"
