# OSの環境変数を扱う
import os

# .envを読み込む
from dotenv import load_dotenv

# .envファイルを読み込む
load_dotenv()

# DB種類取得
DB_TYPE = os.getenv("DB_TYPE", "supabase")

# Supabase接続情報
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Flask設定
FLASK_HOST = os.getenv("FLASK_HOST", "0.0.0.0")
FLASK_PORT = int(os.getenv("FLASK_PORT", 5000))