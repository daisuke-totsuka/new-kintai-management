from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
import pytest
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from app import app
from common.auth import SECRET_KEY
from repositories.branch_repository import BranchRepository


def _numeric_branch_code(value):
    text = str(value or "").strip().upper()
    if text.startswith("B"):
        text = text[1:]
    if text.isdigit():
        return int(text)
    return 0


def _find_available_branch_code(rows):
    used_codes = {
        f"{_numeric_branch_code(row.get('branch_code')):03d}"
        for row in rows
        if _numeric_branch_code(row.get("branch_code"))
    }

    for number in range(900, 1000):
        branch_code = f"{number:03d}"
        if branch_code not in used_codes:
            return branch_code

    pytest.skip("結合テスト用に利用できるbranch_code(900-999)がありません")


def _operator_user(repo, fallback_employee_id):
    users = repo.db.find_all(table="users")
    for row in users:
        employee_id = row.get("employee_id")
        if employee_id:
            return str(employee_id), row.get("email") or "branch_operator@example.com"

    return fallback_employee_id, "branch_operator@example.com"


def _manager_employee_id(repo):
    users = repo.db.find_all(table="users")
    for row in users:
        employee_id = row.get("employee_id")
        if employee_id:
            return str(employee_id)

    pytest.skip("結合テスト用に利用できるusers.employee_idがありません")


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


def _client(repo, branch_code):
    operator_employee_id, operator_email = _operator_user(repo, branch_code)

    app.config["TESTING"] = True
    client = app.test_client()
    client.set_cookie(
        "access_token",
        _access_token(operator_email, operator_employee_id),
    )

    return client, operator_employee_id


def _test_branch_name(label):
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S%f")
    return f"IT Branch {label} {timestamp}"


def _insert_branch(repo, branch_code, branch_name, operator_employee_id):
    now = datetime.now(timezone.utc).isoformat()
    return repo.create({
        "branch_code": branch_code,
        "branch_name": branch_name,
        "is_active": True,
        "created_by": operator_employee_id,
        "created_at": now,
        "updated_by": operator_employee_id,
        "updated_at": now,
    })


def test_branch_search_integration(json_metadata):
    repo = BranchRepository()
    branch_code = _find_available_branch_code(repo.find_all())
    client, operator_employee_id = _client(repo, branch_code)
    branch_name = _test_branch_name("Search")

    _insert_branch(repo, branch_code, branch_name, operator_employee_id)
    json_metadata["input_employee_id"] = branch_code
    json_metadata["input_email"] = branch_name

    response = client.get(f"/branches/{branch_code}")

    assert response.status_code == 200, response.get_data(as_text=True)
    body = response.get_json()
    assert body["success"] is True
    assert body["branch"]["branch_code"] == branch_code
    assert body["branch"]["branch_name"] == branch_name


def test_branch_create_integration(json_metadata):
    repo = BranchRepository()
    branch_code = _find_available_branch_code(repo.find_all())
    client, operator_employee_id = _client(repo, branch_code)
    branch_name = _test_branch_name("Create")

    json_metadata["input_employee_id"] = branch_code
    json_metadata["input_email"] = branch_name

    response = client.post(
        "/branches",
        json={
            "branch_code": branch_code,
            "branch_name": branch_name,
            "is_active": True,
        },
    )

    assert response.status_code == 201, response.get_data(as_text=True)
    body = response.get_json()
    assert body["success"] is True
    assert body["branch"]["branch_code"] == branch_code
    assert body["branch"]["branch_name"] == branch_name
    assert body["branch"]["created_by"] == operator_employee_id

    created = repo.find_by_branch_code(branch_code)
    assert created is not None
    assert created["branch_name"] == branch_name
    assert created["is_active"] is True
    assert created["created_by"] == operator_employee_id
    assert created["updated_by"] == operator_employee_id


def test_branch_manager_create_integration(json_metadata):
    repo = BranchRepository()
    branch_code = _find_available_branch_code(repo.find_all())
    manager_employee_id = _manager_employee_id(repo)
    client, operator_employee_id = _client(repo, branch_code)
    branch_name = _test_branch_name("Manager")

    json_metadata["input_employee_id"] = manager_employee_id
    json_metadata["input_email"] = branch_name

    response = client.post(
        "/branches",
        json={
            "branch_code": branch_code,
            "branch_name": branch_name,
            "manager_employee_id": manager_employee_id,
            "is_active": True,
        },
    )

    assert response.status_code == 201, response.get_data(as_text=True)
    body = response.get_json()
    assert body["success"] is True
    assert body["branch"]["branch_code"] == branch_code
    assert body["branch"]["manager_employee_id"] == manager_employee_id
    assert body["branch"]["created_by"] == operator_employee_id

    created = repo.find_by_branch_code(branch_code)
    assert created is not None
    assert created["manager_employee_id"] == manager_employee_id


def test_branch_update_integration(json_metadata):
    repo = BranchRepository()
    branch_code = _find_available_branch_code(repo.find_all())
    client, operator_employee_id = _client(repo, branch_code)
    before_name = _test_branch_name("UpdateBefore")
    after_name = _test_branch_name("UpdateAfter")

    _insert_branch(repo, branch_code, before_name, operator_employee_id)
    json_metadata["input_employee_id"] = branch_code
    json_metadata["input_email"] = after_name

    response = client.put(
        f"/branches/{branch_code}",
        json={
            "branch_code": branch_code,
            "branch_name": after_name,
            "is_active": True,
        },
    )

    assert response.status_code == 200, response.get_data(as_text=True)
    body = response.get_json()
    assert body["success"] is True
    assert body["branch"]["branch_name"] == after_name
    assert body["branch"]["updated_by"] == operator_employee_id

    updated = repo.find_by_branch_code(branch_code)
    assert updated["branch_name"] == after_name
    assert updated["updated_by"] == operator_employee_id


def test_branch_delete_integration(json_metadata):
    repo = BranchRepository()
    branch_code = _find_available_branch_code(repo.find_all())
    client, operator_employee_id = _client(repo, branch_code)
    branch_name = _test_branch_name("Delete")

    _insert_branch(repo, branch_code, branch_name, operator_employee_id)
    json_metadata["input_employee_id"] = branch_code
    json_metadata["input_email"] = branch_name

    response = client.delete(f"/branches/{branch_code}")

    assert response.status_code == 200, response.get_data(as_text=True)
    body = response.get_json()
    assert body["success"] is True
    assert body["branch"]["is_active"] is False
    assert body["branch"]["updated_by"] == operator_employee_id

    deleted = repo.find_by_branch_code(branch_code)
    assert deleted["is_active"] is False
    assert deleted["updated_by"] == operator_employee_id
