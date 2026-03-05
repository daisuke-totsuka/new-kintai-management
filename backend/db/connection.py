# OS環境変数を取得するためのモジュール
import os


# DB接続を取得する関数
def get_db():

    # 環境変数からDB種類を取得
    db_type = os.getenv("DB_TYPE")

    # PostgreSQLの場合
    if db_type == "postgres":

        # PostgreSQL接続関数をインポート
        from db.postgres import get_postgres_conn

        # PostgreSQL接続を返す
        return get_postgres_conn()

    # Oracleの場合
    elif db_type == "oracle":

        # Oracle接続関数をインポート
        from db.oracle import get_oracle_conn

        # Oracle接続を返す
        return get_oracle_conn()

    # 未対応DBの場合は例外
    else:
        raise Exception("Unsupported DB_TYPE")