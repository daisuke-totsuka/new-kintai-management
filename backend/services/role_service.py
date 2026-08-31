from datetime import datetime, timezone
import re

from repositories.menu_repository import MenuRepository
from repositories.role_repository import RoleRepository


MENU_CATEGORY_ORDER = ("USER", "ADMIN", "LEADER", "ACCOUNTING")


class RoleService:
    def __init__(self):
        self.repo = RoleRepository()
        self.menu_repo = MenuRepository()

    def list_roles(self, filters=None):
        roles = _sort_roles(self.repo.find_all(_build_filters(filters or {})))
        return self._with_menus(roles)

    def get_role(self, role_id):
        role_id = normalize_role_id(role_id)
        if not role_id:
            return None

        role = self.repo.find_by_role_id(role_id)
        if not role:
            return None
        return self._with_menus([role])[0]

    def list_menus(self, include_inactive=False):
        filters = None if include_inactive else {"is_active": True}
        menus = [_normalize_menu_row(menu) for menu in self.menu_repo.find_all(filters)]
        if not include_inactive:
            menus = [menu for menu in menus if menu["is_active"]]
        return _sort_menus(menus)

    def get_role_menus(self, role_id):
        role_id = normalize_role_id(role_id)
        if not role_id:
            return None

        role = self.repo.find_by_role_id(role_id)
        if not role:
            return None

        return self._menus_for_role_ids({role_id}).get(role_id, [])

    def create_role(self, data, operator_employee_id):
        role = self._build_role(data)
        error = self._validate_role(role)
        if error:
            return {"error": error}, 400

        if self.repo.find_by_role_id(role["role_id"]):
            return {"error": "Role id already exists"}, 409

        menu_ids, error = self._validate_menu_ids(_extract_menu_ids(data))
        if error:
            return {"error": error}, 400

        now = self._now()
        role.update({
            "created_by": operator_employee_id,
            "created_at": now,
            "updated_by": operator_employee_id,
            "updated_at": now,
        })

        created = self.repo.create(role)
        self.repo.replace_menu_maps(role["role_id"], menu_ids, operator_employee_id, now)
        return {"success": True, "role": self.get_role(role["role_id"]) or created or role}, 201

    def update_role(self, role_id, data, operator_employee_id):
        role_id = normalize_role_id(role_id)
        if not role_id:
            return {"error": "Role id is required"}, 400

        current = self.repo.find_by_role_id(role_id)
        if not current:
            return {"error": "Role not found"}, 404

        requested_role_id = normalize_role_id(_first_value(data, "role_id", "roleId"))
        if requested_role_id and requested_role_id != role_id:
            return {"error": "Role id cannot be changed"}, 400

        role = self._build_role(data, current=current, role_id=role_id)
        error = self._validate_role(role)
        if error:
            return {"error": error}, 400

        now = self._now()
        update_data = {
            "role_name": role["role_name"],
            "description": role["description"],
            "is_active": role["is_active"],
            "updated_by": operator_employee_id,
            "updated_at": now,
        }

        menu_ids = None
        if _has_any_key(data, "menu_ids", "menuIds", "menus"):
            menu_ids, error = self._validate_menu_ids(_extract_menu_ids(data))
            if error:
                return {"error": error}, 400

        self.repo.update(role_id, update_data)
        if menu_ids is not None:
            self.repo.replace_menu_maps(role_id, menu_ids, operator_employee_id, now)

        return {"success": True, "role": self.get_role(role_id)}, 200

    def _build_role(self, data, current=None, role_id=None):
        current = current or {}
        return {
            "role_id": normalize_role_id(
                role_id
                or _first_value(data, "role_id", "roleId", default=current.get("role_id"))
            ),
            "role_name": str(
                _first_value(data, "role_name", "roleName", "name", default=current.get("role_name", ""))
            ).strip(),
            "description": str(
                _first_value(data, "description", default=current.get("description", ""))
            ).strip(),
            "is_active": _to_bool(
                _first_value(data, "is_active", "isActive", default=current.get("is_active", True))
            ),
        }

    def _validate_role(self, role):
        if not role.get("role_id"):
            return "Role id is required"
        if not re.match(r"^[A-Z0-9_]+$", role["role_id"]):
            return "Role id must contain only uppercase letters, numbers, and underscores"
        if not role.get("role_name"):
            return "Role name is required"
        if len(role["role_id"]) > 50:
            return "Role id must be 50 characters or fewer"
        if len(role["role_name"]) > 100:
            return "Role name must be 100 characters or fewer"
        return None

    def _validate_menu_ids(self, menu_ids):
        available_menu_ids = {menu["menu_id"] for menu in self.list_menus()}
        invalid = [menu_id for menu_id in menu_ids if menu_id not in available_menu_ids]
        if invalid:
            return [], f"Unknown menu id: {invalid[0]}"
        return menu_ids, None

    def _with_menus(self, roles):
        if not roles:
            return []

        role_ids = {
            normalize_role_id(role.get("role_id") or role.get("roleId"))
            for role in roles
        }
        role_ids.discard(None)

        menus_by_role_id = self._menus_for_role_ids(role_ids)

        enriched_roles = []
        for role in roles:
            role_id = normalize_role_id(role.get("role_id") or role.get("roleId"))
            menus = menus_by_role_id.get(role_id, [])

            enriched = {
                **role,
                "role_id": role_id,
                "role_name": role.get("role_name") or role.get("roleName") or "",
                "description": role.get("description") or "",
                "is_active": _to_bool(role.get("is_active") if role.get("is_active") is not None else True),
                "menu_ids": [menu["menu_id"] for menu in menus],
                "menus": menus,
            }
            enriched_roles.append(enriched)

        return _sort_roles(enriched_roles)

    def _menus_for_role_ids(self, role_ids):
        normalized_role_ids = set()
        for role_id in role_ids:
            normalized_role_id = normalize_role_id(role_id)
            if normalized_role_id:
                normalized_role_ids.add(normalized_role_id)
        if not normalized_role_ids:
            return {}

        menus_by_id = {
            menu["menu_id"]: menu
            for menu in [
                _normalize_menu_row(menu)
                for menu in self.menu_repo.find_all({"is_active": True})
            ]
            if menu["menu_id"] and menu["is_active"]
        }

        role_menu_ids = {role_id: [] for role_id in normalized_role_ids}
        mappings = (
            self.repo.find_menu_maps(next(iter(normalized_role_ids)))
            if len(normalized_role_ids) == 1
            else self.repo.find_menu_maps()
        )

        for mapping in mappings:
            role_id = normalize_role_id(mapping.get("role_id") or mapping.get("roleId"))
            menu_id = _normalize_code(mapping.get("menu_id") or mapping.get("menuId"))
            if role_id in role_menu_ids and menu_id in menus_by_id:
                role_menu_ids[role_id].append(menu_id)

        return {
            role_id: _sort_menus(
                [menus_by_id[menu_id] for menu_id in _dedupe(menu_ids)]
            )
            for role_id, menu_ids in role_menu_ids.items()
        }

    def _now(self):
        return datetime.now(timezone.utc).isoformat()


def normalize_role_id(value):
    return _normalize_code(value)


def resolve_role_id(role_id=None):
    return normalize_role_id(role_id)


def _normalize_code(value):
    if _is_blank(value):
        return None

    code = str(value).strip().upper()
    return code.replace("-", "_").replace(" ", "_")


def _is_blank(value):
    return value is None or str(value).strip() == ""


def _first_value(data, *keys, default=None):
    for key in keys:
        if key in data and data.get(key) is not None:
            return data.get(key)
    return default


def _has_any_key(data, *keys):
    return any(key in data for key in keys)


def _extract_menu_ids(data):
    values = _first_value(data, "menu_ids", "menuIds", "menus", default=[])
    if values is None:
        return []
    if not isinstance(values, list):
        values = [values]

    menu_ids = []
    for value in values:
        if isinstance(value, dict):
            value = _first_value(value, "menu_id", "menuId", "id")
        menu_id = _normalize_code(value)
        if menu_id:
            menu_ids.append(menu_id)
    return _dedupe(menu_ids)


def _normalize_menu_row(menu):
    menu_id = _normalize_code(menu.get("menu_id") or menu.get("menuId"))
    category = _normalize_code(menu.get("menu_category") or menu.get("menuCategory"))
    return {
        "menu_id": menu_id,
        "menu_name": menu.get("menu_name") or menu.get("menuName") or "",
        "menu_category": category,
        "menu_path": menu.get("menu_path") or menu.get("menuPath") or "",
        "is_active": _to_bool(menu.get("is_active") if menu.get("is_active") is not None else True),
    }


def _sort_roles(roles):
    return sorted(
        roles,
        key=lambda role: str(role.get("role_id") or role.get("roleId") or ""),
    )


def _sort_menus(menus):
    category_order = {category: index for index, category in enumerate(MENU_CATEGORY_ORDER)}
    return sorted(
        menus,
        key=lambda menu: (
            category_order.get(menu.get("menu_category"), len(category_order)),
            str(menu.get("menu_id") or ""),
        ),
    )


def _build_filters(raw_filters):
    filters = {}
    role_id = _first_value(raw_filters, "role_id", "roleId")
    if role_id:
        filters["role_id"] = normalize_role_id(role_id)

    is_active = _first_value(raw_filters, "is_active", "isActive")
    if is_active is not None and is_active != "":
        filters["is_active"] = _to_bool(is_active)

    return filters


def _to_bool(value):
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _dedupe(values):
    result = []
    seen = set()
    for value in values:
        if value in seen:
            continue
        result.append(value)
        seen.add(value)
    return result
