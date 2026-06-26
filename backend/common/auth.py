# backend/common/auth.py

import jwt
from flask import request
from dotenv import load_dotenv
import os

load_dotenv() 

#SECRET_KEY = "your-secret"
SECRET_KEY = os.getenv("SECRET_KEY")

def get_current_user():
    token = request.cookies.get("access_token")

    if not token:
        return None

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload
        #return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except Exception:
        return None
