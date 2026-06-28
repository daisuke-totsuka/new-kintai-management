from flask import Blueprint, jsonify

from services.role_service import RoleService


role_bp = Blueprint("role", __name__)


@role_bp.route("/roles", methods=["GET"])
def list_roles():
    service = RoleService()
    return jsonify({
        "success": True,
        "roles": service.list_roles(),
    })
