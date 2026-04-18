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


#@login_bp.route("/login", methods=["POST"])
#@login_bp.route("/login", methods=["POST", "OPTIONS"])
@login_bp.route("/login", methods=["POST"])
def login():
    print("logi nAPI called")
    
    #if request.method == "OPTIONS":
        #return jsonify({"message": "ok"}), 200
        #data = request.json
 
    try:
       #data = request.get_json(silent=True)
       
       #if not data:
            #return jsonify({"error": "Invalid JSON"}), 400
       
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
          "email": email,
          "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1)
       }, SECRET_KEY, algorithm="HS256")

       # Cookieにセット
       response = make_response(jsonify({
          "success": True,
          "user_id": user.id,
          "email": user.email
       }))

       response.set_cookie(
          "access_token",
          token,
          httponly=True,
          secure=True,        # 本番のみ
          samesite="None",
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