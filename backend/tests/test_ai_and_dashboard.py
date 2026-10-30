"""TC-AI evaluation on the sample set, text helpers, dashboard and profile endpoints."""
import pytest

from app.api.auth import password_problems
from app.demo import SAMPLES, seed
from app.services.ai.local import LocalAnalyzer
from app.services.text import extract_keywords, summarise, tokenize
from conftest import approve_suggestions, upload

analyzer = LocalAnalyzer()


@pytest.mark.parametrize("sample", SAMPLES, ids=[s["filename"] for s in SAMPLES])
def test_local_analyzer_on_sample_documents(sample):
    result = analyzer.analyze(sample["text"], sample["filename"], [], ".txt")
    expect = sample["expect"]
    assert result.category == expect["category"]
    if "document_type" in expect:
        assert result.document_type == expect["document_type"]
    if "folder_contains" in expect:
        assert expect["folder_contains"] in result.suggested_folder_path
    assert result.title and result.summary and result.keywords
    assert result.suggested_filename.endswith(".txt")


def test_proposal_examples():
    """The examples given in the project proposal (FR-04, FR-05)."""
    scan = next(s for s in SAMPLES if s["filename"] == "scan001.pdf")
    result = analyzer.analyze(scan["text"], "scan001.pdf", [], ".pdf")
    assert result.title == "Network Technologies Assignment Report"
    assert {"IPv6", "Routing", "OSPF"} <= set(result.keywords)
    db = next(s for s in SAMPLES if s["filename"] == "Database_Assignment.pdf")
    result = analyzer.analyze(db["text"], "document123.pdf", [], ".pdf")
    assert result.suggested_filename == "Semester1_Database_Systems_Assignment.pdf"
    assert result.suggested_folder_path == ["University", "Year 2", "Semester 1", "Database Systems"]


def test_payslip_summary_names_employer_and_amount():
    text = ("Western Health Services\nPAYSLIP - Pay advice\nEmployee: Alex Chen\nGross pay $1,850.00\n"
            "Net pay $1,540.00\nPayment date: 16 October 2026. Salary paid into bank account ending 4821.")
    result = analyzer.analyze(text, "payslip_oct.txt", [], ".txt")
    assert (result.category, result.document_type) == ("Finance", "Payslip")
    assert result.suggested_folder_path == ["Finance", "Payslips", "2026"]
    assert result.summary.startswith("Payslip from Western Health Services for $1,540.00")


def test_too_little_text_is_uncategorised():
    result = analyzer.analyze("IMG 0042", "IMG_0042.jpg", [], ".jpg")
    assert result.category == "Uncategorised" and result.confidence < 0.6


def test_text_helpers():
    assert tokenize("Find my Semester One assignments") == ["find", "semester", "1", "assignment"]
    keywords = extract_keywords("Configure OSPF. OSPF areas reduce traffic. IPv6 subnets and IPv6 routing.")
    assert "OSPF" in keywords and "IPv6" in keywords
    assert summarise("Title\nThis sentence explains the main idea of the document clearly.") .startswith("This sentence")


def test_password_rules():
    assert password_problems("Passw0rd!") == []
    assert set(password_problems("abc")) >= {"at least 8 characters", "an uppercase letter", "a number"}


def test_dashboard_stats(client, auth):
    for sample in SAMPLES[:3]:
        file_id = upload(client, auth, sample["filename"].rsplit(".", 1)[0] + ".txt", sample["text"].encode()).get_json()["file_id"]
        approve_suggestions(client, auth, file_id)
    upload(client, auth, "pending.txt", SAMPLES[3]["text"].encode())  # left awaiting review
    stats = client.get("/api/dashboard/stats", headers=auth).get_json()
    assert stats["total_documents"] == 3
    assert stats["ai_classified"] == 3
    assert stats["awaiting_review"] == 1
    assert stats["storage_used_bytes"] > 0
    assert sum(c["count"] for c in stats["by_category"]) == 3
    assert len(stats["uploads_by_month"]) == 12 and stats["uploads_by_month"][-1]["uploaded"] == 4
    assert stats["recent_activity"][0]["action"] in ("UPLOAD", "APPROVE")


def test_profile_update(client, auth):
    res = client.patch("/api/users/me", headers=auth, json={"name": "New Name"})
    assert res.status_code == 200 and res.get_json()["name"] == "New Name"
    assert client.patch("/api/users/me", headers=auth, json={"email": "bad"}).status_code == 400
    me = client.get("/api/users/me", headers=auth).get_json()
    assert me["storage_quota_bytes"] > 0 and me["document_count"] == 0


def test_create_folder_and_conflict(client, auth):
    res = client.post("/api/folders", headers=auth, json={"name": "Projects"})
    assert res.status_code == 201
    child = client.post("/api/folders", headers=auth, json={"name": "Capstone", "parent_folder_id": res.get_json()["folder_id"]})
    assert child.get_json()["path"] == "Projects/Capstone"
    assert client.post("/api/folders", headers=auth, json={"name": "projects"}).status_code == 409


def test_seed_demo_creates_account_with_documents(app):
    user, added = seed("demo@fileai.test", "Demo@12345")
    assert added == len(SAMPLES)
    again_user, again_added = seed("demo@fileai.test", "Demo@12345")
    assert again_user.user_id == user.user_id and again_added == 0
