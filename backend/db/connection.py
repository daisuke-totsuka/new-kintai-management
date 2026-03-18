# DBタイプ設定を取得
from config.config import DB_TYPE

# 各DBドライバ
from db.drivers.supabase_driver import SupabaseDriver
# from db.drivers.postgres_driver import PostgresDriver
# from db.drivers.oracle_driver import OracleDriver
# from db.drivers.sqlserver_driver import SqlServerDriver


class DBConnection:
    """
    DB接続の共通クラス
    DB種類ごとにドライバを切替する
    """

    def __init__(self):

        # DB種類によってドライバを切替
        if DB_TYPE == "supabase":
            self.driver = SupabaseDriver()

        elif DB_TYPE == "postgres":
            self.driver = PostgresDriver()

        elif DB_TYPE == "oracle":
            self.driver = OracleDriver()

        elif DB_TYPE == "sqlserver":
            self.driver = SqlServerDriver()

        else:
            raise Exception("Unknown DB type")

    def find_one(self, table, filters):
        """
        1件検索
        """
        return self.driver.find_one(table, filters)