import re

from db.connection import DBConnection


class BranchRepository:
    def __init__(self):
        self.db = DBConnection()

    def find_all(self, filters=None):
        return self.db.find_all(
            table="branches",
            filters=filters or {},
        )

    def find_by_branch_code(self, branch_code):
        return self.db.find_one(
            table="branches",
            filters={"branch_code": branch_code},
        )

    def find_by_branch_name(self, branch_name):
        return self.db.find_one(
            table="branches",
            filters={"branch_name": branch_name},
        )

    def create(self, branch):
        return self.db.insert(
            table="branches",
            data=branch,
        )

    def update(self, branch_code, branch):
        return self.db.update(
            table="branches",
            filters={"branch_code": branch_code},
            data=branch,
        )

    def get_next_branch_code(self):
        rows = self.find_all()
        max_number = 0

        for row in rows:
            value = str(row.get("branch_code", ""))
            matched = re.match(r"^B?(\d{1,3})$", value, re.IGNORECASE)
            if matched:
                max_number = max(max_number, int(matched.group(1)))

        if max_number >= 999:
            raise ValueError("No branch code available")

        return f"{max_number + 1:03d}"
