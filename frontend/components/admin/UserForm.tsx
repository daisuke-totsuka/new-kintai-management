"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Mode = "create" | "edit";

type FormValue = {
  id?: string;
  name: string;
  furigana: string;
  email: string;
  employeeCode: string;
  branchId: string;
  isAdmin: boolean;
  isAccounting: boolean;
  isActive: boolean;
  tempPassword: string; // create時のみ利用（編集では再発行ボタンのみ想定）
};

const BRANCH_OPTIONS = [
  { id: "tokyo", name: "東京" },
  { id: "osaka", name: "大阪" },
  { id: "nagoya", name: "名古屋" },
];

function generateTempPassword(len = 12) {
  // 人が読みやすいように記号少なめ
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function isKatakanaOrSpace(s: string) {
  // カタカナ・長音・スペースの簡易チェック
  return /^[ァ-ヶー\s　]+$/.test(s);
}

export default function UserForm({
  mode,
  initialValue,
}: {
  mode: Mode;
  initialValue?: Partial<FormValue>;
}) {
  const init: FormValue = useMemo(
    () => ({
      id: initialValue?.id,
      name: initialValue?.name ?? "",
      furigana: initialValue?.furigana ?? "",
      email: initialValue?.email ?? "",
      employeeCode: initialValue?.employeeCode ?? "",
      branchId: initialValue?.branchId ?? BRANCH_OPTIONS[0].id,
      isAdmin: initialValue?.isAdmin ?? false,
      isAccounting: initialValue?.isAccounting ?? false,
      isActive: initialValue?.isActive ?? true,
      tempPassword: mode === "create" ? generateTempPassword() : "",
    }),
    [initialValue, mode]
  );

  const [v, setV] = useState<FormValue>(init);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function validate(next: FormValue) {
    const e: Record<string, string> = {};

    if (!next.name.trim()) e.name = "氏名は必須です";
    if (!next.email.trim()) e.email = "メールアドレスは必須です";
    if (next.email && !/^\S+@\S+\.\S+$/.test(next.email)) {
      e.email = "メール形式が正しくありません";
    }

    if (next.furigana && !isKatakanaOrSpace(next.furigana)) {
      e.furigana = "フリガナはカタカナで入力してください";
    }

    if (!next.branchId) e.branchId = "所属支店を選択してください";

    if (mode === "create") {
      if (!next.tempPassword) e.tempPassword = "仮パスワードが必要です";
      if (next.tempPassword && next.tempPassword.length < 8) {
        e.tempPassword = "仮パスワードは8文字以上推奨です";
      }
    }

    return e;
  }

  async function onSave() {
    const e = validate(v);
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSaving(true);
    try {
      // ここにAPI/Supabase呼び出しを後で入れる
      // 例: await upsertUser(v)
      await new Promise((r) => setTimeout(r, 500));
      alert(mode === "create" ? "登録しました（ダミー）" : "更新しました（ダミー）");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="dashboard-card">
        <div className="dashboard-head page-header">
          <div>
            <h1 className="page-title dashboard-title">
              {mode === "create" ? "ユーザ登録" : "ユーザ編集"}
            </h1>
            <p className="dashboard-sub">
              基本情報・権限（管理者/経理）・在籍を設定します。
            </p>
          </div>
          <Link href="/UserManagement" className="btn btn-ghost">
            一覧へ戻る
          </Link>
        </div>
      </section>

      <section className="dashboard-card">
        <h2 className="page-title">基本情報</h2>
        <div className="help-grid">
          <Field label="氏名（必須）" error={errors.name}>
            <input
              className={inputClass(!!errors.name)}
              value={v.name}
              onChange={(e) => setV((p) => ({ ...p, name: e.target.value }))}
              placeholder="例）山田 太郎"
            />
          </Field>

          <Field
            label="フリガナ"
            error={errors.furigana}
            hint="カタカナ推奨（例）ヤマダ タロウ"
          >
            <input
              className={inputClass(!!errors.furigana)}
              value={v.furigana}
              onChange={(e) => setV((p) => ({ ...p, furigana: e.target.value }))}
              placeholder="例）ヤマダ タロウ"
            />
          </Field>

          <Field label="メールアドレス（必須）" error={errors.email}>
            <input
              className={inputClass(!!errors.email)}
              value={v.email}
              onChange={(e) => setV((p) => ({ ...p, email: e.target.value }))}
              placeholder="例）user@example.com"
              type="email"
            />
          </Field>

          <Field label="社員コード">
            <input
              className={inputClass(false)}
              value={v.employeeCode}
              onChange={(e) => setV((p) => ({ ...p, employeeCode: e.target.value }))}
              placeholder="例）A001"
            />
          </Field>

          <Field label="所属支店" error={errors.branchId}>
            <select
              className={inputClass(!!errors.branchId)}
              value={v.branchId}
              onChange={(e) => setV((p) => ({ ...p, branchId: e.target.value }))}
            >
              {BRANCH_OPTIONS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>

          <label className="muted">
            <input
              type="checkbox"
              checked={v.isActive}
              onChange={(e) => setV((p) => ({ ...p, isActive: e.target.checked }))}
            />
            在籍中（OFFにすると退職扱い：削除はしません）
          </label>
        </div>
      </section>

      <section className="dashboard-card">
        <h2 className="page-title">権限設定</h2>
        <p className="dashboard-sub">管理者メニュー／経理メニューは両方ONにできます。</p>

        <div className="help-grid">
          <label className="muted">
            <input
              type="checkbox"
              checked={v.isAdmin}
              onChange={(e) => setV((p) => ({ ...p, isAdmin: e.target.checked }))}
            />
            管理者メニューを使用可能
          </label>

          <label className="muted">
            <input
              type="checkbox"
              checked={v.isAccounting}
              onChange={(e) =>
                setV((p) => ({ ...p, isAccounting: e.target.checked }))
              }
            />
            経理メニューを使用可能
          </label>
        </div>
      </section>

      <section className="dashboard-card">
        <h2 className="page-title">アカウント設定</h2>
        {mode === "create" ? (
          <>
            <Field label="仮パスワード" error={errors.tempPassword}>
              <div className="dashboard-controls">
                <input
                  className={inputClass(!!errors.tempPassword)}
                  value={v.tempPassword}
                  onChange={(e) =>
                    setV((p) => ({ ...p, tempPassword: e.target.value }))
                  }
                />
                <button
                  type="button"
                  className="btn"
                  onClick={() =>
                    setV((p) => ({ ...p, tempPassword: generateTempPassword() }))
                  }
                >
                  自動生成
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() =>
                    setV((p) => ({ ...p, tempPassword: generateTempPassword() }))
                  }
                >
                  再生成
                </button>
              </div>
            </Field>

            <p className="dashboard-sub">
              ※ Supabase招待方式にする場合、この欄は「招待メール送信」に置き換え可能です。
            </p>
          </>
        ) : (
          <>
            <p className="dashboard-sub">
              編集時はパスワードを表示しません。必要なら再発行フロー（招待/リセット）を用意してください。
            </p>
            <button type="button" className="btn">
              パスワード再発行（将来実装）
            </button>
          </>
        )}
      </section>

      <section className="dashboard-card">
        <div className="dashboard-controls">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="btn btn-dark"
          >
            {saving ? "保存中..." : "保存"}
          </button>

          <Link href="/UserManagement" className="btn">
            キャンセル
          </Link>
        </div>
      </section>
    </>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-sm font-medium">{label}</div>
      {hint && <div className="text-xs text-gray-600">{hint}</div>}
      <div className="help-grid">{children}</div>
      {error && <div className="text-xs text-red-600">{error}</div>}
    </div>
  );
}

function inputClass(isError: boolean) {
  return `cell-input${isError ? " error" : ""}`;
}
