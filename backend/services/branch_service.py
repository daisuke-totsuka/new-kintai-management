from datetime import datetime, timezone
import re

from repositories.branch_repository import BranchRepository
from repositories.user_repository import UserRepository


class BranchService:
    def __init__(self):
        self.repo = BranchRepository()

    def list_branches(self, filters=None):
        return [
            self._with_manager_name(branch)
            for branch in self.repo.find_all(_build_filters(filters or {}))
        ]

    def get_next_branch_code(self):
        return self.repo.get_next_branch_code()

    def get_branch(self, branch_code):
        return self._with_manager_name(
            self.repo.find_by_branch_code(_normalize_branch_code(branch_code))
        )

    def create_branch(self, data, operator_employee_id):
        branch = self._build_branch(data)
        if not branch["branch_code"]:
            branch["branch_code"] = self.repo.get_next_branch_code()

        error = self._validate(branch)
        if error:
            return {"error": error}, 400

        if self.repo.find_by_branch_code(branch["branch_code"]):
            return {"error": "Branch code already exists"}, 409

        if self.repo.find_by_branch_name(branch["branch_name"]):
            return {"error": "Branch name already exists"}, 409

        now = self._now()
        branch.update({
            "created_by": operator_employee_id,
            "created_at": now,
            "updated_by": operator_employee_id,
            "updated_at": now,
        })

        created = self.repo.create(branch)
        return {"success": True, "branch": self._with_manager_name(created or branch)}, 201

    def update_branch(self, branch_code, data, operator_employee_id):
        branch_code = _normalize_branch_code(branch_code)
        current = self.repo.find_by_branch_code(branch_code)
        if not current:
            return {"error": "Branch not found"}, 404

        branch = self._build_branch(data, current)
        error = self._validate(branch)
        if error:
            return {"error": error}, 400

        if branch["branch_code"] != branch_code:
            duplicated = self.repo.find_by_branch_code(branch["branch_code"])
            if duplicated:
                return {"error": "Branch code already exists"}, 409

        duplicated_name = self.repo.find_by_branch_name(branch["branch_name"])
        if duplicated_name and duplicated_name.get("branch_code") != branch_code:
            return {"error": "Branch name already exists"}, 409

        branch.update({
            "updated_by": operator_employee_id,
            "updated_at": self._now(),
        })

        updated = self.repo.update(branch_code, branch)
        return {"success": True, "branch": self._with_manager_name(updated or branch)}, 200

    def delete_branch(self, branch_code, operator_employee_id):
        branch_code = _normalize_branch_code(branch_code)
        current = self.repo.find_by_branch_code(branch_code)
        if not current:
            return {"error": "Branch not found"}, 404

        data = {
            "is_active": False,
            "updated_by": operator_employee_id,
            "updated_at": self._now(),
        }
        updated = self.repo.update(branch_code, data)
        branch = dict(current)
        branch.update(updated or data)
        return {"success": True, "branch": branch}, 200

    def _build_branch(self, data, current=None):
        current = current or {}

        return {
            "branch_code": _normalize_branch_code(_first_value(data, "branch_code", "branchCode", default=current.get("branch_code", ""))),
            "branch_name": str(_first_value(data, "branch_name", "branchName", "name", default=current.get("branch_name", ""))).strip(),
            "manager_employee_id": _normalize_optional_text(
                _first_value(data, "manager_employee_id", "managerEmployeeId", default=current.get("manager_employee_id"))
            ),
            "is_active": _first_value(data, "is_active", "isActive", default=current.get("is_active", True)),
        }

    def _validate(self, branch):
        if not str(branch.get("branch_code", "")).strip():
            return "Branch code is required"
        if not re.match(r"^\d{3}$", str(branch.get("branch_code", ""))):
            return "Branch code must be 3 digits"
        if not str(branch.get("branch_name", "")).strip():
            return "Branch name is required"
        if len(str(branch.get("branch_name", ""))) > 100:
            return "Branch name must be 100 characters or fewer"
        if branch.get("manager_employee_id") and len(str(branch["manager_employee_id"])) > 10:
            return "Manager employee id must be 10 characters or fewer"
        return None

    def _now(self):
        return datetime.now(timezone.utc).isoformat()

    def _with_manager_name(self, branch):
        if not branch:
            return branch

        manager_employee_id = branch.get("manager_employee_id")
        if not manager_employee_id:
            return branch

        enriched = dict(branch)
        user = UserRepository().find_by_employee_id(manager_employee_id)
        if user:
            enriched["manager_name"] = user.get("name", "")
        return enriched


def _first_value(data, *keys, default=None):
    for key in keys:
        value = data.get(key)
        if value is not None:
            return value
    return default


def _normalize_branch_code(value):
    text = str(value or "").strip().upper()
    if text.startswith("B"):
        text = text[1:]
    if text.isdigit():
        return text.zfill(3)
    return text


def _normalize_optional_text(value):
    if value is None:
        return None

    text = str(value).strip()
    return text or None


def _build_filters(raw_filters):
    filters = {}

    branch_code = _first_value(raw_filters, "branch_code", "branchCode")
    if branch_code:
        filters["branch_code"] = _normalize_branch_code(branch_code)

    branch_name = _first_value(raw_filters, "branch_name", "branchName", "name")
    if branch_name:
        filters["branch_name"] = str(branch_name).strip()

    is_active = _first_value(raw_filters, "is_active", "isActive")
    if is_active is not None and is_active != "":
        filters["is_active"] = _to_bool(is_active)

    return filters


def _to_bool(value):
    if isinstance(value, bool):
        return value

    return str(value).strip().lower() in {"1", "true", "yes", "on"}
