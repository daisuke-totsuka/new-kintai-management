from datetime import datetime, timezone

from repositories.role_repository import RoleRepository


DEFAULT_ROLES = [
    {
        "role_code": "ADMIN",
        "role_name": "管理者",
        "description": "管理メニューと一般メニューを利用できます",
        "display_order": 10,
    },
    {
        "role_code": "ACCOUNTING",
        "role_name": "経理",
        "description": "経理メニューを利用できます",
        "display_order": 20,
    },
    {
        "role_code": "ADMIN_ACCOUNTING",
        "role_name": "管理者兼経理",
        "description": "管理者と経理の全機能を利用できます",
        "display_order": 30,
    },
    {
        "role_code": "USER",
        "role_name": "一般ユーザ",
        "description": "一般メニューを利用できます",
        "display_order": 40,
    },
]

VALID_ROLE_CODES = {role["role_code"] for role in DEFAULT_ROLES}

ROLE_ALIASES = {
    "EMPLOYEE": "USER",
    "GENERAL": "USER",
    "ADMINACCOUNTING": "ADMIN_ACCOUNTING",
}


class RoleService:
    def __init__(self):
        self.repo = RoleRepository()

    def list_roles(self):
        self.ensure_default_roles()
        return _sort_roles(self.repo.find_all())

    def ensure_default_roles(self):
        existing = {
            role.get("role_code")
            for role in self.repo.find_all()
        }
        now = datetime.now(timezone.utc).isoformat()

        for role in DEFAULT_ROLES:
            if role["role_code"] in existing:
                continue

            self.repo.create({
                **role,
                "is_system_role": True,
                "created_at": now,
                "updated_at": now,
            })


def normalize_role_code(value, default="USER"):
    role_code = str(default if _is_blank(value) else value).strip().upper()
    role_code = role_code.replace("-", "_").replace(" ", "_")
    role_code = ROLE_ALIASES.get(role_code, role_code)

    if role_code not in VALID_ROLE_CODES:
        raise ValueError("Invalid role")

    return role_code


def resolve_role_code(role_id=None, role=None, default="USER"):
    for value in (role_id, role):
        if _is_blank(value):
            continue

        try:
            return normalize_role_code(value, default=default)
        except ValueError:
            continue

    return normalize_role_code(default, default=default)


def _is_blank(value):
    return value is None or str(value).strip() == ""


def _sort_roles(roles):
    return sorted(
        roles,
        key=lambda role: (
            int(role.get("display_order") or 0),
            str(role.get("role_code") or ""),
        ),
    )
