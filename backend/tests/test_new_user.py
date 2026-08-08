import bcrypt

from app import app
from api.users import new_user


class FakeUserRepository:
    def __init__(self):
        self.created = []

    def get_next_user_id(self):
        return "0000000001"

    def get_next_employee_id(self):
        return "0000000002"

    def find_by_employee_id(self, employee_id):
        return None

    def find_by_email(self, email):
        if email == "admin@example.com":
            return {"employee_id": "0000000001"}
        return None

    def create(self, user):
        self.created.append(user)
        return user


def test_create_new_user_success(monkeypatch):
    repo = FakeUserRepository()

    monkeypatch.setattr(new_user, "UserRepository", lambda: repo)
    monkeypatch.setattr(
        new_user,
        "get_current_user",
        lambda: {"email": "admin@example.com", "employee_id": "0000000001"},
    )

    app.config["TESTING"] = True
    client = app.test_client()

    response = client.post(
        "/new_users",
        json={
            "name": "Test User",
            "email": "test.user@example.com",
            "password": "temporary-password",
            "employee_id": "0000000002",
            "role_id": "USER",
            "is_active": True,
            "branch_code": "001",
        },
    )

    assert response.status_code == 201
    body = response.get_json()
    assert body["success"] is True
    assert body["user"]["id"] == "0000000001"
    assert body["user"]["employee_id"] == "0000000002"
    assert "password_hash" not in body["user"]

    assert len(repo.created) == 1
    created_user = repo.created[0]
    assert created_user["role_id"] == "USER"
    assert created_user["branch_code"] == "001"
    assert created_user["created_by"] == "0000000001"
    assert created_user["updated_by"] == "0000000001"
    assert created_user["password_hash"] != "temporary-password"
    assert bcrypt.checkpw(
        "temporary-password".encode("utf-8"),
        created_user["password_hash"].encode("utf-8"),
    )
