from flask import Blueprint, jsonify, request

from common.auth import get_current_user
from services.branch_service import BranchService


branch_bp = Blueprint("branch", __name__)


def _operator_employee_id():
    current_user = get_current_user()
    if not current_user:
        return None
    return current_user.get("employee_id")


@branch_bp.route("/branches", methods=["GET"])
def list_branches():
    service = BranchService()
    return jsonify({
        "success": True,
        "branches": service.list_branches(request.args),
    })


@branch_bp.route("/branches/next-branch-code", methods=["GET"])
def next_branch_code():
    service = BranchService()
    try:
        branch_code = service.get_next_branch_code()
    except ValueError as error:
        return jsonify({"error": str(error)}), 409

    return jsonify({
        "success": True,
        "branch_code": branch_code,
    })


@branch_bp.route("/branches/<branch_code>", methods=["GET"])
def get_branch(branch_code):
    service = BranchService()
    branch = service.get_branch(branch_code)
    if not branch:
        return jsonify({"error": "Branch not found"}), 404
    return jsonify({
        "success": True,
        "branch": branch,
    })


@branch_bp.route("/branches", methods=["POST"])
def create_branch():
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Invalid JSON"}), 400

    operator_employee_id = _operator_employee_id()
    if not operator_employee_id:
        return jsonify({"error": "Unauthorized"}), 401

    service = BranchService()
    body, status = service.create_branch(data, operator_employee_id)
    return jsonify(body), status


@branch_bp.route("/branches/<branch_code>", methods=["PUT"])
def update_branch(branch_code):
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Invalid JSON"}), 400

    operator_employee_id = _operator_employee_id()
    if not operator_employee_id:
        return jsonify({"error": "Unauthorized"}), 401

    service = BranchService()
    body, status = service.update_branch(branch_code, data, operator_employee_id)
    return jsonify(body), status


@branch_bp.route("/branches/<branch_code>", methods=["DELETE"])
def delete_branch(branch_code):
    operator_employee_id = _operator_employee_id()
    if not operator_employee_id:
        return jsonify({"error": "Unauthorized"}), 401

    service = BranchService()
    body, status = service.delete_branch(branch_code, operator_employee_id)
    return jsonify(body), status
