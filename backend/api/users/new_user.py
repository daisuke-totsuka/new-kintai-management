from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
import bcrypt

from common.auth import get_current_user
from repositories.user_repository import UserRepository
from services.role_service import normalize_role_id


new_user_bp = Blueprint("new_user", __name__)


def _first_value(data, *keys, default=None):
    for key in keys:
        value = data.get(key)
        if value is not None:
            return value
    return default


def _first_non_blank(data, *keys, default=None):
    for key in keys:
        value = data.get(key)
        if value is not None and str(value).strip() != "":
            return value
    return default


def _normalize_optional_text(value):
    if value is None:
        return None

    text = str(value).strip()
    return text or None


def _sanitize_user_response(user):
    allowed_keys = (
        "id",
        "employee_id",
        "email",
        "name",
        "role_id",
        "branch_code",
        "is_active",
        "is_admin",
        "is_accounting",
        "kana_name",
        "created_at",
        "created_by",
        "updated_at",
        "updated_by",
    )
    return {
        key: user[key]
        for key in allowed_keys
        if key in user
    }


def _role_value(data, default=None):
    return _first_non_blank(
        data,
        "role_id",
        "roleId",
        default=default,
    )


def _get_operator_employee_id(repo):
    current_user = get_current_user()

    if not current_user:
        return None

    employee_id = current_user.get("employee_id")
    if employee_id:
        return employee_id

    email = current_user.get("email")
    if not email:
        return None

    user = repo.find_by_email(email)
    if not user:
        return None

    return user.get("employee_id")


@new_user_bp.route("/new_users/next-employee-id", methods=["GET"])
def next_employee_id():
    repo = UserRepository()
    return jsonify({
        "employee_id": repo.get_next_employee_id()
    })


@new_user_bp.route("/users/search", methods=["GET"])
def search_users():
    repo = UserRepository()
    return jsonify({
        "success": True,
        "users": repo.search_users(
            employee_id=request.args.get("employee_id"),
            name=request.args.get("name"),
            email=request.args.get("email"),
        ),
    })


@new_user_bp.route("/users/<employee_id>", methods=["PUT"])
def update_user(employee_id):
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Invalid JSON"}), 400

    repo = UserRepository()
    operator_employee_id = _get_operator_employee_id(repo)
    if not operator_employee_id:
        return jsonify({"error": "Unauthorized"}), 401

    current = repo.find_by_employee_id(employee_id)
    if not current:
        return jsonify({"error": "User not found"}), 404

    name = _first_value(data, "name", "username", default=current.get("name"))
    email = _first_value(data, "email", default=current.get("email"))

    if not name or not email:
        return jsonify({"error": "Missing fields"}), 400

    duplicated_email = repo.find_by_email(email)
    if duplicated_email and str(duplicated_email.get("employee_id")) != str(employee_id):
        return jsonify({"error": "Email already exists"}), 409

    try:
        role_id = normalize_role_id(
            _role_value(data, default=current.get("role_id"))
        )
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    if not role_id:
        return jsonify({"error": "Role is required"}), 400

    is_active = _first_value(
        data,
        "is_active",
        "isActive",
        default=current.get("is_active", True),
    )

    user = {
        "name": name,
        "email": email,
        "role_id": role_id,
        "is_active": is_active,
        "branch_code": _normalize_optional_text(
            _first_value(
                data,
                "branch_code",
                "branchCode",
                "branchId",
                default=current.get("branch_code"),
            )
        ),
        "updated_by": operator_employee_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    password = _first_value(data, "password", "temp_password", "tempPassword")
    if password:
        user["password_hash"] = bcrypt.hashpw(
            password.encode("utf-8"),
            bcrypt.gensalt()
        ).decode("utf-8")

    updated_user = repo.update_by_employee_id(employee_id, user)
    response_user = dict(current)
    response_user.update(updated_user or user)
    response_user = _sanitize_user_response(response_user)

    return jsonify({
        "success": True,
        "user": response_user
    })


@new_user_bp.route("/users/<employee_id>", methods=["DELETE"])
def disable_user(employee_id):
    repo = UserRepository()
    operator_employee_id = _get_operator_employee_id(repo)
    if not operator_employee_id:
        return jsonify({"error": "Unauthorized"}), 401

    current = repo.find_by_employee_id(employee_id)
    if not current:
        return jsonify({"error": "User not found"}), 404

    user = {
        "is_active": False,
        "updated_by": operator_employee_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    updated_user = repo.update_by_employee_id(employee_id, user)
    response_user = dict(current)
    response_user.update(updated_user or user)
    response_user = _sanitize_user_response(response_user)

    return jsonify({
        "success": True,
        "user": response_user
    })


@new_user_bp.route("/new_users", methods=["POST"])
def create_new_user():
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Invalid JSON"}), 400

    name = _first_value(data, "name", "username")
    email = data.get("email")
    password = _first_value(data, "password", "temp_password", "tempPassword")

    if not name or not email or not password:
        return jsonify({"error": "Missing fields"}), 400

    repo = UserRepository()
    operator_employee_id = _get_operator_employee_id(repo)
    if not operator_employee_id:
        return jsonify({"error": "Unauthorized"}), 401

    employee_id = _first_value(
        data,
        "employee_id",
        "employeeId",
        "employeeCode"
    )
    if not employee_id:
        employee_id = repo.get_next_employee_id()

    if repo.find_by_employee_id(employee_id):
        return jsonify({"error": "Employee ID already exists"}), 409

    if repo.find_by_email(email):
        return jsonify({"error": "Email already exists"}), 409

    try:
        role_id = normalize_role_id(_role_value(data))
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    if not role_id:
        return jsonify({"error": "Role is required"}), 400

    password_hash = bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt()
    ).decode("utf-8")
    now = datetime.now(timezone.utc).isoformat()

    user = {
        "id": repo.get_next_user_id(),
        "employee_id": employee_id,
        "name": name,
        "email": email,
        "password_hash": password_hash,
        "role_id": role_id,
        "is_active": _first_value(
            data,
            "is_active",
            "isActive",
            default=True,
        ),
        "branch_code": _normalize_optional_text(
            _first_value(data, "branch_code", "branchCode", "branchId")
        ),
        "created_by": operator_employee_id,
        "created_at": now,
        "updated_by": operator_employee_id,
        "updated_at": now,
    }

    created_user = repo.create(user)

    response_user = _sanitize_user_response(created_user or user)

    return jsonify({
        "success": True,
        "user": response_user
    }), 201
