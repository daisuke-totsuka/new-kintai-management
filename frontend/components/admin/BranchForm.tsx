export type BranchFormValue = {
  id?: string;
  branchCode: string;
  branchName: string;
  branchNameKana: string;
  postalCode: string;
  address: string;
  phone: string;
  managerEmployeeId: string;
  managerName: string;
  isActive: boolean;
};

type BranchFormProps = {
  mode: "create" | "edit";
  value: BranchFormValue;
  errors: Partial<Record<keyof BranchFormValue, string>>;
  saving?: boolean;
  onChange: (value: BranchFormValue) => void;
  onOpenManagerSearch: () => void;
  onSubmit: () => void;
  onCancel: () => void;
};

export default function BranchForm({
  mode,
  value,
  errors,
  saving = false,
  onChange,
  onOpenManagerSearch,
  onSubmit,
  onCancel,
}: BranchFormProps) {
  const setValue = <K extends keyof BranchFormValue>(
    key: K,
    nextValue: BranchFormValue[K],
  ) => {
    onChange({ ...value, [key]: nextValue });
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="help-grid">
        <Field label="支店コード（必須）" error={errors.branchCode}>
          <input
            className={inputClass(!!errors.branchCode)}
            value={value.branchCode}
            onChange={(event) => setValue("branchCode", event.target.value)}
            placeholder="例: B001"
          />
        </Field>

        <Field label="支店名（必須）" error={errors.branchName}>
          <input
            className={inputClass(!!errors.branchName)}
            value={value.branchName}
            onChange={(event) => setValue("branchName", event.target.value)}
            placeholder="例: 東京支店"
          />
        </Field>

        <Field label="支店名カナ">
          <input
            className="cell-input"
            value={value.branchNameKana}
            onChange={(event) => setValue("branchNameKana", event.target.value)}
            placeholder="例: トウキョウシテン"
          />
        </Field>

        <Field label="郵便番号">
          <input
            className="cell-input"
            value={value.postalCode}
            onChange={(event) => setValue("postalCode", event.target.value)}
            placeholder="例: 100-0001"
          />
        </Field>

        <Field label="住所">
          <input
            className="cell-input"
            value={value.address}
            onChange={(event) => setValue("address", event.target.value)}
            placeholder="例: 東京都千代田区千代田1-1"
          />
        </Field>

        <Field label="電話番号" error={errors.phone}>
          <input
            className={inputClass(!!errors.phone)}
            value={value.phone}
            onChange={(event) => setValue("phone", event.target.value)}
            placeholder="例: 03-1234-5678"
          />
        </Field>

        <Field label="支店責任者">
          <div className="manager-picker">
            <input
              className="cell-input"
              value={formatManager(value.managerEmployeeId, value.managerName)}
              readOnly
              placeholder="未選択"
            />
            <button type="button" className="btn" onClick={onOpenManagerSearch}>
              検索
            </button>
          </div>
        </Field>

        <label className="muted">
          <input
            type="checkbox"
            checked={value.isActive}
            onChange={(event) => setValue("isActive", event.target.checked)}
          />
          有効
        </label>

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
  children: React.ReactNode;
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

function formatManager(employeeId: string, name: string) {
  if (employeeId && name) return `[${employeeId}] ${name}`;
  if (employeeId) return `[${employeeId}]`;
  return name;
}
