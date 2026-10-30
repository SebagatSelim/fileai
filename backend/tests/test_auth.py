"""TC-AUTH: registration and login (FR-01, UC-01, UC-02, NFR-02)."""
import pytest

from app.models import User
from conftest import PASSWORD, login, register


def test_register_success(client):
    res = register(client)
    assert res.status_code == 201
    assert res.get_json()["user_id"] > 0


def test_password_is_stored_as_bcrypt_hash(client, app):
    register(client)
    user = User.query.filter_by(email="user@example.com").one()
    assert user.password_hash.startswith("$2") and PASSWORD not in user.password_hash


@pytest.mark.parametrize("password, rule", [
    ("Sh0rt!", "8 characters"),
    ("passw0rd!", "uppercase"),
    ("PASSW0RD!", "lowercase"),
    ("Password!", "number"),
    ("Passw0rd1", "special"),
    ("Passw0rd 1", "special"),  # a space is not a special character
])
def test_register_rejects_weak_passwords(client, password, rule):
    res = register(client, password=password)
    assert res.status_code == 400
    body = res.get_json()["error"]
    assert body["code"] == "VALIDATION_ERROR"
    assert rule in body["message"]


def test_register_rejects_duplicate_email_case_insensitive(client):
    register(client, email="dup@example.com")
    res = register(client, email="DUP@Example.com")
    assert res.status_code == 409
    assert res.get_json()["error"]["code"] == "EMAIL_EXISTS"


@pytest.mark.parametrize("email", ["", "not-an-email", "a@b", "a b@c.com"])
def test_register_rejects_invalid_email(client, email):
    assert register(client, email=email).status_code == 400


def test_register_requires_name(client):
    assert register(client, name="  ").status_code == 400


def test_login_returns_token_and_user(client):
    register(client)
    res = login(client)
    assert res.status_code == 200
    body = res.get_json()
    assert body["access_token"] and body["expires_in"] == 1800
    assert body["user"]["email"] == "user@example.com"


def test_login_errors_do_not_reveal_which_emails_exist(client):
    register(client)
    wrong_password = login(client, password="Wrong!Pass1").get_json()["error"]["message"]
    unknown_email = login(client, email="nobody@example.com").get_json()["error"]["message"]
    assert wrong_password == unknown_email == "Invalid email or password."


def test_login_locks_out_after_repeated_failures(client):
    register(client)
    for _ in range(5):
        assert login(client, password="Wrong!Pass1").status_code == 401
    res = login(client)  # even the right password is blocked for a while
    assert res.status_code == 429


def test_protected_endpoints_require_a_valid_token(client):
    assert client.get("/api/auth/me").status_code == 401
    res = client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert res.status_code == 401
    assert res.get_json()["error"]["code"] == "UNAUTHORIZED"


def test_me_returns_current_user(client, auth):
    res = client.get("/api/auth/me", headers=auth)
    assert res.status_code == 200
    assert res.get_json()["name"] == "Test User"


def test_change_password(client, auth):
    bad = client.put("/api/users/me/password", headers=auth,
                     json={"current_password": "Wrong!Pass1", "new_password": "N3w!Password"})
    assert bad.status_code == 401
    weak = client.put("/api/users/me/password", headers=auth,
                      json={"current_password": PASSWORD, "new_password": "weak"})
    assert weak.status_code == 400
    ok = client.put("/api/users/me/password", headers=auth,
                    json={"current_password": PASSWORD, "new_password": "N3w!Password"})
    assert ok.status_code == 204
    assert login(client, password="N3w!Password").status_code == 200
