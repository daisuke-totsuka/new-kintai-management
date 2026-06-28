from flask import Blueprint, jsonify
from common.auth import get_current_user
from repositories.user_repository import UserRepository
from services.role_service import resolve_role_code

auth_bp = Blueprint("auth", __name__)


def _first_value(data, *keys):
    if not data:
        return None

    for key in keys:
        value = data.get(key)
        if value is not None:
            return value

    return None


@auth_bp.route("/me", methods=["GET"])
def me():
    user = get_current_user()

    if not user:
        return jsonify({
            "authenticated": False
        }), 401

    enriched_user = dict(user)
    db_user = None

    try:
        repo = UserRepository()

        if enriched_user.get("email"):
            db_user = repo.find_by_email(enriched_user["email"])

        if not db_user and enriched_user.get("employee_id"):
            db_user = repo.find_by_employee_id(enriched_user["employee_id"])
    except Exception:
        db_user = None

    role_code = resolve_role_code(
        role_id=(
            _first_value(db_user, "role_id", "roleId")
            or _first_value(enriched_user, "role_id", "roleId")
        ),
        role=(
            _first_value(db_user, "role")
            or _first_value(enriched_user, "role")
        ),
        default="ADMIN",
    )

    enriched_user["role_id"] = role_code
    enriched_user["role"] = role_code

    return jsonify({
        "authenticated": True,
        "user": enriched_user
    })
