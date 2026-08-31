from datetime import datetime, timedelta, timezone

import jwt
import pytest

from api.login import login as login_api
from app import app
from common import auth as common_auth
from routes import auth as auth_route


class FakeUserRepository:
    def __init__(self, user=None):
        self.user = user

    def find_by_email(self, email):
        if self.user and self.user.get("email") == email:
            return dict(self.user)
        return None

    def find_by_employee_id(self, employee_id):
        if self.user and self.user.get("employee_id") == employee_id:
            return dict(self.user)
        return None


def _access_token(payload):
    token = jwt.encode(
        {
            **payload,
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        },
        "test-secret",
        algorithm="HS256",
    )

    if isinstance(token, bytes):
        return token.decode("utf-8")
    return token


def _client(monkeypatch, db_user=None, token_payload=None):
    monkeypatch.setattr(common_auth, "SECRET_KEY", "test-secret")
    monkeypatch.setattr(
        auth_route,
        "UserRepository",
        lambda: FakeUserRepository(db_user),
    )

    app.config["TESTING"] = True
    client = app.test_client()
    client.set_cookie(
        "access_token",
        _access_token(
            token_payload
            or {
                "email": "testuser@example.com",
                "employee_id": "EMP001",
            }
        ),
    )
    return client


def test_auth_me_uses_db_role_id(monkeypatch):
    client = _client(
        monkeypatch,
        db_user={
            "email": "testuser@example.com",
            "employee_id": "EMP001",
            "role_id": "ADMIN_ACCOUNTING",
        },
    )

    response = client.get("/auth/me")

    assert response.status_code == 200
    body = response.get_json()
    assert body == {
        "authenticated": True,
        "user": {
            "user_id": None,
            "email": "testuser@example.com",
            "employee_id": "EMP001",
            "exp": body["user"]["exp"],
            "role_id": "ADMIN_ACCOUNTING",
        },
    }


def test_auth_me_uses_token_role_id_when_db_role_id_is_missing(monkeypatch):
    client = _client(
        monkeypatch,
        token_payload={
            "email": "testuser@example.com",
            "employee_id": "EMP001",
            "role_id": "ADMIN",
        },
    )

    response = client.get("/auth/me")

    assert response.status_code == 200
    body = response.get_json()
    assert body["user"]["role_id"] == "ADMIN"


def test_auth_me_returns_null_when_role_id_is_missing(monkeypatch):
    client = _client(monkeypatch)

    response = client.get("/auth/me")

    assert response.status_code == 200
    body = response.get_json()
    assert body["user"]["role_id"] is None


def test_login_response_includes_role_id(monkeypatch):
    class FakeLoginService:
        def login(self, email, password):
            if email != "testuser@example.com" or password != "password":
                return None

            class User:
                id = "1"
                employee_id = "EMP001"
                email = "testuser@example.com"
                role_id = "ADMIN_ACCOUNTING"

            return User()

    monkeypatch.setattr(login_api, "service", FakeLoginService())
    monkeypatch.setattr(login_api, "SECRET_KEY", "test-secret-key-with-enough-length")

    app.config["TESTING"] = True
    client = app.test_client()

    response = client.post(
        "/login",
        json={
            "email": "testuser@example.com",
            "password": "password",
        },
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["success"] is True
    assert body["email"] == "testuser@example.com"
    assert body["employee_id"] == "EMP001"
    assert body["role_id"] == "ADMIN_ACCOUNTING"


@pytest.mark.parametrize(
    "role_id,email",
    [
        ("ADMIN", "test.admin@example.com"),
        ("ACCOUNTING", "test.accounting@example.com"),
        ("ADMIN_ACCOUNTING", "test.admin.accounting@example.com"),
        ("USER", "test.user@example.com"),
    ],
)
def test_login_response_includes_role_id_for_test_roles(monkeypatch, role_id, email):
    class FakeLoginService:
        def login(self, login_email, password):
            if login_email != email or password != "password":
                return None

            class User:
                pass

            user = User()
            user.id = "9000000000"
            user.employee_id = "9000000000"
            user.email = login_email
            user.role_id = role_id

            return user

    monkeypatch.setattr(login_api, "service", FakeLoginService())
    monkeypatch.setattr(login_api, "SECRET_KEY", "test-secret-key-with-enough-length")

    app.config["TESTING"] = True
    client = app.test_client()

    response = client.post(
        "/login",
        json={
            "email": email,
            "password": "password",
        },
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["success"] is True
    assert body["email"] == email
    assert body["employee_id"] == "9000000000"
    assert body["role_id"] == role_id
