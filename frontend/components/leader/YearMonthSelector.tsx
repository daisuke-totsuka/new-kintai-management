type YearMonthSelectorProps = {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
};

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function YearMonthSelector({
  year,
  month,
  onChange,
}: YearMonthSelectorProps) {
  const years = [year - 1, year, year + 1];

  return (
    <div className="leader-ym">
      <label className="leader-ym-label">
        年
        <select
          className="leader-ym-select"
          value={year}
          onChange={(e) => onChange(Number(e.target.value), month)}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>
      <label className="leader-ym-label">
        月
        <select
          className="leader-ym-select"
          value={month}
          onChange={(e) => onChange(year, Number(e.target.value))}
        >
          {MONTHS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
