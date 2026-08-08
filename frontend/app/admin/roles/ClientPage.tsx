"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import RoleForm, {
  MenuOption,
  RoleFormValue,
} from "@/components/admin/RoleForm";
import RoleList, {
  RoleMenuSummary,
  RoleRow,
} from "@/components/admin/RoleList";

const EMPTY_FORM: RoleFormValue = {
  roleId: "",
  roleName: "",
  description: "",
  isActive: true,
  menuIds: [],
};

export default function ClientPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [menus, setMenus] = useState<MenuOption[]>([]);
  const [query, setQuery] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [formValue, setFormValue] = useState<RoleFormValue>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof RoleFormValue, string>>
  >({});
  const [saving, setSaving] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => {
    if (!API_BASE_URL) return;

    fetch(`${API_BASE_URL}/auth/me`, {
      credentials: "include",
    }).then((res) => {
      if (!res.ok) {
        router.push("/");
      }
    });
  }, [API_BASE_URL, router]);

  const loadRoles = useCallback(async () => {
    if (!API_BASE_URL) return;

    setLoading(true);
    setError("");

    try {
      const [rolesBody, menusBody] = await Promise.all([
        requestJson(`${API_BASE_URL}/roles`),
        requestJson(`${API_BASE_URL}/menus`),
      ]);

      setRoles((rolesBody.roles ?? []).map(toRoleRow).sort(compareRoleRows));
      setMenus((menusBody.menus ?? []).map(toMenuOption).sort(compareMenus));
    } catch {
      setError("権限情報の取得に失敗しました");
      setRoles([]);
      setMenus([]);
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const filteredRoles = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return roles.filter((role) => {
      if (onlyActive && !role.isActive) return false;
      if (!keyword) return true;

      return [
        role.roleId,
        role.roleName,
        role.description,
        role.isActive ? "有効" : "無効",
        ...role.menus.map((menu) => menu.menuName),
        ...role.menus.map((menu) => menu.menuId),
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [onlyActive, query, roles]);

  const openCreate = () => {
    setFormMode("create");
    setFormValue(EMPTY_FORM);
    setEditingRoleId(null);
    setFormErrors({});
  };

  const openEdit = (role: RoleRow) => {
    setFormMode("edit");
    setEditingRoleId(role.roleId);
    setFormValue({
      roleId: role.roleId,
      roleName: role.roleName,
      description: role.description,
      isActive: role.isActive,
      menuIds: role.menuIds,
    });
    setFormErrors({});
  };

  const closeForm = () => {
    setFormMode(null);
    setFormValue(EMPTY_FORM);
    setFormErrors({});
    setSaving(false);
    setEditingRoleId(null);
  };

  const saveRole = async () => {
    const errors = validateRole(formValue, roles, formMode, editingRoleId);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0 || !formMode) return;

    if (!API_BASE_URL) {
      setFormErrors({ roleName: "API URLが設定されていません" });
      return;
    }

    setSaving(true);

    try {
      if (formMode === "create") {
        const body = await requestJson(`${API_BASE_URL}/roles`, {
          method: "POST",
          body: JSON.stringify(toRolePayload(formValue)),
        });
        const createdRole = toRoleRow(body.role);
        setRoles((current) => [createdRole, ...current].sort(compareRoleRows));
      } else {
        const targetRoleId = editingRoleId ?? formValue.roleId;
        const body = await requestJson(
          `${API_BASE_URL}/roles/${encodeURIComponent(targetRoleId)}`,
          {
            method: "PUT",
            body: JSON.stringify(toRolePayload(formValue)),
          },
        );
        const updatedRole = toRoleRow(body.role);
        setRoles((current) =>
          current
            .map((role) =>
              role.roleId === targetRoleId ? updatedRole : role,
            )
            .sort(compareRoleRows),
        );
      }

      closeForm();
    } catch {
      setFormErrors({ roleName: "保存に失敗しました" });
      setSaving(false);
    }
  };

  return (
    <div className="page dashboard-page">
      <div className="dashboard-wrap">
        <section className="dashboard-card dashboard-header-card">
          <div className="dashboard-head page-header">
            <div>
              <h1 className="page-title dashboard-title">権限管理</h1>
              <p className="dashboard-sub">
                権限の検索、登録、編集、有効/無効を管理します。
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
              placeholder="権限コード/権限名/メニューで検索"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <label>
              <input
                type="checkbox"
                checked={onlyActive}
                onChange={(event) => setOnlyActive(event.target.checked)}
              />
              有効のみ
            </label>
            <button
              type="button"
              className="btn"
              disabled={loading}
              onClick={loadRoles}
            >
              再読み込み
            </button>
          </div>

          {error && <div className="dashboard-sub">{error}</div>}
          <div className="dashboard-sub">
            表示件数: <strong>{filteredRoles.length}</strong>
          </div>
        </section>

        <RoleList roles={filteredRoles} onEdit={openEdit} />
      </div>

      {formMode && (
        <div className="modal-backdrop" onClick={closeForm}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h2>{formMode === "create" ? "権限登録" : "権限編集"}</h2>
            <RoleForm
              mode={formMode}
              value={formValue}
              errors={formErrors}
              menus={menus}
              saving={saving}
              onChange={setFormValue}
              onSubmit={saveRole}
              onCancel={closeForm}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function validateRole(
  value: RoleFormValue,
  roles: RoleRow[],
  mode: "create" | "edit" | null,
  editingRoleId: string | null,
) {
  const errors: Partial<Record<keyof RoleFormValue, string>> = {};
  const roleId = normalizeRoleId(value.roleId);

  if (!roleId) {
    errors.roleId = "権限コードは必須です";
  } else if (!/^[A-Z0-9_]+$/.test(roleId)) {
    errors.roleId = "権限コードは英数字とアンダースコアで入力してください";
  } else {
    const duplicated = roles.some(
      (role) =>
        role.roleId.toLowerCase() === roleId.toLowerCase() &&
        (mode === "create" || role.roleId !== editingRoleId),
    );
    if (duplicated) {
      errors.roleId = "同じ権限コードが既に登録されています";
    }
  }

  if (!value.roleName.trim()) {
    errors.roleName = "権限名は必須です";
  }

  return errors;
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

function toRolePayload(value: RoleFormValue) {
  return {
    role_id: normalizeRoleId(value.roleId),
    role_name: value.roleName.trim(),
    description: value.description.trim(),
    is_active: value.isActive,
    menu_ids: value.menuIds,
  };
}

function toRoleRow(row: Record<string, any>): RoleRow {
  const roleId = String(row.role_id ?? row.roleId ?? "");
  const menus = ((row.menus ?? []) as Record<string, any>[]).map(toRoleMenu);
  const menuIds = Array.from(
    new Set([
      ...((row.menu_ids ?? row.menuIds ?? []) as string[]).map(normalizeRoleId),
      ...menus.map((menu) => menu.menuId),
    ]),
  ).filter(Boolean) as string[];

  return {
    id: roleId,
    roleId,
    roleName: String(row.role_name ?? row.roleName ?? ""),
    description: String(row.description ?? ""),
    isActive: row.is_active ?? row.isActive ?? true,
    menuIds,
    menus,
    updatedAt: String(row.updated_at ?? row.updatedAt ?? "").slice(0, 10),
  };
}

function toRoleMenu(row: Record<string, any>): RoleMenuSummary {
  return {
    menuId: String(row.menu_id ?? row.menuId ?? ""),
    menuName: String(row.menu_name ?? row.menuName ?? ""),
    menuCategory: String(row.menu_category ?? row.menuCategory ?? ""),
    menuPath: String(row.menu_path ?? row.menuPath ?? ""),
    isActive: row.is_active ?? row.isActive ?? true,
  };
}

function toMenuOption(row: Record<string, any>): MenuOption {
  return {
    menuId: String(row.menu_id ?? row.menuId ?? ""),
    menuName: String(row.menu_name ?? row.menuName ?? ""),
    menuCategory: String(row.menu_category ?? row.menuCategory ?? ""),
    menuPath: String(row.menu_path ?? row.menuPath ?? ""),
    isActive: row.is_active ?? row.isActive ?? true,
  };
}

function compareRoleRows(a: RoleRow, b: RoleRow) {
  return a.roleId.localeCompare(b.roleId);
}

function compareMenus(a: MenuOption, b: MenuOption) {
  const categoryOrder = new Map([
    ["USER", 0],
    ["ADMIN", 1],
    ["LEADER", 2],
    ["ACCOUNTING", 3],
  ]);
  return (
    (categoryOrder.get(a.menuCategory) ?? 99) -
      (categoryOrder.get(b.menuCategory) ?? 99) ||
    a.menuId.localeCompare(b.menuId)
  );
}

function normalizeRoleId(value: string) {
  return value.trim().toUpperCase().replace(/[-\s]/g, "_");
}
