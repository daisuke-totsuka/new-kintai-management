from app import app
from api.roles import role as role_api
from services import role_service


class FakeRoleRepository:
    def __init__(self):
        self.roles = [
            {
                "role_id": "ACCOUNTING",
                "role_name": "Accounting",
                "description": "Accounting role",
                "is_active": True,
            },
            {
                "role_id": "USER",
                "role_name": "User",
                "description": "User role",
                "is_active": True,
            },
            {
                "role_id": "ADMIN",
                "role_name": "Admin",
                "description": "Admin role",
                "is_active": True,
            },
            {
                "role_id": "ADMIN_ACCOUNTING",
                "role_name": "Admin Accounting",
                "description": "Admin accounting role",
                "is_active": True,
            },
            {
                "role_id": "LEADER",
                "role_name": "Leader",
                "description": "Leader role",
                "is_active": True,
            },
        ]
        self.maps = [
            {"role_id": "USER", "menu_id": "ATTENDANCE"},
            {"role_id": "USER", "menu_id": "WORK_TIME_SETTING"},
            {"role_id": "USER", "menu_id": "EXPENSE"},
            {"role_id": "USER", "menu_id": "WORK_BILLING"},
            {"role_id": "LEADER", "menu_id": "ATTENDANCE"},
            {"role_id": "LEADER", "menu_id": "WORK_TIME_SETTING"},
            {"role_id": "LEADER", "menu_id": "EXPENSE"},
            {"role_id": "LEADER", "menu_id": "WORK_BILLING"},
            {"role_id": "LEADER", "menu_id": "SUBMISSION_STATUS"},
            {"role_id": "ACCOUNTING", "menu_id": "ATTENDANCE"},
            {"role_id": "ACCOUNTING", "menu_id": "WORK_TIME_SETTING"},
            {"role_id": "ACCOUNTING", "menu_id": "EXPENSE"},
            {"role_id": "ACCOUNTING", "menu_id": "WORK_BILLING"},
            {"role_id": "ACCOUNTING", "menu_id": "DASHBOARD"},
            {"role_id": "ACCOUNTING", "menu_id": "ATTENDANCE_SETTINGS"},
            {"role_id": "ADMIN", "menu_id": "ATTENDANCE"},
            {"role_id": "ADMIN", "menu_id": "WORK_TIME_SETTING"},
            {"role_id": "ADMIN", "menu_id": "BRANCH_MANAGEMENT"},
            {"role_id": "ADMIN", "menu_id": "USER_MANAGEMENT"},
            {"role_id": "ADMIN", "menu_id": "ROLE_MANAGEMENT"},
            {"role_id": "ADMIN", "menu_id": "INACTIVE_MENU"},
            {"role_id": "ADMIN_ACCOUNTING", "menu_id": "ATTENDANCE"},
            {"role_id": "ADMIN_ACCOUNTING", "menu_id": "WORK_TIME_SETTING"},
            {"role_id": "ADMIN_ACCOUNTING", "menu_id": "EXPENSE"},
            {"role_id": "ADMIN_ACCOUNTING", "menu_id": "WORK_BILLING"},
            {"role_id": "ADMIN_ACCOUNTING", "menu_id": "DASHBOARD"},
            {"role_id": "ADMIN_ACCOUNTING", "menu_id": "ATTENDANCE_SETTINGS"},
            {"role_id": "ADMIN_ACCOUNTING", "menu_id": "BRANCH_MANAGEMENT"},
            {"role_id": "ADMIN_ACCOUNTING", "menu_id": "USER_MANAGEMENT"},
            {"role_id": "ADMIN_ACCOUNTING", "menu_id": "ROLE_MANAGEMENT"},
        ]

    def find_all(self, filters=None):
        rows = list(self.roles)
        for key, value in (filters or {}).items():
            rows = [row for row in rows if row.get(key) == value]
        return [dict(role) for role in rows]

    def find_by_role_id(self, role_id):
        for role in self.roles:
            if role["role_id"] == role_id:
                return dict(role)
        return None

    def create(self, role):
        self.roles.append(dict(role))
        return dict(role)

    def update(self, role_id, role):
        for index, current in enumerate(self.roles):
            if current["role_id"] == role_id:
                self.roles[index] = {**current, **role}
                return dict(self.roles[index])
        return None

    def find_menu_maps(self, role_id=None):
        rows = self.maps
        if role_id:
            rows = [row for row in rows if row["role_id"] == role_id]
        return [dict(row) for row in rows]

    def replace_menu_maps(self, role_id, menu_ids, operator_employee_id, now):
        self.maps = [row for row in self.maps if row["role_id"] != role_id]
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
        self.maps.extend(rows)
        return [dict(row) for row in rows]


class FakeMenuRepository:
    def __init__(self):
        self.menus = [
            {
                "menu_id": "ATTENDANCE",
                "menu_name": "勤務実績",
                "menu_category": "USER",
                "menu_path": "/attendance",
                "is_active": True,
            },
            {
                "menu_id": "EXPENSE",
                "menu_name": "経費請求",
                "menu_category": "USER",
                "menu_path": "/ExpenseClaims",
                "is_active": True,
            },
            {
                "menu_id": "WORK_BILLING",
                "menu_name": "業務請求明細",
                "menu_category": "USER",
                "menu_path": "/BusinessBillDetails",
                "is_active": True,
            },
            {
                "menu_id": "WORK_TIME_SETTING",
                "menu_name": "通常出勤時間設定",
                "menu_category": "USER",
                "menu_path": "/NormalWorkTimeSettings",
                "is_active": True,
            },
            {
                "menu_id": "BRANCH_MANAGEMENT",
                "menu_name": "支店管理",
                "menu_category": "ADMIN",
                "menu_path": "/admin/branches",
                "is_active": True,
            },
            {
                "menu_id": "USER_MANAGEMENT",
                "menu_name": "ユーザ管理",
                "menu_category": "ADMIN",
                "menu_path": "/admin/users",
                "is_active": True,
            },
            {
                "menu_id": "ROLE_MANAGEMENT",
                "menu_name": "権限管理",
                "menu_category": "ADMIN",
                "menu_path": "/admin/roles",
                "is_active": True,
            },
            {
                "menu_id": "SUBMISSION_STATUS",
                "menu_name": "提出状況",
                "menu_category": "LEADER",
                "menu_path": "/leader",
                "is_active": True,
            },
            {
                "menu_id": "DASHBOARD",
                "menu_name": "確定画面",
                "menu_category": "ACCOUNTING",
                "menu_path": "/dashboard",
                "is_active": True,
            },
            {
                "menu_id": "ATTENDANCE_SETTINGS",
                "menu_name": "年度設定",
                "menu_category": "ACCOUNTING",
                "menu_path": "/AttendanceSettings",
                "is_active": True,
            },
            {
                "menu_id": "INACTIVE_MENU",
                "menu_name": "無効メニュー",
                "menu_category": "ADMIN",
                "menu_path": "/inactive",
                "is_active": False,
            },
        ]

    def find_all(self, filters=None):
        rows = list(self.menus)
        for key, value in (filters or {}).items():
            rows = [row for row in rows if row.get(key) == value]
        return [dict(menu) for menu in rows]

    def find_by_menu_id(self, menu_id):
        for menu in self.menus:
            if menu["menu_id"] == menu_id:
                return dict(menu)
        return None


def _client(monkeypatch):
    role_repo = FakeRoleRepository()
    menu_repo = FakeMenuRepository()

    monkeypatch.setattr(role_service, "RoleRepository", lambda: role_repo)
    monkeypatch.setattr(role_service, "MenuRepository", lambda: menu_repo)
    monkeypatch.setattr(
        role_api,
        "get_current_user",
        lambda: {"employee_id": "EMP001", "email": "admin@example.com"},
    )

    app.config["TESTING"] = True
    return app.test_client(), role_repo, menu_repo


def _role_by_id(roles, role_id):
    return next(role for role in roles if role["role_id"] == role_id)


def test_roles_are_listed_with_db_menu_maps(monkeypatch):
    client, repo, _ = _client(monkeypatch)

    response = client.get("/roles")

    assert response.status_code == 200
    body = response.get_json()
    assert body["success"] is True
    assert [role["role_id"] for role in body["roles"]] == [
        "ACCOUNTING",
        "ADMIN",
        "ADMIN_ACCOUNTING",
        "LEADER",
        "USER",
    ]
    admin_role = _role_by_id(body["roles"], "ADMIN")
    user_role = _role_by_id(body["roles"], "USER")
    assert {menu["menu_id"] for menu in admin_role["menus"]} == {
        "ATTENDANCE",
        "WORK_TIME_SETTING",
        "BRANCH_MANAGEMENT",
        "USER_MANAGEMENT",
        "ROLE_MANAGEMENT",
    }
    assert user_role["menus"][0]["menu_name"] == "勤務実績"
    assert len(repo.roles) == 5


def test_menus_are_listed_from_menu_master(monkeypatch):
    client, _, _ = _client(monkeypatch)

    response = client.get("/menus")

    assert response.status_code == 200
    body = response.get_json()
    assert body["success"] is True
    assert [menu["menu_id"] for menu in body["menus"]] == [
        "ATTENDANCE",
        "EXPENSE",
        "WORK_BILLING",
        "WORK_TIME_SETTING",
        "BRANCH_MANAGEMENT",
        "ROLE_MANAGEMENT",
        "USER_MANAGEMENT",
        "SUBMISSION_STATUS",
        "ATTENDANCE_SETTINGS",
        "DASHBOARD",
    ]
    assert "INACTIVE_MENU" not in [menu["menu_id"] for menu in body["menus"]]


def test_role_menus_are_listed_by_role_id(monkeypatch):
    client, _, _ = _client(monkeypatch)

    response = client.get("/roles/ADMIN/menus")

    assert response.status_code == 200
    body = response.get_json()
    assert body["success"] is True
    assert body["role_id"] == "ADMIN"
    assert [menu["menu_id"] for menu in body["menus"]] == [
        "ATTENDANCE",
        "WORK_TIME_SETTING",
        "BRANCH_MANAGEMENT",
        "ROLE_MANAGEMENT",
        "USER_MANAGEMENT",
    ]


def test_leader_role_menus_include_submission_status(monkeypatch):
    client, _, _ = _client(monkeypatch)

    response = client.get("/roles/LEADER/menus")

    assert response.status_code == 200
    body = response.get_json()
    assert body["success"] is True
    assert body["role_id"] == "LEADER"
    assert [menu["menu_id"] for menu in body["menus"]] == [
        "ATTENDANCE",
        "EXPENSE",
        "WORK_BILLING",
        "WORK_TIME_SETTING",
        "SUBMISSION_STATUS",
    ]


def test_role_menus_exclude_inactive_menus(monkeypatch):
    client, _, _ = _client(monkeypatch)

    response = client.get("/roles/ADMIN/menus")

    assert response.status_code == 200
    menu_ids = [menu["menu_id"] for menu in response.get_json()["menus"]]
    assert "INACTIVE_MENU" not in menu_ids


def test_unknown_role_menus_returns_404(monkeypatch):
    client, _, _ = _client(monkeypatch)

    response = client.get("/roles/UNKNOWN_ROLE/menus")

    assert response.status_code == 404
    assert response.get_json()["error"] == "Role not found"


def test_role_can_be_created_with_menu_maps(monkeypatch):
    client, repo, _ = _client(monkeypatch)

    response = client.post(
        "/roles",
        json={
            "role_id": "store-manager",
            "role_name": "店舗管理者",
            "description": "店舗を管理する",
            "is_active": True,
            "menu_ids": ["ATTENDANCE", "EXPENSE"],
        },
    )

    assert response.status_code == 201
    body = response.get_json()
    assert body["success"] is True
    assert body["role"]["role_id"] == "STORE_MANAGER"
    assert body["role"]["created_by"] == "EMP001"
    assert {menu["menu_id"] for menu in body["role"]["menus"]} == {
        "ATTENDANCE",
        "EXPENSE",
    }
    assert repo.find_by_role_id("STORE_MANAGER") is not None


def test_role_can_be_updated_without_changing_role_id(monkeypatch):
    client, repo, _ = _client(monkeypatch)

    response = client.put(
        "/roles/USER",
        json={
            "role_id": "USER",
            "role_name": "一般ユーザ",
            "description": "一般利用者",
            "is_active": False,
            "menu_ids": ["EXPENSE"],
        },
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["success"] is True
    assert body["role"]["role_id"] == "USER"
    assert body["role"]["role_name"] == "一般ユーザ"
    assert body["role"]["is_active"] is False
    assert [row["menu_id"] for row in repo.find_menu_maps("USER")] == ["EXPENSE"]


def test_role_menu_update_is_reflected_in_role_menus(monkeypatch):
    client, _, _ = _client(monkeypatch)

    update_response = client.put(
        "/roles/USER",
        json={
            "role_id": "USER",
            "role_name": "User",
            "description": "Updated menus",
            "is_active": True,
            "menu_ids": ["EXPENSE"],
        },
    )
    assert update_response.status_code == 200

    response = client.get("/roles/USER/menus")

    assert response.status_code == 200
    assert [menu["menu_id"] for menu in response.get_json()["menus"]] == ["EXPENSE"]


def test_role_id_cannot_be_changed(monkeypatch):
    client, _, _ = _client(monkeypatch)

    response = client.put(
        "/roles/USER",
        json={
            "role_id": "ADMIN",
            "role_name": "Changed",
            "description": "",
            "is_active": True,
            "menu_ids": ["ATTENDANCE"],
        },
    )

    assert response.status_code == 400
    assert response.get_json()["error"] == "Role id cannot be changed"


def test_role_create_accepts_role_id_and_name_max_lengths(monkeypatch):
    client, repo, _ = _client(monkeypatch)
    role_id = "R" * 50
    role_name = "N" * 100

    response = client.post(
        "/roles",
        json={
            "role_id": role_id,
            "role_name": role_name,
            "description": "max length role",
            "is_active": True,
            "menu_ids": [],
        },
    )

    assert response.status_code == 201
    assert response.get_json()["role"]["role_id"] == role_id
    assert repo.find_by_role_id(role_id)["role_name"] == role_name


def test_role_create_rejects_role_id_over_max_length(monkeypatch):
    client, repo, _ = _client(monkeypatch)

    response = client.post(
        "/roles",
        json={
            "role_id": "R" * 51,
            "role_name": "Valid Role",
            "description": "too long role id",
            "is_active": True,
            "menu_ids": [],
        },
    )

    assert response.status_code == 400
    assert response.get_json()["error"] == "Role id must be 50 characters or fewer"
    assert repo.find_by_role_id("R" * 51) is None


def test_role_create_rejects_role_name_over_max_length(monkeypatch):
    client, repo, _ = _client(monkeypatch)

    response = client.post(
        "/roles",
        json={
            "role_id": "LONG_NAME_ROLE",
            "role_name": "N" * 101,
            "description": "too long role name",
            "is_active": True,
            "menu_ids": [],
        },
    )

    assert response.status_code == 400
    assert response.get_json()["error"] == "Role name must be 100 characters or fewer"
    assert repo.find_by_role_id("LONG_NAME_ROLE") is None
