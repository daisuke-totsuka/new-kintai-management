export type BranchRow = {
  id: string;
  branchCode: string;
  branchName: string;
  branchNameKana: string;
  postalCode: string;
  address: string;
  phone: string;
  managerEmployeeId: string;
  managerName: string;
  isActive: boolean;
  updatedAt: string;
};

type BranchListProps = {
  branches: BranchRow[];
  onEdit: (branch: BranchRow) => void;
  onDelete: (branch: BranchRow) => void;
};

export default function BranchList({
  branches,
  onEdit,
  onDelete,
}: BranchListProps) {
  return (
    <section className="dashboard-table-wrap">
      <div className="dashboard-table-scroll">
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>支店コード</th>
              <th>支店名</th>
              <th>住所</th>
              <th>電話番号</th>
              <th>支店責任者</th>
              <th className="center">状態</th>
              <th>更新日</th>
              <th>操作</th>
            </tr>
          </thead>

          <tbody>
            {branches.map((branch, index) => (
              <tr
                key={branch.id}
                className={index % 2 === 0 ? "row-even" : "row-odd"}
              >
                <td>{branch.branchCode}</td>
                <td>
                  <div className="month-cell">
                    <span>{branch.branchName}</span>
                    <span className="month-id">{branch.branchNameKana}</span>
                  </div>
                </td>
                <td>
                  <div className="month-cell">
                    <span>{branch.address}</span>
                    <span className="month-id">{branch.postalCode}</span>
                  </div>
                </td>
                <td>{branch.phone}</td>
                <td>{formatManager(branch.managerEmployeeId, branch.managerName)}</td>
                <td className="center">{branch.isActive ? "有効" : "削除済"}</td>
                <td>{branch.updatedAt}</td>
                <td>
                  <div className="dashboard-controls">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => onEdit(branch)}
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={!branch.isActive}
                      onClick={() => onDelete(branch)}
                    >
                      {branch.isActive ? "削除" : "削除済"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {branches.length === 0 && (
              <tr>
                <td className="center" colSpan={8}>
                  該当する支店がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatManager(employeeId: string, name: string) {
  if (employeeId && name) return `[${employeeId}] ${name}`;
  if (employeeId) return `[${employeeId}]`;
  return name;
}
