type StatusKey = "none" | "draft" | "submitted" | "approved" | "rejected";

type SubordinateRow = {
  user_id: string;
  user_name: string;
  attendance_status: StatusKey;
  expense_status: StatusKey;
  billing_status: StatusKey;
  attendance_month_id: string | null;
};

type SubordinateTableProps = {
  rows: SubordinateRow[];
};

const STATUS_LABELS: Record<StatusKey, string> = {
  none: "未提出",
  draft: "下書き",
  submitted: "提出済",
  approved: "承認済",
  rejected: "差戻し",
};

const STATUS_TONES: Record<StatusKey, string> = {
  none: "muted",
  draft: "draft",
  submitted: "submitted",
  approved: "approved",
  rejected: "rejected",
};

function StatusBadge({ status }: { status: StatusKey }) {
  return (
    <span className={`leader-badge ${STATUS_TONES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export default function SubordinateTable({ rows }: SubordinateTableProps) {
  return (
    <div className="leader-table-wrap">
      <table className="table leader-table">
        <thead>
          <tr>
            <th>氏名</th>
            <th className="center">勤怠</th>
            <th className="center">経費</th>
            <th className="center">請求</th>
            <th className="center">勤怠ID</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.user_id}>
              <td>{row.user_name}</td>
              <td className="center">
                <StatusBadge status={row.attendance_status} />
              </td>
              <td className="center">
                <StatusBadge status={row.expense_status} />
              </td>
              <td className="center">
                <StatusBadge status={row.billing_status} />
              </td>
              <td className="center">{row.attendance_month_id ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
