from db.connection import DBConnection


class RoleRepository:
    def __init__(self):
        self.db = DBConnection()

    def find_all(self):
        return self.db.find_all(table="roles")

    def find_by_role_code(self, role_code):
        return self.db.find_one(
            table="roles",
            filters={"role_code": role_code},
        )

    def create(self, role):
        return self.db.insert(
            table="roles",
            data=role,
        )
