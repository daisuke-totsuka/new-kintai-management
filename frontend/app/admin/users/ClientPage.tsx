"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type RoleCode = "ADMIN" | "ACCOUNTING" | "ADMIN_ACCOUNTING" | "USER";

type UserRow = {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  branchCode: string;
  branchName: string;
  isActive: boolean;
  updatedAt: string;
};

type UserFormValue = {
  id?: string;
  employeeId: string;
  name: string;
  email: string;
  password: string;
  roleId: RoleCode;
  branchCode: string;
  isActive: boolean;
};

type BranchOption = {
  branchCode: string;
  branchName: string;
};

const ROLE_LABELS: Record<RoleCode, string> = {
  ADMIN: "管理者",
  ACCOUNTING: "経理",
  ADMIN_ACCOUNTING: "管理者兼経理",
  USER: "一般ユーザ",
};

const ROLE_OPTIONS: { value: RoleCode; label: string }[] = [
  { value: "ADMIN", label: ROLE_LABELS.ADMIN },
  { value: "ACCOUNTING", label: ROLE_LABELS.ACCOUNTING },
  { value: "ADMIN_ACCOUNTING", label: ROLE_LABELS.ADMIN_ACCOUNTING },
  { value: "USER", label: ROLE_LABELS.USER },
];

const INITIAL_USERS: UserRow[] = [
  {
    id: "9000000001",
    employeeId: "9000000001",
    name: "Test Admin",
    email: "test.admin@example.com",
    roleId: "ADMIN",
    roleName: ROLE_LABELS.ADMIN,
    branchCode: "",
    branchName: "",
    isActive: true,
    updatedAt: "2026-06-22",
  },
  {
    id: "9000000002",
    employeeId: "9000000002",
    name: "Test Accounting",
    email: "test.accounting@example.com",
    roleId: "ACCOUNTING",
    roleName: ROLE_LABELS.ACCOUNTING,
    branchCode: "",
    branchName: "",
    isActive: true,
    updatedAt: "2026-06-22",
  },
  {
    id: "9000000003",
    employeeId: "9000000003",
    name: "Test Admin Accounting",
    email: "test.admin.accounting@example.com",
    roleId: "ADMIN_ACCOUNTING",
    roleName: ROLE_LABELS.ADMIN_ACCOUNTING,
    branchCode: "",
    branchName: "",
    isActive: true,
    updatedAt: "2026-06-22",
  },
  {
    id: "9000000004",
    employeeId: "9000000004",
    name: "Test User",
    email: "test.user@example.com",
    roleId: "USER",
    roleName: ROLE_LABELS.USER,
    branchCode: "",
    branchName: "",
    isActive: true,
    updatedAt: "2026-06-22",
  },
];

const EMPTY_FORM: UserFormValue = {
  employeeId: "",
  name: "",
  email: "",
  password: "",
  roleId: "USER",
  branchCode: "",
  isActive: true,
};

export default function ClientPage() {
  const router = useRouter();
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

  const [users, setUsers] = useState<UserRow[]>(INITIAL_USERS);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [formValue, setFormValue] = useState<UserFormValue>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof UserFormValue, string>>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);

  useEffect(() => {
    const authUrl = API_BASE_URL ? `${API_BASE_URL}/auth/me` : "/auth/me";

    fetch(authUrl, {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) {
          router.push("/");
        }
      })
      .catch(() => {
        router.push("/");
      });
  }, [API_BASE_URL, router]);

  useEffect(() => {
    if (!API_BASE_URL) return;

    fetch(`${API_BASE_URL}/users/search?include_inactive=1`, {
      credentials: "include",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (body?.users) {
          setUsers(body.users.map(toUserRow));
        }
      });
  }, [API_BASE_URL]);

  useEffect(() => {
    if (!API_BASE_URL) return;

    fetch(`${API_BASE_URL}/branches?is_active=true`, {
      credentials: "include",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (body?.branches) {
          setBranches(
            body.branches
              .map(toBranchOption)
              .filter((branch: BranchOption) => branch.branchCode),
          );
        }
      });
  }, [API_BASE_URL]);

  const filteredUsers = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return users.filter((user) => {
      if (!showInactive && !user.isActive) return false;
      if (!keyword) return true;

      return [
        user.employeeId,
        user.name,
        user.email,
        user.roleId,
        user.roleName,
        roleLabel(user),
        user.branchCode,
        user.branchName,
        user.isActive ? "有効" : "無効",
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [query, showInactive, users]);

  const openCreate = () => {
    setFormMode("create");
    setFormValue({
      ...EMPTY_FORM,
      employeeId: nextEmployeeId(users),
      password: "TempUser123!",
    });
    setFormErrors({});
  };

  const openEdit = (user: UserRow) => {
    setFormMode("edit");
    setFormValue({
      id: user.id,
      employeeId: user.employeeId,
      name: user.name,
      email: user.email,
      password: "",
      roleId: normalizeRoleForForm(user.roleId),
      branchCode: user.branchCode,
      isActive: user.isActive,
    });
    setFormErrors({});
  };

  const closeForm = () => {
    setFormMode(null);
    setFormValue(EMPTY_FORM);
    setFormErrors({});
    setSaving(false);
  };

  const saveUser = async () => {
    const errors = validateUser(formValue, users, formMode);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0 || !formMode) return;

    setSaving(true);
    const updatedAt = formatDate(new Date());

    try {
      if (formMode === "create") {
        let createdUser = toUserRow({
          ...toUserPayload(formValue),
          id: formValue.employeeId,
          updated_at: updatedAt,
        });

        if (API_BASE_URL) {
          const body = await requestJson(`${API_BASE_URL}/new_users`, {
            method: "POST",
            body: JSON.stringify(toUserPayload(formValue)),
          });
          createdUser = toUserRow(body.user);
        }

        setUsers((current) => [createdUser, ...current]);
      } else {
        let updatedUser = toUserRow({
          ...toUserPayload(formValue),
          id: formValue.id ?? formValue.employeeId,
          updated_at: updatedAt,
        });

        if (API_BASE_URL) {
          const body = await requestJson(
            `${API_BASE_URL}/users/${encodeURIComponent(formValue.employeeId)}`,
            {
              method: "PUT",
              body: JSON.stringify(toUserPayload(formValue)),
            },
          );
          updatedUser = toUserRow(body.user);
        }

        setUsers((current) =>
          current.map((user) =>
            user.employeeId === formValue.employeeId ? updatedUser : user,
          ),
        );
      }

      closeForm();
    } catch {
      setFormErrors({ email: "保存に失敗しました" });
      setSaving(false);
    }
  };

  const disableUser = async () => {
    if (!deleteTarget) return;

    try {
      if (API_BASE_URL) {
        await requestJson(
          `${API_BASE_URL}/users/${encodeURIComponent(deleteTarget.employeeId)}`,
          { method: "DELETE" },
        );
      }

      setUsers((current) =>
        current.map((user) =>
          user.employeeId === deleteTarget.employeeId
            ? { ...user, isActive: false, updatedAt: formatDate(new Date()) }
            : user,
        ),
      );
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="page dashboard-page">
      <div className="dashboard-wrap">
        <section className="dashboard-card dashboard-header-card">
          <div className="dashboard-head page-header">
            <div>
              <h1 className="page-title dashboard-title">ユーザ管理</h1>
              <p className="dashboard-sub">
                ユーザの検索、登録、編集、無効化を管理します。
              </p>
            </div>
            <button type="button" className="btn btn-dark" onClick={openCreate}>
              + 新規登録
            </button>
          </div>
        </section>

        <section className="dashboard-card">
          <div className="dashboard-controls">
            <input
              className="cell-input"
              placeholder="社員ID/氏名/メール/権限で検索"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <label>
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(event) => setShowInactive(event.target.checked)}
              />
              無効データを表示
            </label>
          </div>
          <div className="dashboard-sub">
            表示件数: <strong>{filteredUsers.length}</strong>
          </div>
        </section>

        <section className="dashboard-table-wrap">
          <div className="dashboard-table-scroll">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>社員ID</th>
                  <th>氏名</th>
                  <th>メール</th>
                  <th>権限</th>
                  <th>支店</th>
                  <th className="center">状態</th>
                  <th>更新日</th>
                  <th className="center">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user, index) => (
                  <tr
                    key={user.employeeId}
                    className={index % 2 === 0 ? "row-even" : "row-odd"}
                  >
                    <td>{user.employeeId}</td>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>{roleLabel(user)}</td>
                    <td>{branchLabel(user.branchCode, user.branchName)}</td>
                    <td className="center">{user.isActive ? "有効" : "無効"}</td>
                    <td>{user.updatedAt}</td>
                    <td className="center">
                      <div className="dashboard-controls">
                        <button type="button" className="btn" onClick={() => openEdit(user)}>
                          編集
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={!user.isActive}
                          onClick={() => setDeleteTarget(user)}
                        >
                          無効化
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td className="center" colSpan={8}>
                      該当するユーザがありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {formMode && (
        <div className="modal-backdrop" onClick={closeForm}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h2>{formMode === "create" ? "ユーザ登録" : "ユーザ編集"}</h2>
            <UserForm
              mode={formMode}
              value={formValue}
              errors={formErrors}
              saving={saving}
              branches={branches}
              onChange={setFormValue}
              onSubmit={saveUser}
              onCancel={closeForm}
            />
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h2>ユーザ無効化</h2>
            <p className="dashboard-sub">
              {deleteTarget.name} を無効化します。データは削除されません。
            </p>
            <div className="dashboard-controls">
              <button type="button" className="btn btn-dark" onClick={disableUser}>
                無効化
              </button>
              <button type="button" className="btn" onClick={() => setDeleteTarget(null)}>
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UserForm({
  mode,
  value,
  errors,
  saving,
  branches,
  onChange,
  onSubmit,
  onCancel,
}: {
  mode: "create" | "edit";
  value: UserFormValue;
  errors: Partial<Record<keyof UserFormValue, string>>;
  saving: boolean;
  branches: BranchOption[];
  onChange: (value: UserFormValue) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const setField = <K extends keyof UserFormValue>(key: K, nextValue: UserFormValue[K]) => {
    onChange({ ...value, [key]: nextValue });
  };
  const branchOptions =
    value.branchCode && !branches.some((branch) => branch.branchCode === value.branchCode)
      ? [{ branchCode: value.branchCode, branchName: "" }, ...branches]
      : branches;

  return (
    <div className="help-grid">
      <Field label="社員ID" error={errors.employeeId}>
        <input
          aria-label="社員ID"
          className={`cell-input${errors.employeeId ? " error" : ""}`}
          value={value.employeeId}
          disabled={mode === "edit"}
          onChange={(event) => setField("employeeId", event.target.value)}
        />
      </Field>
      <Field label="氏名" error={errors.name}>
        <input
          aria-label="氏名"
          className={`cell-input${errors.name ? " error" : ""}`}
          value={value.name}
          onChange={(event) => setField("name", event.target.value)}
        />
      </Field>
      <Field label="メール" error={errors.email}>
        <input
          aria-label="メール"
          className={`cell-input${errors.email ? " error" : ""}`}
          type="email"
          value={value.email}
          onChange={(event) => setField("email", event.target.value)}
        />
      </Field>
      {mode === "create" && (
        <Field label="初期パスワード" error={errors.password}>
          <input
            aria-label="初期パスワード"
            className={`cell-input${errors.password ? " error" : ""}`}
            value={value.password}
            onChange={(event) => setField("password", event.target.value)}
          />
        </Field>
      )}
      <Field label="権限">
        <select
          aria-label="権限"
          className="cell-input"
          value={value.roleId}
          onChange={(event) => setField("roleId", event.target.value as RoleCode)}
        >
          {ROLE_OPTIONS.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="支店">
        <select
          aria-label="支店"
          className="cell-input"
          value={value.branchCode}
          onChange={(event) => setField("branchCode", event.target.value)}
        >
          <option value="">支店を選択してください</option>
          {branchOptions.map((branch) => (
            <option key={branch.branchCode} value={branch.branchCode}>
              {branchOptionLabel(branch)}
            </option>
          ))}
        </select>
      </Field>
      <label className="muted">
        <input
          type="checkbox"
          checked={value.isActive}
          onChange={(event) => setField("isActive", event.target.checked)}
        />
        有効
      </label>
      <div className="dashboard-controls">
        <button type="button" className="btn btn-dark" disabled={saving} onClick={onSubmit}>
          {saving ? "保存中..." : mode === "create" ? "登録" : "更新"}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          キャンセル
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="muted">{label}</div>
      {children}
      {error && <div className="error">{error}</div>}
    </div>
  );
}

function validateUser(
  value: UserFormValue,
  users: UserRow[],
  mode: "create" | "edit" | null,
) {
  const errors: Partial<Record<keyof UserFormValue, string>> = {};

  if (!/^\d{10}$/.test(value.employeeId.trim())) {
    errors.employeeId = "社員IDは10桁の数字で入力してください";
  }
  if (!value.name.trim()) {
    errors.name = "氏名は必須です";
  }
  if (!/^\S+@\S+\.\S+$/.test(value.email.trim())) {
    errors.email = "メール形式が正しくありません";
  }
  if (mode === "create" && value.password.length < 8) {
    errors.password = "初期パスワードは8文字以上で入力してください";
  }

  const duplicatedEmail = users.some(
    (user) =>
      user.email.toLowerCase() === value.email.trim().toLowerCase() &&
      user.employeeId !== value.employeeId,
  );
  if (duplicatedEmail) {
    errors.email = "同じメールアドレスが既に登録されています";
  }

  return errors;
}

function toUserPayload(value: UserFormValue) {
  return {
    employee_id: value.employeeId.trim(),
    name: value.name.trim(),
    email: value.email.trim(),
    password: value.password,
    role: value.roleId,
    role_id: value.roleId,
    branch_code: value.branchCode.trim() || null,
    employment_status: value.isActive ? "active" : "inactive",
    is_active: value.isActive,
  };
}

function toUserRow(row: Record<string, any>): UserRow {
  const roleId = normalizeRoleId(firstNonEmpty(row.role_id, row.roleId) ?? firstNonEmpty(row.role));
  const roleName = String(row.role_name ?? row.roleName ?? "").trim();
  const employeeId = String(row.employee_id ?? row.employeeId ?? "");
  const branchCode = String(row.branch_code ?? row.branchCode ?? "");

  return {
    id: String(row.id ?? employeeId),
    employeeId,
    name: String(row.name ?? row.username ?? ""),
    email: String(row.email ?? ""),
    roleId,
    roleName,
    branchCode,
    branchName: String(row.branch_name ?? row.branchName ?? ""),
    isActive: Boolean(row.is_active ?? row.isActive ?? row.employment_status !== "inactive"),
    updatedAt: String(row.updated_at ?? row.updatedAt ?? "").slice(0, 10) || "-",
  };
}

function toBranchOption(row: Record<string, any>): BranchOption {
  return {
    branchCode: String(row.branch_code ?? row.branchCode ?? ""),
    branchName: String(row.branch_name ?? row.branchName ?? ""),
  };
}

function firstNonEmpty(...values: unknown[]) {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return value;
    }
  }
  return undefined;
}

function normalizeRoleId(value: unknown) {
  return String(value || "").trim().toUpperCase().replace(/[-\s]/g, "_");
}

function normalizeRoleForForm(value: unknown): RoleCode {
  const role = normalizeRoleId(value);
  if (role === "ADMIN" || role === "ACCOUNTING" || role === "ADMIN_ACCOUNTING" || role === "USER") {
    return role;
  }
  if (role === "EMPLOYEE" || role === "GENERAL") {
    return "USER";
  }
  if (role === "ADMINACCOUNTING") {
    return "ADMIN_ACCOUNTING";
  }
  return "USER";
}

function roleLabel(user: Pick<UserRow, "roleId" | "roleName">) {
  if (user.roleName) return user.roleName;
  if (!user.roleId) return "-";
  return ROLE_LABELS[user.roleId as RoleCode] ?? user.roleId;
}

function branchLabel(branchCode: string, branchName: string) {
  if (branchCode && branchName) return `${branchCode} ${branchName}`;
  return branchName || branchCode || "-";
}

function branchOptionLabel(branch: BranchOption) {
  return branchLabel(branch.branchCode, branch.branchName);
}

function nextEmployeeId(users: UserRow[]) {
  const max = users.reduce((current, user) => {
    return /^\d+$/.test(user.employeeId)
      ? Math.max(current, Number(user.employeeId))
      : current;
  }, 0);
  return String(max + 1).padStart(10, "0");
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function requestJson(url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    ...init,
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error ?? "API request failed");
  }
  return body;
}
