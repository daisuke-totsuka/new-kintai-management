# Repository
from repositories.user_repository import UserRepository
import bcrypt


class AuthService:
    """
    認証ロジック
    """

    def __init__(self):

        self.repo = UserRepository()

    def login(self, email, password):

        # ユーザー取得
        user = self.repo.find_by_username(email)

        #if not user:
        if not user:
            return None

        # bcryptパスワードチェック
        if not bcrypt.checkpw(
            password.encode("utf-8"),
            user.password.encode("utf-8")
        ):
            return None

        return user