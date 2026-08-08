from db.connection import DBConnection


class RoleRepository:
    def __init__(self):
        self.db = DBConnection()

    def find_all(self, filters=None):
        return self.db.find_all(table="roles", filters=filters)

    def find_by_role_id(self, role_id):
        return self.db.find_one(
            table="roles",
            filters={"role_id": role_id},
        )

    def create(self, role):
        return self.db.insert(
            table="roles",
            data=role,
        )

    def update(self, role_id, role):
        return self.db.update(
            table="roles",
            filters={"role_id": role_id},
            data=role,
        )

    def find_menu_maps(self, role_id=None):
        filters = {"role_id": role_id} if role_id else None
        return self.db.find_all(table="role_menu_maps", filters=filters)

    def replace_menu_maps(self, role_id, menu_ids, operator_employee_id, now):
        self.db.delete(table="role_menu_maps", filters={"role_id": role_id})

        rows = [
            {
                "role_id": role_id,
                "menu_id": menu_id,
                "created_by": operator_employee_id,
                "created_at": now,
                "updated_by": operator_employee_id,
                "updated_at": now,
            }
            for menu_id in menu_ids
        ]

        if not rows:
            return []

        created = self.db.insert(table="role_menu_maps", data=rows)
        if isinstance(created, list):
            return created
        return [created]
