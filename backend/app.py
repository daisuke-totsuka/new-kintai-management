from flask import Flask

# API
from api.login.login import login_bp

# config
from config.config import FLASK_HOST, FLASK_PORT

from flask_cors import CORS

# Flaskアプリ
app = Flask(__name__)

# API登録
app.register_blueprint(login_bp)

CORS(app)

# 起動
if __name__ == "__main__":

    app.run(
        host=FLASK_HOST,
        port=FLASK_PORT,
        debug=True
    )