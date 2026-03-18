# Supabaseライブラリ
from supabase import create_client

# 設定
from config.config import SUPABASE_URL, SUPABASE_KEY


class SupabaseDriver:

    def __init__(self):

        # Supabaseクライアント作成
        self.client = create_client(
            SUPABASE_URL,
            SUPABASE_KEY
        )

    def find_one(self, table, filters):

        # select作成
        query = self.client.table(table).select("*")

        # フィルタ追加
        for key, value in filters.items():
            query = query.eq(key, value)

        # 実行
        result = query.execute()

        if result.data:
            return result.data[0]

        return None