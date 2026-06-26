# DB接続
from db.connection import DBConnection

# Userモデル
from models.user import User
from services.role_service import DEFAULT_ROLES, normalize_role_code


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

    def create(self, user):

        return self.db.insert(
            table="users",
            data=user
        )

    def find_by_employee_id(self, employee_id):

        return self.db.find_one(
            table="users",
            filters={"employee_id": employee_id}
        )

    def find_by_email(self, email):

        return self.db.find_one(
            table="users",
            filters={"email": email}
        )

    def search_users(self, employee_id=None, name=None, email=None):

        rows = self.db.find_all(table="users")
        role_names = self._role_names_by_code()
        branch_names = self._branch_names_by_code()

        employee_id = str(employee_id or "").strip().lower()
        name = str(name or "").strip().lower()
        email = str(email or "").strip().lower()

        users = []
        for row in rows:
            employee_id_value = row.get("employee_id") or row.get("employeeId")
            name_value = row.get("name") or row.get("username")
            email_value = row.get("email")

            if employee_id and employee_id not in str(employee_id_value or "").lower():
                continue
            if name and name not in str(name_value or "").lower():
                continue
            if email and email not in str(email_value or "").lower():
                continue

            role_id = _resolve_user_role_id(row)
            branch_code = _normalize_branch_code(
                row.get("branch_code") or row.get("branchCode") or ""
            )
            employment_status = row.get("employment_status") or row.get("employmentStatus")
            is_active = row.get("is_active")
            if is_active is None:
                is_active = row.get("isActive")
            if is_active is None:
                is_active = employment_status != "inactive"

            users.append({
                "id": row.get("id"),
                "employee_id": employee_id_value,
                "name": name_value,
                "email": email_value,
                "role": role_id,
                "role_id": role_id,
                "role_name": role_names.get(role_id),
                "branch_code": branch_code,
                "branch_name": branch_names.get(branch_code),
                "employment_status": employment_status,
                "is_active": bool(is_active),
                "updated_at": row.get("updated_at") or row.get("updatedAt"),
            })

        return sorted(users, key=lambda user: str(user.get("employee_id") or ""))

    def update_by_employee_id(self, employee_id, user):

        return self.db.update(
            table="users",
            filters={"employee_id": employee_id},
            data=user
        )

    def get_next_user_id(self):

        return self._get_next_id("id")

    def get_next_employee_id(self):

        return self._get_next_id("employee_id")

    def _get_next_id(self, column):

        rows = self.db.find_all(table="users")
        max_number = 0

        for row in rows:
            value = str(row.get(column, ""))
            if value.isdigit():
                max_number = max(max_number, int(value))

        return f"{max_number + 1:010d}"

    def _role_names_by_code(self):

        roles = {
            role["role_code"]: role["role_name"]
            for role in DEFAULT_ROLES
        }

        for role in self.db.find_all(table="roles"):
            role_code = role.get("role_code") or role.get("roleCode")
            role_name = role.get("role_name") or role.get("roleName")
            if role_code and role_name:
                roles[str(role_code)] = str(role_name)

        return roles

    def _branch_names_by_code(self):

        branches = {}

        for branch in self.db.find_all(table="branches"):
            branch_code = _normalize_branch_code(
                branch.get("branch_code") or branch.get("branchCode") or ""
            )
            branch_name = branch.get("branch_name") or branch.get("branchName")
            if branch_code and branch_name:
                branches[branch_code] = str(branch_name)

        return branches


def _resolve_user_role_id(row):
    role_id = _first_non_blank(row.get("role_id"), row.get("roleId"))
    role = _first_non_blank(row.get("role"))
    value = role_id if role_id is not None else role

    if value is None:
        return "USER"

    try:
        return normalize_role_code(value)
    except ValueError:
        return str(value).strip().upper().replace("-", "_").replace(" ", "_")


def _first_non_blank(*values):
    for value in values:
        if value is not None and str(value).strip() != "":
            return value
    return None


def _normalize_branch_code(value):
    text = str(value or "").strip().upper()
    if text.startswith("B"):
        text = text[1:]
    if text.isdigit():
        return text.zfill(3)
    return text
