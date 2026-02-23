type StatusCounts = {
  none: number;
  submitted: number;
  approved: number;
  rejected: number;
  draft: number;
};

type StatusSummaryProps = {
  counts: StatusCounts;
};

const STATUS_ITEMS: Array<{ key: keyof StatusCounts; label: string }> = [
  { key: "none", label: "未提出" },
  { key: "draft", label: "下書き" },
  { key: "submitted", label: "提出済" },
  { key: "approved", label: "承認済" },
  { key: "rejected", label: "差戻し" },
];

export default function StatusSummary({ counts }: StatusSummaryProps) {
  return (
    <div className="leader-summary">
      {STATUS_ITEMS.map((item) => (
        <div key={item.key} className="leader-summary-card">
          <div className="leader-summary-label">{item.label}</div>
          <div className="leader-summary-value">{counts[item.key]}</div>
        </div>
      ))}
    </div>
  );
}
