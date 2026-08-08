from datetime import datetime, timedelta, timezone
from pathlib import Path

import bcrypt
import jwt
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from app import app
from common.auth import SECRET_KEY
from repositories.user_repository import UserRepository


def _numeric_employee_id(value):
    text = str(value or "").strip()
    if text.isdigit():
        return int(text)
    return 0


def _next_employee_id(rows):
    current_max = max(
        (_numeric_employee_id(row.get("employee_id")) for row in rows),
        default=0,
    )
    return f"{current_max + 1:010d}"


def _operator_user(rows, fallback_employee_id):
    for row in rows:
        employee_id = row.get("employee_id")
        if employee_id:
            return str(employee_id), row.get("email") or "integration_operator@example.com"

    return fallback_employee_id, "integration_operator@example.com"


def _access_token(email, employee_id):
    assert SECRET_KEY, "SECRET_KEY is required for integration tests"

    token = jwt.encode(
        {
            "email": email,
            "employee_id": employee_id,
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        },
        SECRET_KEY,
        algorithm="HS256",
    )

    if isinstance(token, bytes):
        return token.decode("utf-8")
    return token


def test_create_new_user_integration_success(json_metadata):
    repo = UserRepository()
    existing_users = repo.db.find_all(table="users")
    employee_id = _next_employee_id(existing_users)
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    email = f"integration_test_{timestamp}@example.com"
    password = "temporary-password"
    operator_employee_id, operator_email = _operator_user(existing_users, employee_id)

    json_metadata["input_employee_id"] = employee_id
    json_metadata["input_email"] = email
    json_metadata["created_by"] = operator_employee_id
    json_metadata["updated_by"] = operator_employee_id

    app.config["TESTING"] = True
    client = app.test_client()
    client.set_cookie(
        "access_token",
        _access_token(operator_email, operator_employee_id),
    )

    response = client.post(
        "/new_users",
        json={
            "name": "Integration Test User",
            "email": email,
            "password": password,
            "employee_id": employee_id,
            "role_id": "USER",
            "is_active": True,
            "branch_code": "001",
        },
    )

    assert response.status_code == 201, response.get_data(as_text=True)
    body = response.get_json()
    assert body["success"] is True
    assert body["user"]["employee_id"] == employee_id
    assert body["user"]["email"] == email
    assert "password_hash" not in body["user"]

    created_user = repo.find_by_employee_id(employee_id)
    assert created_user is not None
    assert created_user["employee_id"] == employee_id
    assert created_user["email"] == email
    assert created_user["password_hash"]
    assert created_user["password_hash"] != password
    assert bcrypt.checkpw(
        password.encode("utf-8"),
        created_user["password_hash"].encode("utf-8"),
    )
    assert created_user["created_by"] == operator_employee_id
    assert created_user["updated_by"] == operator_employee_id

    created_user_by_email = repo.find_by_email(email)
    assert created_user_by_email is not None
    assert created_user_by_email["employee_id"] == employee_id
