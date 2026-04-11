import os
from dotenv import load_dotenv
load_dotenv()
from flask import Flask

# API
from api.login.login import login_bp

# config
from config.config import FLASK_HOST, FLASK_PORT

# Flaskアプリ
app = Flask(__name__)

from flask_cors import CORS
from routes.auth import auth_bp
#CORS(app)
#CORS(app, resources={r"/*": {"origins": "*"}})

origins = os.getenv("CORS_ORIGINS", "") 
origins_list = [o.strip() for o in origins.split(",")] 

CORS( 
    app, 
    resources={r"/*": {"origins": origins_list}}, 
    supports_credentials=True 
)

#CORS(
#    app,
#    resources={r"/*": {"origins": "http://localhost:3000"}},
#    supports_credentials=True
#)

# API登録
app.register_blueprint(auth_bp, url_prefix="/auth")
app.register_blueprint(login_bp)

# 起動
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
#if __name__ == "__main__":

    #app.run(
        #host=FLASK_HOST,
        #port=FLASK_PORT,
        #debug=True
    #)