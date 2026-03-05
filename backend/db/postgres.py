# PostgreSQL接続用ライブラリ
import psycopg2

# 環境変数取得用
import os


# PostgreSQL接続を生成する関数
def get_postgres_conn():

    # PostgreSQL接続オブジェクト生成
    conn = psycopg2.connect(

        # DBホスト取得
        host=os.getenv("DB_HOST"),

        # DBポート取得
        port=os.getenv("DB_PORT"),

        # DBユーザー取得
        user=os.getenv("DB_USER"),

        # DBパスワード取得
        password=os.getenv("DB_PASSWORD"),

        # DB名取得
        dbname=os.getenv("DB_NAME"),
    )

    # 接続オブジェクトを返す
    return conn