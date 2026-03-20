from flask import Blueprint, request, jsonify

from services.auth_service import AuthService

# Blueprint作成
login_bp = Blueprint("login", __name__)

# Service生成
service = AuthService()


@login_bp.route("/login", methods=["POST"])
def login():
    print("login API called")

    data = request.json

    email    = data.get("email")
    password = data.get("password")

    user = service.login(email, password)

    if not user:
        return jsonify({"success": False}), 401

    return jsonify({
        "success": True,
        "user_id": user.id,
        "email"  : user.email
    })