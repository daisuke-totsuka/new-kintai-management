from services.role_service import resolve_role_code


class User:
    """
    Userデータモデル
    """

    def __init__(
        self,
        id,
        username,
        password,
        email,
        employee_id=None,
        role="USER",
        role_id=None,
    ):

        self.id = id
        self.username = username
        self.password = password
        self.email = email
        self.employee_id = employee_id
        self.role_id = resolve_role_code(role_id, role)
        self.role = self.role_id

    @classmethod
    def from_dict(cls, data):

        if not data:
            return None

        return cls(
            data["id"],
            data["name"],
            data["password_hash"],
            data["email"],
            data.get("employee_id"),
            data.get("role", "USER"),
            data.get("role_id") or data.get("roleId")
        )
