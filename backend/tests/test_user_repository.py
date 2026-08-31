from repositories import user_repository


class FakeDB:
    def find_all(self, table, filters=None):
        if table == "users":
            return [
                {
                    "id": "0000000001",
                    "employee_id": "0000000001",
                    "name": "Admin User",
                    "email": "admin@example.com",
                    "role_id": "ADMIN",
                    "branch_code": "001",
                    "is_active": True,
                    "updated_at": "2026-06-23T00:00:00+00:00",
                },
                {
                    "id": "0000000002",
                    "employee_id": "0000000002",
                    "name": "Accounting User",
                    "email": "accounting@example.com",
                    "role_id": "ACCOUNTING",
                    "branch_code": "002",
                    "is_active": True,
                    "updated_at": "2026-06-23T00:00:00+00:00",
                },
            ]

        if table == "roles":
            return [
                {"role_id": "ADMIN", "role_name": "管理者"},
                {"role_id": "ACCOUNTING", "role_name": "経理"},
            ]

        if table == "branches":
            return [
                {"branch_code": "001", "branch_name": "東京本社"},
                {"branch_code": "002", "branch_name": "大阪支店"},
            ]

        return []


def test_search_users_returns_role_and_branch_fields(monkeypatch):
    monkeypatch.setattr(user_repository, "DBConnection", lambda: FakeDB())

    repo = user_repository.UserRepository()
    users = repo.search_users()

    assert users[0]["role_id"] == "ADMIN"
    assert users[0]["role_name"] == "管理者"
    assert users[0]["branch_code"] == "001"
    assert users[0]["branch_name"] == "東京本社"

    assert users[1]["role_id"] == "ACCOUNTING"
    assert users[1]["role_name"] == "経理"
    assert users[1]["branch_code"] == "002"
    assert users[1]["branch_name"] == "大阪支店"
