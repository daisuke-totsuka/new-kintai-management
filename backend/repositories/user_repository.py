# DB接続
from db.connection import DBConnection

# Userモデル
from models.user import User


class UserRepository:
    """
    usersテーブル操作
    """

    def __init__(self):

        # DB接続
        self.db = DBConnection()

    def find_by_username(self, email):

        # usersテーブル検索
        row = self.db.find_one(
            table="users",
            filters={"email": email}
        )

        # モデル変換
        return User.from_dict(row)