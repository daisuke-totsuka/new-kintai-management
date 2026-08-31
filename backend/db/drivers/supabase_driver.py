# Supabaseライブラリ
from supabase import create_client
from dotenv import load_dotenv
import os

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

    def find_all(self, table, filters=None):

        query = self.client.table(table).select("*")

        for key, value in (filters or {}).items():
            query = query.eq(key, value)

        result = query.execute()

        return result.data or []

    def insert(self, table, data):

        result = self.client.table(table).insert(data).execute()

        if result.data and len(result.data) == 1:
            return result.data[0]

        return result.data

    def update(self, table, filters, data):

        query = self.client.table(table).update(data)

        for key, value in filters.items():
            query = query.eq(key, value)

        result = query.execute()

        if result.data and len(result.data) == 1:
            return result.data[0]

        return result.data

    def delete(self, table, filters):

        query = self.client.table(table).delete()

        for key, value in filters.items():
            query = query.eq(key, value)

        result = query.execute()

        return result.data or []
