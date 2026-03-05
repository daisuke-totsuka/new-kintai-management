# DB接続取得関数をインポート
from db.connection import get_db


# PostgreSQLユーザーRepositoryクラス
class PostgresUserRepository:

    # コンストラクタ
    def __init__(self):

        # DB接続を取得
        self.conn = get_db()


    # 社員IDからユーザー取得
    def find_by_employee_id(self, employee_id):

        # DBカーソル作成
        cur = self.conn.cursor()

        # SQL実行
        cur.execute(
            """
            SELECT id, employee_id, email, password_hash, role
            FROM users
            WHERE employee_id = %s
            AND employment_status = 'ACTIVE'
            """,
            (employee_id,)  # SQLパラメータ（SQLインジェクション防止）
        )

        # 1件取得
        user = cur.fetchone()

        # カーソルを閉じる
        cur.close()

        # 取得結果を返す
        return user