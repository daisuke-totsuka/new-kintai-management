from flask import Blueprint, request, jsonify

from services.auth_service import AuthService
import os
from flask_cors import CORS

import jwt
import datetime
from flask import make_response

from common.auth import SECRET_KEY

# Blueprint作成
login_bp = Blueprint("login", __name__)

# Service生成
service = AuthService()

#IS_PROD = os.getenv("ENV") == "production"
IS_PROD = os.getenv("IS_PROD", "false").lower() == "true"

@login_bp.route("/login", methods=["POST"])
def login():
    print("logi nAPI called")
 
    try:
       
       data = request.get_json()

       if data is None:
          return jsonify({"error": "Invalid JSON"}), 400
        
       email    = data.get("email")
       password = data.get("password")

       if not email or not password:
            return jsonify({"error": "Missing fields"}), 400
        
       user = service.login(email, password)
        
       if not user:
            return jsonify({"success": False}), 401
       
       # JWT生成
       token = jwt.encode({
          "user_id": user.id,
          "email": email,
          "employee_id": user.employee_id,
          "role_id": user.role_id,
          "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1)
       }, SECRET_KEY, algorithm="HS256")

       # Cookieにセット
       response = make_response(jsonify({
          "success": True,
          "user_id": user.id,
          "employee_id": user.employee_id,
          "email": user.email,
          "role_id": user.role_id
       }))
       
       response.set_cookie(
          "access_token",
          token,
          httponly=True,
          secure=IS_PROD,
          #secure=False,
          samesite="None" if IS_PROD else "Lax",
          #samesite="Lax" if IS_PROD else "None",
          max_age=3600
       )

       return response
            
       #return jsonify({
       #     "success": True,
       #     "user_id": user.id,
       #     "email"  : user.email
       #})
    
    except Exception as e:
        print("ERROR:", e)   # ←これ重要
        return jsonify({"error": "Server error"}), 500
