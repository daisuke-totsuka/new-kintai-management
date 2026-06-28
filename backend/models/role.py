class Role:
    def __init__(self, role_code, role_name, description="", display_order=0):
        self.role_code = role_code
        self.role_name = role_name
        self.description = description
        self.display_order = display_order

    @classmethod
    def from_dict(cls, data):
        if not data:
            return None

        return cls(
            data["role_code"],
            data["role_name"],
            data.get("description", ""),
            data.get("display_order", 0),
        )

    def to_dict(self):
        return {
            "role_code": self.role_code,
            "role_name": self.role_name,
            "description": self.description,
            "display_order": self.display_order,
        }
