from app import app
from services import role_service


class FakeRoleRepository:
    def __init__(self):
        self.roles = [
            {
                "role_code": "ADMIN",
                "role_name": "管理者",
                "description": "管理メニューと一般メニューを利用できます",
                "display_order": 10,
            }
        ]

    def find_all(self):
        return [dict(role) for role in self.roles]

    def create(self, role):
        self.roles.append(dict(role))
        return dict(role)


def test_roles_are_seeded_and_listed(monkeypatch):
    repo = FakeRoleRepository()
    monkeypatch.setattr(role_service, "RoleRepository", lambda: repo)

    app.config["TESTING"] = True
    client = app.test_client()

    response = client.get("/roles")

    assert response.status_code == 200
    body = response.get_json()
    assert body["success"] is True
    assert [role["role_code"] for role in body["roles"]] == [
        "ADMIN",
        "ACCOUNTING",
        "ADMIN_ACCOUNTING",
        "USER",
    ]
    assert [role["role_name"] for role in body["roles"]] == [
        "管理者",
        "経理",
        "管理者兼経理",
        "一般ユーザ",
    ]
    assert len(repo.roles) == 4
