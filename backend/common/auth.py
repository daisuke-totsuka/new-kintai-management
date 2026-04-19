# backend/common/auth.py

import jwt
from flask import request
from dotenv import load_dotenv
import os

load_dotenv() 

#SECRET_KEY = "your-secret"
SECRET_KEY = os.getenv("SECRET_KEY")

def get_current_user():
    print("🔥 cookies:", request.cookies)

    token = request.cookies.get("access_token")
    print("🔥 token:", token)

    if not token:
        return None

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        print("🔥 payload:", payload)
        return payload
        #return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except Exception as e:
        print("🔥 error:", e)
        return None