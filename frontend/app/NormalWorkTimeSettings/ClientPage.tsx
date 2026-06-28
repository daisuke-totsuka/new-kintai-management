"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  cloneNormalWorkTimeSettings,
  createDefaultNormalWorkTimeSettings,
  type NormalWorkTimeSettings,
  type NumericField,
  type NumericValue,
  type SettingId,
} from "@/lib/normalWorkTimeSettings";

const SETTING_META: Record<
  SettingId,
  { title: string; applyLabel: string; description: string }
> = {
  until: {
    title: "日まで",
    applyLabel: "日まで",
    description: "月初から指定日までの通常勤務時間",
  },
  from: {
    title: "日から",
    applyLabel: "日から",
    description: "指定日から月末までの通常勤務時間",
  },
};

function toNumberValue(raw: string): NumericValue {
  if (raw === "") return "";
  const next = Number(raw);
  return Number.isFinite(next) ? next : "";
}

function isIntegerInRange(
  value: NumericValue,
  min: number,
  max: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  );
}

function timeToMinutes(hour: NumericValue, minute: NumericValue) {
  if (typeof hour !== "number" || typeof minute !== "number") return null;
  return hour * 60 + minute;
}

function errorKey(settingId: SettingId, field: NumericField | "timeRange") {
  return `${settingId}.${field}`;
}

function validateSettings(settings: NormalWorkTimeSettings) {
  const nextErrors: Record<string, string> = {};

  (Object.keys(settings) as SettingId[]).forEach((settingId) => {
    const setting = settings[settingId];

    if (!isIntegerInRange(setting.applyDay, 1, 31)) {
      nextErrors[errorKey(settingId, "applyDay")] =
        "適用日は1から31で入力してください";
    }

    if (!isIntegerInRange(setting.startHour, 0, 23)) {
      nextErrors[errorKey(settingId, "startHour")] =
        "始業時は0から23で入力してください";
    }

    if (!isIntegerInRange(setting.startMinute, 0, 59)) {
      nextErrors[errorKey(settingId, "startMinute")] =
        "始業分は0から59で入力してください";
    }

    if (!isIntegerInRange(setting.endHour, 0, 23)) {
      nextErrors[errorKey(settingId, "endHour")] =
        "終業時は0から23で入力してください";
    }

    if (!isIntegerInRange(setting.endMinute, 0, 59)) {
      nextErrors[errorKey(settingId, "endMinute")] =
        "終業分は0から59で入力してください";
    }

    if (!isIntegerInRange(setting.breakMinutes, 0, 1440)) {
      nextErrors[errorKey(settingId, "breakMinutes")] =
        "休憩は0から1440分で入力してください";
    }

    const start = timeToMinutes(setting.startHour, setting.startMinute);
    const end = timeToMinutes(setting.endHour, setting.endMinute);
    if (start !== null && end !== null && end <= start) {
      nextErrors[errorKey(settingId, "timeRange")] =
        "終業時刻は始業時刻より後にしてください";
    }

    if (
      start !== null &&
      end !== null &&
      typeof setting.breakMinutes === "number" &&
      setting.breakMinutes >= end - start
    ) {
      nextErrors[errorKey(settingId, "breakMinutes")] =
        "休憩は勤務時間より短くしてください";
    }
  });

  return nextErrors;
}

export default function ClientPage() {
  const router = useRouter();

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
  useEffect(() => {
    fetch(`${API_BASE_URL}/auth/me`, {
      credentials: "include",
    }).then((res) => {
      if (!res.ok) {
        router.push("/");
      }
    });
  }, [API_BASE_URL, router]);

  const [draft, setDraft] = useState<NormalWorkTimeSettings>(() =>
    createDefaultNormalWorkTimeSettings(),
  );
  const [saved, setSaved] = useState<NormalWorkTimeSettings>(() =>
    createDefaultNormalWorkTimeSettings(),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(saved),
    [draft, saved],
  );

  function updateNumberField(
    settingId: SettingId,
    field: NumericField,
    raw: string,
  ) {
    const nextValue = toNumberValue(raw);
    setDraft((prev) => ({
      ...prev,
      [settingId]: {
        ...prev[settingId],
        [field]: nextValue,
      },
    }));

    setErrors((prev) => {
      if (!prev[errorKey(settingId, field)] && !prev[errorKey(settingId, "timeRange")]) {
        return prev;
      }
      const next = { ...prev };
      delete next[errorKey(settingId, field)];
      delete next[errorKey(settingId, "timeRange")];
      return next;
    });
  }

  function onSave() {
    const nextErrors = validateSettings(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload = cloneNormalWorkTimeSettings(draft);
    console.log("SAVE normal work time settings:", payload);
    setSaved(payload);
    alert("保存しました（デモ）");
  }

  function onCancel() {
    setDraft(cloneNormalWorkTimeSettings(saved));
    setErrors({});
  }

  function onResetDefault() {
    setDraft(createDefaultNormalWorkTimeSettings());
    setErrors({});
  }

  function getError(settingId: SettingId, field: NumericField | "timeRange") {
    return errors[errorKey(settingId, field)];
  }

  function renderSettingCard(settingId: SettingId) {
    const setting = draft[settingId];
    const meta = SETTING_META[settingId];
    const rangeError = getError(settingId, "timeRange");

    return (
      <section className="dashboard-card normal-work-card" key={settingId}>
        <div className="normal-work-card-head">
          <div>
            <h2 className="normal-work-card-title">{meta.title}</h2>
            <div className="dashboard-sub">{meta.description}</div>
          </div>
          <span className="normal-work-chip">{meta.applyLabel}</span>
        </div>

        <div className="normal-work-fields">
          <label className="normal-work-field">
            <span className="normal-work-label">適用区分</span>
            <input
              className="cell-input"
              value={setting.applyType === "until" ? "日まで" : "日から"}
              disabled
              readOnly
            />
          </label>

          <label className="normal-work-field">
            <span className="normal-work-label">適用日</span>
            <div className="normal-work-input-unit">
              <input
                className={`cell-input ${
                  getError(settingId, "applyDay") ? "error" : ""
                }`}
                type="number"
                min={1}
                max={31}
                value={setting.applyDay}
                onChange={(e) =>
                  updateNumberField(settingId, "applyDay", e.target.value)
                }
              />
              <span className="normal-work-unit">日</span>
            </div>
            {getError(settingId, "applyDay") && (
              <div className="normal-work-error">
                {getError(settingId, "applyDay")}
              </div>
            )}
          </label>
        </div>

        <div className="normal-work-table-wrap">
          <table className="table normal-work-table">
            <thead>
              <tr>
                <th>項目</th>
                <th>時</th>
                <th>分</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="normal-work-row-label">始業時刻</td>
                <td>
                  <input
                    className={`cell-input ${
                      getError(settingId, "startHour") ? "error" : ""
                    }`}
                    type="number"
                    min={0}
                    max={23}
                    value={setting.startHour}
                    onChange={(e) =>
                      updateNumberField(settingId, "startHour", e.target.value)
                    }
                  />
                  {getError(settingId, "startHour") && (
                    <div className="normal-work-error">
                      {getError(settingId, "startHour")}
                    </div>
                  )}
                </td>
                <td>
                  <input
                    className={`cell-input ${
                      getError(settingId, "startMinute") ? "error" : ""
                    }`}
                    type="number"
                    min={0}
                    max={59}
                    value={setting.startMinute}
                    onChange={(e) =>
                      updateNumberField(
                        settingId,
                        "startMinute",
                        e.target.value,
                      )
                    }
                  />
                  {getError(settingId, "startMinute") && (
                    <div className="normal-work-error">
                      {getError(settingId, "startMinute")}
                    </div>
                  )}
                </td>
              </tr>

              <tr>
                <td className="normal-work-row-label">終業時刻</td>
                <td>
                  <input
                    className={`cell-input ${
                      getError(settingId, "endHour") ? "error" : ""
                    }`}
                    type="number"
                    min={0}
                    max={23}
                    value={setting.endHour}
                    onChange={(e) =>
                      updateNumberField(settingId, "endHour", e.target.value)
                    }
                  />
                  {getError(settingId, "endHour") && (
                    <div className="normal-work-error">
                      {getError(settingId, "endHour")}
                    </div>
                  )}
                </td>
                <td>
                  <input
                    className={`cell-input ${
                      getError(settingId, "endMinute") ? "error" : ""
                    }`}
                    type="number"
                    min={0}
                    max={59}
                    value={setting.endMinute}
                    onChange={(e) =>
                      updateNumberField(settingId, "endMinute", e.target.value)
                    }
                  />
                  {getError(settingId, "endMinute") && (
                    <div className="normal-work-error">
                      {getError(settingId, "endMinute")}
                    </div>
                  )}
                </td>
              </tr>

              <tr>
                <td className="normal-work-row-label">休憩</td>
                <td colSpan={2}>
                  <div className="normal-work-input-unit">
                    <input
                      className={`cell-input normal-work-break-input ${
                        getError(settingId, "breakMinutes") ? "error" : ""
                      }`}
                      type="number"
                      min={0}
                      value={setting.breakMinutes}
                      onChange={(e) =>
                        updateNumberField(
                          settingId,
                          "breakMinutes",
                          e.target.value,
                        )
                      }
                    />
                    <span className="normal-work-unit">分</span>
                  </div>
                  {getError(settingId, "breakMinutes") && (
                    <div className="normal-work-error">
                      {getError(settingId, "breakMinutes")}
                    </div>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {rangeError && <div className="normal-work-error">{rangeError}</div>}
      </section>
    );
  }

  return (
    <div className="page dashboard-page normal-work-time-settings">
      <div className="dashboard-wrap">
        <section className="dashboard-card dashboard-header-card">
          <div className="dashboard-head page-header">
            <div>
              <h1 className="page-title dashboard-title">通常出勤時間設定</h1>
              <p className="dashboard-sub">
                通常勤務の始業・終業・休憩時間を設定します。
              </p>
            </div>

            <div className="dashboard-controls">
              <button type="button" className="btn" onClick={onResetDefault}>
                初期値に戻す
              </button>
              <button
                type="button"
                className="btn"
                onClick={onCancel}
                disabled={!dirty}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="btn btn-dark"
                onClick={onSave}
                disabled={!dirty}
              >
                保存
              </button>
            </div>
          </div>
        </section>

        <div className="normal-work-grid">
          {renderSettingCard("until")}
          {renderSettingCard("from")}
        </div>

        <section className="dashboard-card normal-work-actions">
          <div className="normal-work-save-state">
            {dirty ? "未保存の変更があります" : "保存済み"}
          </div>
          <div className="dashboard-controls">
            <button
              type="button"
              className="btn"
              onClick={onCancel}
              disabled={!dirty}
            >
              キャンセル
            </button>
            <button
              type="button"
              className="btn btn-dark"
              onClick={onSave}
              disabled={!dirty}
            >
              保存
            </button>
          </div>
        </section>
      </div>

      <style>{css}</style>
    </div>
  );
}

const css = `
  .normal-work-time-settings {
    padding-bottom: 24px;
  }

  .normal-work-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .normal-work-card {
    display: grid;
    gap: 14px;
  }

  .normal-work-card-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .normal-work-card-title {
    margin: 0;
    color: var(--ink);
    font-size: 18px;
    font-weight: 700;
    line-height: 1.3;
  }

  .normal-work-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 64px;
    padding: 6px 10px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: #f3efe8;
    color: var(--muted);
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
  }

  .normal-work-fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .normal-work-field {
    display: grid;
    gap: 6px;
  }

  .normal-work-label {
    color: var(--muted);
    font-size: 13px;
    font-weight: 700;
  }

  .normal-work-input-unit {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .normal-work-input-unit .cell-input {
    min-width: 0;
  }

  .normal-work-unit {
    color: var(--muted);
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
  }

  .normal-work-table-wrap {
    overflow-x: auto;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--panel);
  }

  .normal-work-table {
    min-width: 420px;
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }

  .normal-work-table th,
  .normal-work-table td {
    vertical-align: middle;
  }

  .normal-work-table th {
    text-align: center;
  }

  .normal-work-table th:first-child {
    text-align: left;
  }

  .normal-work-row-label {
    width: 36%;
    font-weight: 700;
  }

  .normal-work-break-input {
    max-width: 160px;
  }

  .normal-work-error {
    color: var(--error);
    font-size: 12px;
    line-height: 1.5;
  }

  .normal-work-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .normal-work-save-state {
    color: var(--muted);
    font-size: 13px;
    font-weight: 700;
  }

  .normal-work-time-settings .cell-input:disabled {
    background: #f3efe8;
    color: var(--muted);
    cursor: not-allowed;
  }

  @media (max-width: 980px) {
    .normal-work-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .normal-work-fields {
      grid-template-columns: 1fr;
    }

    .normal-work-actions {
      align-items: flex-start;
      flex-direction: column;
    }
  }
`;
