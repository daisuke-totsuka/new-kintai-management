from flask import Blueprint, jsonify
from common.auth import get_current_user

auth_bp = Blueprint("auth", __name__)

@auth_bp.route("/me", methods=["GET"])
def me():
    user = get_current_user()

    if not user:
        return jsonify({
            "authenticated": False
        }), 401

    return jsonify({
        "authenticated": True,
        "user": user
    })