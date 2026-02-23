"use client";
import React, { useMemo, useState } from "react";

/**
 * 経費請求（交通費）入力画面
 * - 初期表示：5行
 * - 行追加/行削除：発生日（年月）の右側に配置
 * - 行削除：5行以下は削除不可（ボタン無効化）
 * - 各行先頭：入力クリア（その行だけクリア）
 * - 一覧列：左から
 *   「入力クリア」「発生日」「交通機関など」「区間(から)」「区間(まで)」「種類」「片道・往復」「金額」「目的・備考」
 * - 「目的・備考」：手入力（text）
 * - 合計金額・申請送信：目的・備考の上（右上）に配置
 */

type ExpenseRow = {
  id: string;
  date: string; // YYYY-MM-DD
  transport: string;
  from: string;
  to: string;
  kind: string; // 定期/切符/駐輪場/ガソリン/その他
  tripType: string; // 片道/往復/その他
  amount: string; // number string
  note: string;
};

const KINDS = ["定期", "切符", "駐輪場", "ガソリン", "その他"] as const;
const TRIP_TYPES = ["片道", "往復", "その他"] as const;

// 「交通機関など」候補（必要なら自由入力に変更してください）
const TRANSPORTS = ["電車", "バス", "タクシー", "徒歩", "その他"] as const;

const MIN_ROWS = 5;

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function createEmptyRow(): ExpenseRow {
  return {
    id: uid(),
    date: "",
    transport: "",
    from: "",
    to: "",
    kind: "",
    tripType: "",
    amount: "",
    note: "",
  };
}

export default function ExpenseClaimScreen() {
  const today = new Date();
  const [year, setYear] = useState<number>(today.getFullYear());
  const [month, setMonth] = useState<number>(today.getMonth() + 1);

  const [rows, setRows] = useState<ExpenseRow[]>(
    Array.from({ length: MIN_ROWS }, () => createEmptyRow()),
  );

  const totalAmount = useMemo(() => {
    return rows.reduce((sum, r) => {
      const n = Number(String(r.amount).replace(/[^\d.-]/g, ""));
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
  }, [rows]);

  const canDeleteRow = rows.length > MIN_ROWS;

  const addRow = () => setRows((prev) => [...prev, createEmptyRow()]);

  const deleteRow = () => {
    setRows((prev) => {
      if (prev.length <= MIN_ROWS) return prev;
      return prev.slice(0, -1);
    });
  };

  const clearRow = (id: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...createEmptyRow(), id } : r)),
    );
  };

  const updateRow = <K extends keyof ExpenseRow>(
    id: string,
    key: K,
    value: ExpenseRow[K],
  ) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)),
    );
  };

  const submit = () => {
    // ここでAPI送信などに置き換え
    const payload = { year, month, rows };
    console.log("submit payload:", payload);
    alert("申請送信（デモ）しました。コンソールにpayloadを出力しています。");
  };

  const years = Array.from(
    { length: 6 },
    (_, i) => today.getFullYear() - 2 + i,
  );
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div style={styles.page}>
      <div className="title-card page-header">
        <div className="page-title">経費請求</div>
      </div>

      <div style={styles.card}>
        {/* 上部コントロール列 */}
        <div style={styles.topRow}>
          <div style={styles.leftControls}>
            <div style={styles.label}>発生日：</div>

            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              style={styles.select}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}年
                </option>
              ))}
            </select>

            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              style={styles.select}
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {String(m).padStart(2, "0")}月
                </option>
              ))}
            </select>

            {/* 行追加/行削除（年月の右側） */}
            <button
              onClick={addRow}
              style={{ ...styles.btn, ...styles.btnPrimary }}
            >
              ＋ 行追加
            </button>
            <button
              onClick={deleteRow}
              disabled={!canDeleteRow}
              style={{
                ...styles.btn,
                ...styles.btnGhost,
                ...(canDeleteRow ? null : styles.btnDisabled),
              }}
              title={canDeleteRow ? "" : "5行以下は削除できません"}
            >
              － 行削除
            </button>
          </div>

          {/* 合計金額・申請送信（目的・備考の上＝右上） */}
          <div style={styles.rightControls}>
            <div style={styles.total}>
              合計金額：
              <span style={styles.totalValue}>
                {totalAmount.toLocaleString()} 円
              </span>
            </div>
            <button
              onClick={submit}
              style={{ ...styles.btn, ...styles.btnSubmit }}
            >
              申請送信
            </button>
          </div>
        </div>

        {/* 一覧テーブル */}
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: 110 }}>入力クリア</th>
                <th style={{ ...styles.th, width: 140 }}>発生日</th>
                <th style={{ ...styles.th, width: 160 }}>交通機関など</th>
                <th style={{ ...styles.th, width: 160 }}>区間(から)</th>
                <th style={{ ...styles.th, width: 160 }}>区間(まで)</th>
                <th style={{ ...styles.th, width: 120 }}>種類</th>
                <th style={{ ...styles.th, width: 120 }}>片道・往復</th>
                <th style={{ ...styles.th, width: 140, textAlign: "right" }}>
                  金額
                </th>
                <th style={{ ...styles.th }}>目的・備考</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={styles.td}>
                    <button
                      type="button"
                      onClick={() => clearRow(r.id)}
                      style={{ ...styles.btn, ...styles.btnSmall }}
                    >
                      入力クリア
                    </button>
                  </td>

                  <td style={styles.td}>
                    <input
                      type="date"
                      value={r.date}
                      onChange={(e) => updateRow(r.id, "date", e.target.value)}
                      style={styles.input}
                    />
                  </td>

                  <td style={styles.td}>
                    <select
                      value={r.transport}
                      onChange={(e) =>
                        updateRow(r.id, "transport", e.target.value)
                      }
                      style={styles.selectFull}
                    >
                      <option value="">選択</option>
                      {TRANSPORTS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td style={styles.td}>
                    <input
                      value={r.from}
                      onChange={(e) => updateRow(r.id, "from", e.target.value)}
                      placeholder="例：東京"
                      style={styles.input}
                    />
                  </td>

                  <td style={styles.td}>
                    <input
                      value={r.to}
                      onChange={(e) => updateRow(r.id, "to", e.target.value)}
                      placeholder="例：大阪"
                      style={styles.input}
                    />
                  </td>

                  <td style={styles.td}>
                    <select
                      value={r.kind}
                      onChange={(e) => updateRow(r.id, "kind", e.target.value)}
                      style={styles.selectFull}
                    >
                      <option value="">選択</option>
                      {KINDS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td style={styles.td}>
                    <select
                      value={r.tripType}
                      onChange={(e) =>
                        updateRow(r.id, "tripType", e.target.value)
                      }
                      style={styles.selectFull}
                    >
                      <option value="">選択</option>
                      {TRIP_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td style={{ ...styles.td, textAlign: "right" }}>
                    <div style={styles.amountWrap}>
                      <input
                        inputMode="numeric"
                        value={r.amount}
                        onChange={(e) => {
                          // 数字とカンマだけ許容（必要なら厳密化）
                          const v = e.target.value.replace(/[^\d,]/g, "");
                          updateRow(r.id, "amount", v);
                        }}
                        placeholder="0"
                        style={{ ...styles.input, textAlign: "right" }}
                      />
                      <span style={styles.yen}>円</span>
                    </div>
                  </td>

                  <td style={styles.td}>
                    {/* 目的・備考：手入力 */}
                    <input
                      value={r.note}
                      onChange={(e) => updateRow(r.id, "note", e.target.value)}
                      placeholder="例：客先訪問、会議、出張など"
                      style={styles.input}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 5行以下で削除不可の補足表示（UI的にわかりやすく） */}
          {!canDeleteRow && (
            <div style={styles.helperText}>
              ※ 行削除は {MIN_ROWS} 行より多い場合のみ可能です。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    background: "#f3f6fb",
    minHeight: "100vh",
    padding: "24px 0",
  },
  card: {
    background: "#fff",
    borderRadius: 12,
    padding: 16,
    boxShadow: "0 10px 24px rgba(0,0,0,0.06)",
    border: "1px solid #e6eefb",
  },
  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "6px 4px 14px 4px",
  },
  leftControls: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  rightControls: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  label: {
    fontWeight: 700,
    color: "#1f2a44",
  },
  select: {
    height: 36,
    borderRadius: 8,
    border: "1px solid #cfd9ea",
    padding: "0 10px",
    background: "#fff",
    outline: "none",
  },
  selectFull: {
    width: "100%",
    height: 34,
    borderRadius: 8,
    border: "1px solid #cfd9ea",
    padding: "0 10px",
    background: "#fff",
    outline: "none",
  },
  input: {
    width: "100%",
    height: 34,
    borderRadius: 8,
    border: "1px solid #cfd9ea",
    padding: "0 10px",
    outline: "none",
    background: "#fff",
  },
  btn: {
    height: 36,
    borderRadius: 8,
    border: "1px solid #cfd9ea",
    padding: "0 12px",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 700,
    color: "#1f2a44",
  },
  btnSmall: {
    height: 32,
    padding: "0 10px",
    fontWeight: 700,
    border: "1px solid #d7e2f6",
    background: "#f7faff",
  },
  btnPrimary: {
    background: "#eaf2ff",
    border: "1px solid #bcd3ff",
    color: "#0b5ed7",
  },
  btnGhost: {
    background: "#fff",
  },
  btnDisabled: {
    opacity: 0.45,
    cursor: "not-allowed",
  },
  btnSubmit: {
    background: "#0b5ed7",
    border: "1px solid #0b5ed7",
    color: "#fff",
    boxShadow: "0 10px 18px rgba(11, 94, 215, 0.25)",
  },
  total: {
    fontWeight: 800,
    color: "#1f2a44",
    whiteSpace: "nowrap",
  },
  totalValue: {
    fontSize: 16,
  },
  tableWrap: {
    overflowX: "auto",
    borderTop: "1px solid #eef3ff",
    paddingTop: 10,
  },
  table: {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: 0,
    minWidth: 1100,
  },
  th: {
    position: "sticky",
    top: 0,
    background: "#f3f7ff",
    borderTop: "1px solid #dbe6fb",
    borderBottom: "1px solid #dbe6fb",
    borderRight: "1px solid #dbe6fb",
    padding: "10px 10px",
    textAlign: "left",
    fontWeight: 800,
    color: "#1f2a44",
    whiteSpace: "nowrap",
  },
  td: {
    borderBottom: "1px solid #edf2fb",
    borderRight: "1px solid #edf2fb",
    padding: "8px 10px",
    verticalAlign: "middle",
    background: "#fff",
  },
  amountWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  yen: {
    color: "#6b7a99",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  helperText: {
    marginTop: 10,
    color: "#6b7a99",
    fontSize: 13,
    fontWeight: 600,
  },
};
