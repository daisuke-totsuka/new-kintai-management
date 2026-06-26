from app import app
from api.branches import branch as branch_api
from api.users import new_user
from services import branch_service


class FakeBranchRepository:
    def __init__(self):
        self.branches = [
            {
                "branch_code": "001",
                "branch_name": "Tokyo Branch",
                "is_active": True,
                "created_by": "EMP001",
                "created_at": "2026-06-01T00:00:00+00:00",
                "updated_by": "EMP001",
                "updated_at": "2026-06-01T00:00:00+00:00",
            }
        ]

    def find_all(self, filters=None):
        filters = filters or {}
        rows = list(self.branches)

        for key, value in filters.items():
            rows = [row for row in rows if row.get(key) == value]

        return [dict(row) for row in rows]

    def find_by_branch_code(self, branch_code):
        for branch in self.branches:
            if branch["branch_code"] == branch_code:
                return dict(branch)
        return None

    def find_by_branch_name(self, branch_name):
        for branch in self.branches:
            if branch["branch_name"] == branch_name:
                return dict(branch)
        return None

    def create(self, branch):
        self.branches.append(dict(branch))
        return dict(branch)

    def update(self, branch_code, data):
        for index, branch in enumerate(self.branches):
            if branch["branch_code"] == branch_code:
                self.branches[index] = {**branch, **data}
                return dict(self.branches[index])
        return None

    def get_next_branch_code(self):
        return "002"


class FakeUserRepository:
    def __init__(self):
        self.users = [
            {
                "employee_id": "0000000001",
                "name": "山田 太郎",
                "email": "yamada.taro@example.com",
                "role": "USER",
                "role_id": "ADMIN",
                "role_name": "管理者",
                "branch_code": "001",
                "branch_name": "Tokyo Branch",
            },
            {
                "employee_id": "0000000002",
                "name": "佐藤 花子",
                "email": "sato.hanako@example.com",
                "role": "USER",
                "role_id": "ACCOUNTING",
                "role_name": "経理",
                "branch_code": "002",
                "branch_name": "Osaka Branch",
            },
        ]

    def find_by_employee_id(self, employee_id):
        for user in self.users:
            if user["employee_id"] == employee_id:
                return dict(user)
        return None

    def search_users(self, employee_id=None, name=None, email=None):
        employee_id = str(employee_id or "")
        name = str(name or "")
        email = str(email or "")
        users = self.users
        if employee_id:
            users = [user for user in users if employee_id in user["employee_id"]]
        if name:
            users = [user for user in users if name in user["name"]]
        if email:
            users = [user for user in users if email in user["email"]]
        return [dict(user) for user in users]


def _client(monkeypatch):
    repo = FakeBranchRepository()
    user_repo = FakeUserRepository()

    monkeypatch.setattr(branch_service, "BranchRepository", lambda: repo)
    monkeypatch.setattr(branch_service, "UserRepository", lambda: user_repo)
    monkeypatch.setattr(
        branch_api,
        "get_current_user",
        lambda: {"employee_id": "EMP001", "email": "admin@example.com"},
    )

    app.config["TESTING"] = True
    return app.test_client(), repo


def test_search_users(monkeypatch):
    user_repo = FakeUserRepository()
    monkeypatch.setattr(new_user, "UserRepository", lambda: user_repo)

    app.config["TESTING"] = True
    client = app.test_client()

    response = client.get("/users/search?employee_id=0000000001&name=山田&email=yamada")

    assert response.status_code == 200
    body = response.get_json()
    assert body["success"] is True
    assert body["users"] == [
        {
            "employee_id": "0000000001",
            "name": "山田 太郎",
            "email": "yamada.taro@example.com",
            "role": "USER",
            "role_id": "ADMIN",
            "role_name": "管理者",
            "branch_code": "001",
            "branch_name": "Tokyo Branch",
        }
    ]


def test_search_branches(monkeypatch):
    client, _ = _client(monkeypatch)

    list_response = client.get("/branches")
    detail_response = client.get("/branches/001")
    next_code_response = client.get("/branches/next-branch-code")

    assert list_response.status_code == 200
    list_body = list_response.get_json()
    assert list_body["success"] is True
    assert len(list_body["branches"]) == 1
    assert list_body["branches"][0]["branch_code"] == "001"

    assert detail_response.status_code == 200
    detail_body = detail_response.get_json()
    assert detail_body["success"] is True
    assert detail_body["branch"]["branch_name"] == "Tokyo Branch"

    assert next_code_response.status_code == 200
    assert next_code_response.get_json()["branch_code"] == "002"


def test_search_active_branches(monkeypatch):
    client, repo = _client(monkeypatch)
    repo.branches.append({
        "branch_code": "002",
        "branch_name": "Inactive Branch",
        "is_active": False,
        "created_by": "EMP001",
        "created_at": "2026-06-01T00:00:00+00:00",
        "updated_by": "EMP001",
        "updated_at": "2026-06-01T00:00:00+00:00",
    })

    response = client.get("/branches?is_active=true")

    assert response.status_code == 200
    body = response.get_json()
    assert body["success"] is True
    assert len(body["branches"]) == 1
    assert body["branches"][0]["branch_code"] == "001"
    assert body["branches"][0]["is_active"] is True


def test_create_branch(monkeypatch):
    client, repo = _client(monkeypatch)

    response = client.post(
        "/branches",
        json={
            "branch_code": "002",
            "branch_name": "Osaka Branch",
            "is_active": True,
        },
    )

    assert response.status_code == 201
    body = response.get_json()
    assert body["success"] is True
    assert body["branch"]["branch_code"] == "002"
    assert body["branch"]["branch_name"] == "Osaka Branch"
    assert body["branch"]["created_by"] == "EMP001"
    assert repo.find_by_branch_code("002") is not None


def test_create_branch_with_manager_employee_id(monkeypatch):
    client, repo = _client(monkeypatch)

    response = client.post(
        "/branches",
        json={
            "branch_code": "002",
            "branch_name": "Osaka Branch",
            "manager_employee_id": "0000000001",
            "is_active": True,
        },
    )

    assert response.status_code == 201
    body = response.get_json()
    assert body["success"] is True
    assert body["branch"]["manager_employee_id"] == "0000000001"
    assert body["branch"]["manager_name"] == "山田 太郎"
    assert repo.find_by_branch_code("002")["manager_employee_id"] == "0000000001"


def test_update_branch(monkeypatch):
    client, repo = _client(monkeypatch)

    response = client.put(
        "/branches/001",
        json={
            "branch_code": "001",
            "branch_name": "Tokyo Main Branch",
            "is_active": True,
        },
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["success"] is True
    assert body["branch"]["branch_name"] == "Tokyo Main Branch"
    assert body["branch"]["updated_by"] == "EMP001"
    assert repo.find_by_branch_code("001")["branch_name"] == "Tokyo Main Branch"


def test_delete_branch(monkeypatch):
    client, repo = _client(monkeypatch)

    response = client.delete("/branches/001")

    assert response.status_code == 200
    body = response.get_json()
    assert body["success"] is True
    assert body["branch"]["is_active"] is False
    assert repo.find_by_branch_code("001")["is_active"] is False
