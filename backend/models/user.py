class User:
    """
    Userデータモデル
    """

    def __init__(self, id, username, password, email):

        self.id = id
        self.username = username
        self.password = password
        self.email = email

    @classmethod
    def from_dict(cls, data):

        if not data:
            return None

        return cls(
            data["id"],
            data["name"],
            data["password_hash"],
            data["email"]
        )