from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import bcrypt
from dotenv import load_dotenv
from supabase import create_client


ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"

sys.path.insert(0, str(BACKEND_DIR))

load_dotenv(ROOT_DIR / ".env")
load_dotenv(BACKEND_DIR / ".env")

REQUIRED_ROLES = [
    {
        "code": "ADMIN",
        "role_name": "Admin",
        "description": "Can use admin and general menus.",
        "is_system_role": True,
        "is_active": True,
        "display_order": 10,
    },
    {
        "code": "ACCOUNTING",
        "role_name": "Accounting",
        "description": "Can use accounting menus.",
        "is_system_role": True,
        "is_active": True,
        "display_order": 20,
    },
    {
        "code": "ADMIN_ACCOUNTING",
        "role_name": "Admin Accounting",
        "description": "Can use admin, accounting, and general menus.",
        "is_system_role": True,
        "is_active": True,
        "display_order": 30,
    },
    {
        "code": "USER",
        "role_name": "User",
        "description": "Can use general menus.",
        "is_system_role": True,
        "is_active": True,
        "display_order": 40,
    },
]

TEST_USERS = [
    {
        "email": "test.admin@example.com",
        "password": "TestAdmin123!",
        "role_id": "ADMIN",
        "name": "Test Admin",
        "preferred_id": "9000000001",
        "preferred_employee_id": "9000000001",
    },
    {
        "email": "test.accounting@example.com",
        "password": "TestAccounting123!",
        "role_id": "ACCOUNTING",
        "name": "Test Accounting",
        "preferred_id": "9000000002",
        "preferred_employee_id": "9000000002",
    },
    {
        "email": "test.admin.accounting@example.com",
        "password": "TestAdminAccounting123!",
        "role_id": "ADMIN_ACCOUNTING",
        "name": "Test Admin Accounting",
        "preferred_id": "9000000003",
        "preferred_employee_id": "9000000003",
    },
    {
        "email": "test.user@example.com",
        "password": "TestUser123!",
        "role_id": "USER",
        "name": "Test User",
        "preferred_id": "9000000004",
        "preferred_employee_id": "9000000004",
    },
]

PROBE_EMAIL = "__audit_probe__@example.com"
SYSTEM_AUDIT_VALUE = "SYSTEM"


def main() -> None:
    client = supabase_client()

    print("== Precheck ==")
    role_id_status = ensure_users_role_id(client)
    print(f"users.role_id: {role_id_status}")

    roles = ensure_roles(client)
    print("roles:")
    for role in roles:
        print(
            "  - "
            f"{role.get('role_id') or role.get('role_code')} "
            f"{role.get('role_name')} "
            f"order={role.get('display_order')}"
        )

    if role_id_status == "missing":
        sql = users_role_id_sql()
        raise RuntimeError(
            "users.role_id is missing and could not be created with the "
            "available credentials. Apply this SQL with a direct Postgres "
            "connection or Supabase SQL editor, then rerun this script:\n"
            f"{sql}"
        )

    user_rows = fetch_users(client)
    audit_value, audit_mode = resolve_audit_value(client, user_rows)
    print(f"audit value: {audit_value} ({audit_mode})")

    created_users = upsert_test_users(client, audit_value)

    verified_users = verify_users(client, created_users, audit_value)
    login_results = verify_logins(verified_users)

    print("== Registered test users ==")
    for user in verified_users:
        print(
            "  - "
            f"{user['email']} "
            f"password={user['password']} "
            f"role_id={user['role_id']} "
            f"employee_id={user['employee_id']} "
            f"id={user['id']} "
            f"created_by={user['created_by']} "
            f"updated_by={user['updated_by']}"
        )

    print("== Login check ==")
    for result in login_results:
        status = "success" if result["success"] else "failed"
        print(
            "  - "
            f"{result['email']} {status} "
            f"role_id={result.get('role_id') or ''} "
            f"employee_id={result.get('employee_id') or ''}"
        )

    if not all(result["success"] for result in login_results):
        raise RuntimeError("One or more login checks failed.")

    print("done")


def supabase_client():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")

    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_KEY are required.")

    return create_client(url, key)


def ensure_users_role_id(client) -> str:
    try:
        client.table("users").select("role_id").limit(1).execute()
        return "exists"
    except Exception as exc:
        if not is_missing_column_error(exc):
            raise

        sql = users_role_id_sql()
        print("users.role_id was not selectable.")
        print("applying SQL:")
        print(sql)
        if not try_apply_sql(client, sql):
            return "missing"
        client.table("users").select("role_id").limit(1).execute()
        return "created"


def users_role_id_sql() -> str:
    return (
        "alter table public.users add column if not exists role_id text;\n"
        "update public.users "
        "set role_id = coalesce(role_id, upper(role), 'USER') "
        "where role_id is null;"
    )


def ensure_roles(client) -> list[dict[str, Any]]:
    role_key = detect_roles_key(client)
    optional_columns = detect_roles_optional_columns(client)
    select_columns = [role_key, "role_name", *optional_columns]

    try:
        existing = (
            client.table("roles")
            .select(",".join(select_columns))
            .in_(role_key, [role["code"] for role in REQUIRED_ROLES])
            .execute()
            .data
            or []
        )
    except Exception as exc:
        sql = roles_table_sql()
        print("roles table was not selectable.")
        print("applying SQL:")
        print(sql)
        if not try_apply_sql(client, sql):
            raise RuntimeError(
                "roles table was not selectable and could not be created with "
                f"the available credentials. Original error: {exc}"
            )
        existing = []

    existing_codes = {row.get(role_key) for row in existing}
    missing = [
        role_payload(role, role_key, optional_columns)
        for role in REQUIRED_ROLES
        if role["code"] not in existing_codes
    ]

    if missing:
        client.table("roles").upsert(missing, on_conflict=role_key).execute()

    roles = (
        client.table("roles")
        .select(",".join(select_columns))
        .in_(role_key, [role["code"] for role in REQUIRED_ROLES])
        .execute()
        .data
        or []
    )

    order_by_code = {
        role["code"]: index
        for index, role in enumerate(REQUIRED_ROLES)
    }
    return sorted(
        roles,
        key=lambda row: int(
            row.get("display_order")
            or order_by_code.get(row.get(role_key), 999)
        ),
    )


def detect_roles_key(client) -> str:
    for column in ("role_code", "role_id"):
        try:
            client.table("roles").select(column).limit(1).execute()
            return column
        except Exception as exc:
            if not is_missing_column_error(exc):
                raise

    raise RuntimeError("roles table has neither role_code nor role_id.")


def detect_roles_optional_columns(client) -> list[str]:
    columns = []
    for column in (
        "description",
        "is_system_role",
        "is_active",
        "display_order",
        "created_by",
        "updated_by",
    ):
        try:
            client.table("roles").select(column).limit(1).execute()
            columns.append(column)
        except Exception as exc:
            if not is_missing_column_error(exc):
                raise
    return columns


def role_payload(
    role: dict[str, Any],
    role_key: str,
    optional_columns: list[str],
) -> dict[str, Any]:
    payload = {
        role_key: role["code"],
        "role_name": role["role_name"],
    }

    for column in optional_columns:
        if column in ("created_by", "updated_by"):
            payload[column] = SYSTEM_AUDIT_VALUE
        elif column in role:
            payload[column] = role[column]

    return payload


def roles_table_sql() -> str:
    return (
        "create table if not exists public.roles ("
        "role_code text primary key, "
        "role_name text not null, "
        "description text not null default '', "
        "is_system_role boolean not null default true, "
        "display_order integer not null default 0, "
        "created_at timestamptz not null default now(), "
        "updated_at timestamptz not null default now()"
        ");"
    )


def try_apply_sql(client, sql: str) -> bool:
    if apply_sql_with_psycopg(sql):
        return True

    for function_name, payload in (
        ("exec_sql", {"sql": sql}),
        ("execute_sql", {"query": sql}),
    ):
        try:
            client.rpc(function_name, payload).execute()
            return True
        except Exception:
            continue

    return False


def apply_sql_with_psycopg(sql: str) -> bool:
    database_url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
    db_host = os.getenv("DB_HOST")
    db_port = os.getenv("DB_PORT")
    db_user = os.getenv("DB_USER")
    db_password = os.getenv("DB_PASSWORD")
    db_name = os.getenv("DB_NAME")

    if not database_url and not all([db_host, db_port, db_user, db_password, db_name]):
        return False

    try:
        import psycopg2
    except Exception:
        return False

    if database_url:
        conn = psycopg2.connect(database_url)
    else:
        conn = psycopg2.connect(
            host=db_host,
            port=db_port,
            user=db_user,
            password=db_password,
            dbname=db_name,
        )

    try:
        with conn:
            with conn.cursor() as cursor:
                cursor.execute(sql)
    finally:
        conn.close()

    return True


def resolve_audit_value(client, user_rows: list[dict[str, Any]]) -> tuple[str, str]:
    if can_save_system_audit_value(client, user_rows):
        return SYSTEM_AUDIT_VALUE, "SYSTEM saved successfully"

    admin_employee_id = find_existing_admin_employee_id(user_rows)
    if admin_employee_id:
        return admin_employee_id, "SYSTEM unavailable; existing admin employee_id used"

    any_employee_id = find_any_employee_id(user_rows)
    if any_employee_id:
        return any_employee_id, "SYSTEM unavailable; existing employee_id used"

    return TEST_USERS[0]["preferred_employee_id"], "SYSTEM unavailable; first test employee_id used"


def can_save_system_audit_value(client, user_rows: list[dict[str, Any]]) -> bool:
    cleanup_probe(client)
    probe_id = next_available_numeric_id(user_rows, "id", 9900000001)
    probe_employee_id = next_available_numeric_id(user_rows, "employee_id", 9900000001)
    now = iso_now()

    payload = {
        "id": probe_id,
        "employee_id": probe_employee_id,
        "name": "Audit Probe",
        "email": PROBE_EMAIL,
        "password_hash": hash_password("AuditProbe123!"),
        "role": "USER",
        "role_id": "USER",
        "employment_status": "active",
        "created_by": SYSTEM_AUDIT_VALUE,
        "created_at": now,
        "updated_by": SYSTEM_AUDIT_VALUE,
        "updated_at": now,
        "is_active": True,
        "is_admin": False,
        "is_accounting": False,
    }

    try:
        client.table("users").insert(payload).execute()
        row = fetch_user_by_email(client, PROBE_EMAIL)
        return bool(
            row
            and row.get("created_by") == SYSTEM_AUDIT_VALUE
            and row.get("updated_by") == SYSTEM_AUDIT_VALUE
        )
    except Exception:
        return False
    finally:
        cleanup_probe(client)


def cleanup_probe(client) -> None:
    try:
        client.table("users").delete().eq("email", PROBE_EMAIL).execute()
    except Exception:
        pass


def find_existing_admin_employee_id(rows: list[dict[str, Any]]) -> str | None:
    for row in rows:
        role = row.get("role_id") or row.get("role")
        employee_id = row.get("employee_id")
        if role == "ADMIN" and employee_id:
            return str(employee_id)
    return None


def find_any_employee_id(rows: list[dict[str, Any]]) -> str | None:
    for row in rows:
        employee_id = row.get("employee_id")
        if employee_id:
            return str(employee_id)
    return None


def upsert_test_users(client, audit_value: str) -> list[dict[str, Any]]:
    rows = fetch_users(client)
    by_email = {str(row.get("email")): row for row in rows if row.get("email")}
    used_ids = {str(row.get("id")) for row in rows if row.get("id")}
    used_employee_ids = {
        str(row.get("employee_id")) for row in rows if row.get("employee_id")
    }

    result = []
    for spec in TEST_USERS:
        existing = by_email.get(spec["email"])
        user_id = choose_identifier(
            existing=existing,
            column="id",
            preferred=spec["preferred_id"],
            used=used_ids,
            start=9000000001,
        )
        employee_id = choose_identifier(
            existing=existing,
            column="employee_id",
            preferred=spec["preferred_employee_id"],
            used=used_employee_ids,
            start=9000000001,
        )

        used_ids.add(user_id)
        used_employee_ids.add(employee_id)

        now = iso_now()
        payload = {
            "id": user_id,
            "employee_id": employee_id,
            "name": spec["name"],
            "email": spec["email"],
            "password_hash": hash_password(spec["password"]),
            "role": spec["role_id"],
            "role_id": spec["role_id"],
            "employment_status": "active",
            "created_by": audit_value,
            "updated_by": audit_value,
            "updated_at": now,
            "is_active": True,
            "is_admin": spec["role_id"] in ("ADMIN", "ADMIN_ACCOUNTING"),
            "is_accounting": spec["role_id"] in ("ACCOUNTING", "ADMIN_ACCOUNTING"),
        }

        if existing:
            client.table("users").update(payload).eq("email", spec["email"]).execute()
        else:
            payload["created_at"] = now
            client.table("users").insert(payload).execute()

        result.append(
            {
                "email": spec["email"],
                "password": spec["password"],
                "role_id": spec["role_id"],
                "id": user_id,
                "employee_id": employee_id,
            }
        )

    return result


def choose_identifier(
    existing: dict[str, Any] | None,
    column: str,
    preferred: str,
    used: set[str],
    start: int,
) -> str:
    if existing:
        current = str(existing.get(column) or "")
        if is_ten_digit(current):
            used.discard(current)
            return current

    if preferred not in used:
        return preferred

    candidate = start
    while True:
        value = f"{candidate:010d}"
        if value not in used:
            return value
        candidate += 1


def verify_users(
    client,
    created_users: list[dict[str, Any]],
    audit_value: str,
) -> list[dict[str, Any]]:
    verified = []
    for user in created_users:
        row = fetch_user_by_email(client, user["email"])
        if not row:
            raise RuntimeError(f"User not found after upsert: {user['email']}")

        if row.get("role_id") != user["role_id"]:
            raise RuntimeError(f"role_id mismatch for {user['email']}")

        if row.get("created_by") != audit_value or row.get("updated_by") != audit_value:
            raise RuntimeError(f"audit value mismatch for {user['email']}")

        if not is_ten_digit(str(row.get("id") or "")):
            raise RuntimeError(f"id is not 10 digits for {user['email']}")

        if not is_ten_digit(str(row.get("employee_id") or "")):
            raise RuntimeError(f"employee_id is not 10 digits for {user['email']}")

        verified.append(
            {
                **user,
                "id": str(row.get("id")),
                "employee_id": str(row.get("employee_id")),
                "created_by": str(row.get("created_by")),
                "updated_by": str(row.get("updated_by")),
            }
        )

    return verified


def verify_logins(users: list[dict[str, Any]]) -> list[dict[str, Any]]:
    try:
        from app import app

        app.config["TESTING"] = True
        client = app.test_client()
        results = []
        for user in users:
            response = client.post(
                "/login",
                json={"email": user["email"], "password": user["password"]},
            )
            body = response.get_json(silent=True) or {}
            results.append(
                {
                    "email": user["email"],
                    "success": response.status_code == 200 and body.get("success") is True,
                    "role_id": body.get("role_id"),
                    "employee_id": body.get("employee_id"),
                }
            )
        return results
    except Exception:
        from services.auth_service import AuthService

        service = AuthService()
        results = []
        for user in users:
            logged_in = service.login(user["email"], user["password"])
            results.append(
                {
                    "email": user["email"],
                    "success": logged_in is not None,
                    "role_id": getattr(logged_in, "role_id", None),
                    "employee_id": getattr(logged_in, "employee_id", None),
                }
            )
        return results


def fetch_user_by_email(client, email: str) -> dict[str, Any] | None:
    rows = (
        client.table("users")
        .select("id,employee_id,name,email,role,role_id,created_by,updated_by")
        .eq("email", email)
        .execute()
        .data
        or []
    )
    return rows[0] if rows else None


def fetch_users(client) -> list[dict[str, Any]]:
    return (
        client.table("users")
        .select("id,employee_id,email,role,role_id,created_by,updated_by")
        .execute()
        .data
        or []
    )


def next_available_numeric_id(
    rows: list[dict[str, Any]],
    column: str,
    start: int,
) -> str:
    used = {str(row.get(column)) for row in rows if row.get(column)}
    candidate = start
    while True:
        value = f"{candidate:010d}"
        if value not in used:
            return value
        candidate += 1


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def is_ten_digit(value: str) -> bool:
    return len(value) == 10 and value.isdigit()


def is_missing_column_error(exc: Exception) -> bool:
    text = str(exc)
    return (
        "'code': '42703'" in text
        or '"code":"42703"' in text
        or "PGRST204" in text
        or "does not exist" in text
        or "Could not find" in text
    )


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


if __name__ == "__main__":
    main()
