class Role:
    def __init__(self, role_id, role_name, description="", is_active=True):
        self.role_id = role_id
        self.role_name = role_name
        self.description = description
        self.is_active = is_active

    @classmethod
    def from_dict(cls, data):
        if not data:
            return None

        return cls(
            data["role_id"],
            data["role_name"],
            data.get("description", ""),
            data.get("is_active", True),
        )

    def to_dict(self):
        return {
            "role_id": self.role_id,
            "role_name": self.role_name,
            "description": self.description,
            "is_active": self.is_active,
        }
