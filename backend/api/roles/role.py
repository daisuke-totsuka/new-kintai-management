from flask import Blueprint, jsonify, request

from common.auth import get_current_user
from services.role_service import RoleService, normalize_role_id


role_bp = Blueprint("role", __name__)


def _operator_employee_id():
    current_user = get_current_user()
    if not current_user:
        return None
    return current_user.get("employee_id")


@role_bp.route("/roles", methods=["GET"])
def list_roles():
    service = RoleService()
    return jsonify({
        "success": True,
        "roles": service.list_roles(request.args),
    })


@role_bp.route("/roles/<role_id>", methods=["GET"])
def get_role(role_id):
    service = RoleService()
    role = service.get_role(role_id)
    if not role:
        return jsonify({"error": "Role not found"}), 404
    return jsonify({
        "success": True,
        "role": role,
    })


@role_bp.route("/roles", methods=["POST"])
def create_role():
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Invalid JSON"}), 400

    operator_employee_id = _operator_employee_id()
    if not operator_employee_id:
        return jsonify({"error": "Unauthorized"}), 401

    service = RoleService()
    body, status = service.create_role(data, operator_employee_id)
    return jsonify(body), status


@role_bp.route("/roles/<role_id>", methods=["PUT"])
def update_role(role_id):
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Invalid JSON"}), 400

    operator_employee_id = _operator_employee_id()
    if not operator_employee_id:
        return jsonify({"error": "Unauthorized"}), 401

    service = RoleService()
    body, status = service.update_role(role_id, data, operator_employee_id)
    return jsonify(body), status


@role_bp.route("/menus", methods=["GET"])
def list_menus():
    service = RoleService()
    return jsonify({
        "success": True,
        "menus": service.list_menus(),
    })


@role_bp.route("/roles/<role_id>/menus", methods=["GET"])
def get_role_menus(role_id):
    service = RoleService()
    menus = service.get_role_menus(role_id)
    if menus is None:
        return jsonify({"error": "Role not found"}), 404
    return jsonify({
        "success": True,
        "role_id": normalize_role_id(role_id),
        "menus": menus,
    })
