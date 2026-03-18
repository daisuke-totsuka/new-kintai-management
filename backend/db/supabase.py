from supabase import create_client
import os


class SupabaseDB:

    def __init__(self):

        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")

        self.client = create_client(url, key)

    def find_one(self, table, filters):

        query = self.client.table(table).select("*")

        for key, value in filters.items():
            query = query.eq(key, value)

        result = query.execute()

        if result.data:
            return result.data[0]

        return None