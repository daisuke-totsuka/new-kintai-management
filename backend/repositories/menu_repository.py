from db.connection import DBConnection


class MenuRepository:
    def __init__(self):
        self.db = DBConnection()

    def find_all(self, filters=None):
        return self.db.find_all(table="menu_master", filters=filters)

    def find_by_menu_id(self, menu_id):
        return self.db.find_one(
            table="menu_master",
            filters={"menu_id": menu_id},
        )
