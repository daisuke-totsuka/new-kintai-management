"use client";

import { useState } from "react";

export type EmployeeSearchResult = {
  employee_id: string;
  name: string;
  email: string;
};

type EmployeeSearchModalProps = {
  open: boolean;
  apiBaseUrl?: string;
  onClose: () => void;
  onSelect: (employee: EmployeeSearchResult) => void;
};

const FALLBACK_EMPLOYEES: EmployeeSearchResult[] = [
  {
    employee_id: "0000000001",
    name: "山田 太郎",
    email: "yamada.taro@example.com",
  },
  {
    employee_id: "0000000002",
    name: "佐藤 花子",
    email: "sato.hanako@example.com",
  },
  {
    employee_id: "0000000003",
    name: "鈴木 一郎",
    email: "suzuki.ichiro@example.com",
  },
];

export default function EmployeeSearchModal({
  open,
  apiBaseUrl,
  onClose,
  onSelect,
}: EmployeeSearchModalProps) {
  const [employeeId, setEmployeeId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [employees, setEmployees] = useState<EmployeeSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const searchEmployees = async () => {
    setLoading(true);
    setError("");
    setSearched(true);

    try {
      if (apiBaseUrl) {
        const params = new URLSearchParams();
        if (employeeId.trim()) params.set("employee_id", employeeId.trim());
        if (name.trim()) params.set("name", name.trim());
        if (email.trim()) params.set("email", email.trim());

        const response = await fetch(`${apiBaseUrl}/users/search?${params.toString()}`, {
          credentials: "include",
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body?.error ?? "社員検索に失敗しました");
        }

        setEmployees((body.users ?? []).map(toEmployee));
      } else {
        setEmployees(
          FALLBACK_EMPLOYEES.filter((employee) =>
            matches(employee.employee_id, employeeId) &&
            matches(employee.name, name) &&
            matches(employee.email, email),
          ),
        );
      }
    } catch {
      setEmployees([]);
      setError("社員検索に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal employee-search-modal"
        role="dialog"
        aria-modal="true"
        aria-label="社員検索モーダル"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>社員検索</h2>

        <div className="help-grid">
          <div className="help-grid employee-search-grid">
            <Field label="社員番号">
              <input
                className="cell-input"
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                placeholder="例: 0000000001"
              />
            </Field>

            <Field label="氏名">
              <input
                className="cell-input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="例: 山田"
              />
            </Field>

            <Field label="メールアドレス">
              <input
                className="cell-input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="例: yamada"
              />
            </Field>
          </div>

          <div className="dashboard-controls employee-search-actions">
            <button
              type="button"
              className="btn btn-dark"
              disabled={loading}
              onClick={searchEmployees}
            >
              {loading ? "検索中..." : "検索"}
            </button>
            <button type="button" className="btn" onClick={onClose}>
              キャンセル
            </button>
          </div>

          {error && <div className="text-xs text-red-600">{error}</div>}

          <section className="dashboard-table-wrap">
            <div className="dashboard-table-scroll">
              <table className="dashboard-table employee-search-table">
                <thead>
                  <tr>
                    <th>社員番号</th>
                    <th>氏名</th>
                    <th>メールアドレス</th>
                    <th>選択</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee.employee_id}>
                      <td>{employee.employee_id}</td>
                      <td>{employee.name}</td>
                      <td>{employee.email}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => onSelect(employee)}
                        >
                          選択
                        </button>
                      </td>
                    </tr>
                  ))}

                  {searched && employees.length === 0 && !loading && (
                    <tr>
                      <td className="center" colSpan={4}>
                        該当する社員がありません
                      </td>
                    </tr>
                  )}

                  {!searched && (
                    <tr>
                      <td className="center" colSpan={4}>
                        検索条件を入力して検索してください
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-sm font-medium">{label}</div>
      <div className="help-grid">{children}</div>
    </div>
  );
}

function matches(value: string, keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) return true;

  return value.toLowerCase().includes(normalizedKeyword);
}

function toEmployee(row: Record<string, unknown>): EmployeeSearchResult {
  return {
    employee_id: String(row.employee_id ?? row.employeeId ?? ""),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
  };
}
