import type { ReactNode } from "react";

export type RoleFormValue = {
  roleId: string;
  roleName: string;
  description: string;
  isActive: boolean;
  menuIds: string[];
};

export type MenuOption = {
  menuId: string;
  menuName: string;
  menuCategory: string;
  menuPath: string;
  isActive: boolean;
};

type RoleFormProps = {
  mode: "create" | "edit";
  value: RoleFormValue;
  errors: Partial<Record<keyof RoleFormValue, string>>;
  menus: MenuOption[];
  saving?: boolean;
  onChange: (value: RoleFormValue) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

const CATEGORY_ORDER = ["USER", "ADMIN", "LEADER", "ACCOUNTING"];
const CATEGORY_LABELS: Record<string, string> = {
  USER: "ユーザ権限",
  ADMIN: "管理権限",
  LEADER: "リーダー権限",
  ACCOUNTING: "経理権限",
};

export default function RoleForm({
  mode,
  value,
  errors,
  menus,
  saving = false,
  onChange,
  onSubmit,
  onCancel,
}: RoleFormProps) {
  const setValue = <K extends keyof RoleFormValue>(
    key: K,
    nextValue: RoleFormValue[K],
  ) => {
    onChange({ ...value, [key]: nextValue });
  };

  const toggleMenu = (menuId: string, checked: boolean) => {
    const nextMenuIds = checked
      ? [...value.menuIds, menuId]
      : value.menuIds.filter((currentMenuId) => currentMenuId !== menuId);
    setValue("menuIds", Array.from(new Set(nextMenuIds)));
  };

  const groupedMenus = groupMenus(menus);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="help-grid">
        <Field label="権限コード（必須）" error={errors.roleId}>
          <input
            className={inputClass(!!errors.roleId)}
            value={value.roleId}
            disabled={mode === "edit"}
            onChange={(event) => setValue("roleId", event.target.value)}
            placeholder="例: STORE_MANAGER"
          />
        </Field>

        <Field label="権限名（必須）" error={errors.roleName}>
          <input
            className={inputClass(!!errors.roleName)}
            value={value.roleName}
            onChange={(event) => setValue("roleName", event.target.value)}
            placeholder="例: 店舗管理者"
          />
        </Field>

        <Field label="説明">
          <textarea
            className="cell-input"
            value={value.description}
            onChange={(event) => setValue("description", event.target.value)}
            placeholder="権限の用途を入力"
            rows={3}
          />
        </Field>

        <label className="muted">
          <input
            type="checkbox"
            checked={value.isActive}
            onChange={(event) => setValue("isActive", event.target.checked)}
          />
          有効
        </label>

        <Field label="利用可能メニュー" error={errors.menuIds}>
          <div className="help-grid">
            {groupedMenus.map(({ category, menus: categoryMenus }) => (
              <div key={category}>
                <div className="text-sm font-medium">
                  {CATEGORY_LABELS[category] ?? category}
                </div>
                <div className="help-grid">
                  {categoryMenus.map((menu) => (
                    <label key={menu.menuId} className="muted">
                      <input
                        type="checkbox"
                        checked={value.menuIds.includes(menu.menuId)}
                        onChange={(event) =>
                          toggleMenu(menu.menuId, event.target.checked)
                        }
                      />
                      {menu.menuName}
                    </label>
                  ))}
                </div>
              </div>
            ))}

            {groupedMenus.length === 0 && (
              <div className="dashboard-sub">利用可能なメニューがありません</div>
            )}
          </div>
        </Field>

        <div className="dashboard-controls">
          <button type="submit" disabled={saving} className="btn btn-dark">
            {saving ? "保存中..." : mode === "create" ? "登録" : "更新"}
          </button>
          <button type="button" className="btn" onClick={onCancel}>
            キャンセル
          </button>
        </div>
      </div>
    </form>
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
      <div className="text-sm font-medium">{label}</div>
      <div className="help-grid">{children}</div>
      {error && <div className="text-xs text-red-600">{error}</div>}
    </div>
  );
}

function inputClass(isError: boolean) {
  return `cell-input${isError ? " error" : ""}`;
}

function groupMenus(menus: MenuOption[]) {
  const categoryOrder = new Map(
    CATEGORY_ORDER.map((category, index) => [category, index]),
  );
  const categories = Array.from(new Set(menus.map((menu) => menu.menuCategory)));

  return categories
    .sort(
      (a, b) =>
        (categoryOrder.get(a) ?? CATEGORY_ORDER.length) -
          (categoryOrder.get(b) ?? CATEGORY_ORDER.length) || a.localeCompare(b),
    )
    .map((category) => ({
      category,
      menus: menus.filter((menu) => menu.menuCategory === category),
    }));
}
