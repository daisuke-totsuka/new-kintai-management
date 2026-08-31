export type RoleMenuSummary = {
  menuId: string;
  menuName: string;
  menuCategory: string;
  menuPath: string;
  isActive: boolean;
};

export type RoleRow = {
  id: string;
  roleId: string;
  roleName: string;
  description: string;
  isActive: boolean;
  menuIds: string[];
  menus: RoleMenuSummary[];
  updatedAt: string;
};

type RoleListProps = {
  roles: RoleRow[];
  onEdit: (role: RoleRow) => void;
};

export default function RoleList({ roles, onEdit }: RoleListProps) {
  return (
    <section className="dashboard-table-wrap">
      <div className="dashboard-table-scroll">
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>権限コード</th>
              <th>権限名</th>
              <th>利用可能メニュー</th>
              <th className="center">状態</th>
              <th>更新日</th>
              <th>操作</th>
            </tr>
          </thead>

          <tbody>
            {roles.map((role, index) => (
              <tr
                key={role.id}
                className={index % 2 === 0 ? "row-even" : "row-odd"}
              >
                <td>{role.roleId}</td>
                <td>
                  <div className="month-cell">
                    <span>{role.roleName}</span>
                    <span className="month-id">{role.description}</span>
                  </div>
                </td>
                <td>{formatMenus(role.menus)}</td>
                <td className="center">{role.isActive ? "有効" : "無効"}</td>
                <td>{role.updatedAt}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => onEdit(role)}
                  >
                    編集
                  </button>
                </td>
              </tr>
            ))}

            {roles.length === 0 && (
              <tr>
                <td className="center" colSpan={6}>
                  該当する権限がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatMenus(menus: RoleMenuSummary[]) {
  if (menus.length === 0) {
    return "未設定";
  }
  return menus.map((menu) => menu.menuName).join(" / ");
}
