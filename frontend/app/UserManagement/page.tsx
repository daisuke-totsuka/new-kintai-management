"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type UserRow = {
  id: string;
  name: string;
  furigana: string;
  email: string;
  employeeCode?: string;
  branchName: string;
  isAdmin: boolean;
  isAccounting: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const DUMMY_USERS: UserRow[] = [
  {
    id: "u1",
    name: "山田 太郎",
    furigana: "ヤマダ タロウ",
    email: "yamada@example.com",
    employeeCode: "A001",
    branchName: "東京",
    isAdmin: true,
    isAccounting: false,
    isActive: true,
    createdAt: "2026-02-01",
    updatedAt: "2026-02-10",
  },
  {
    id: "u2",
    name: "佐藤 花子",
    furigana: "サトウ ハナコ",
    email: "sato@example.com",
    employeeCode: "A002",
    branchName: "大阪",
    isAdmin: false,
    isAccounting: true,
    isActive: true,
    createdAt: "2026-02-03",
    updatedAt: "2026-02-08",
  },
  {
    id: "u3",
    name: "鈴木 一郎",
    furigana: "スズキ イチロウ",
    email: "suzuki@example.com",
    employeeCode: "A003",
    branchName: "名古屋",
    isAdmin: true,
    isAccounting: true,
    isActive: false,
    createdAt: "2026-01-20",
    updatedAt: "2026-02-05",
  },
];

export default function UserManagementPage() {
  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);
  const [onlyAdmin, setOnlyAdmin] = useState(false);
  const [onlyAccounting, setOnlyAccounting] = useState(false);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return DUMMY_USERS.filter((u) => {
      if (onlyActive && !u.isActive) return false;
      if (onlyAdmin && !u.isAdmin) return false;
      if (onlyAccounting && !u.isAccounting) return false;

      if (!kw) return true;
      const hay = `${u.name} ${u.furigana} ${u.email} ${u.employeeCode ?? ""} ${u.branchName}`.toLowerCase();
      return hay.includes(kw);
    });
  }, [q, onlyActive, onlyAdmin, onlyAccounting]);

  return (
    <div className="page dashboard-page">
      <div className="dashboard-wrap">
        <section className="dashboard-card">
          <div className="dashboard-head page-header">
            <div>
              <h1 className="page-title dashboard-title">ユーザ検索</h1>
              <p className="dashboard-sub">ユーザの登録・編集・権限（管理者/経理）を管理します。</p>
            </div>
            <Link href="/admin/users/new" className="btn btn-dark">
              + 新規登録
            </Link>
          </div>
        </section>

        <section className="dashboard-card">
          <div className="dashboard-controls">
            <input
              className="cell-input"
              placeholder="氏名/メール/社員コード/支店で検索"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />

            <label>
              <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
              在籍のみ
            </label>

            <label>
              <input type="checkbox" checked={onlyAdmin} onChange={(e) => setOnlyAdmin(e.target.checked)} />
              管理者のみ
            </label>

            <label>
              <input type="checkbox" checked={onlyAccounting} onChange={(e) => setOnlyAccounting(e.target.checked)} />
              経理のみ
            </label>
          </div>

          <div className="dashboard-sub">
            表示件数：<strong>{filtered.length}</strong>
          </div>
        </section>

        <section className="dashboard-table-wrap">
          <div className="dashboard-table-scroll">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>氏名</th>
                  <th>メール</th>
                  <th>支店</th>
                  <th className="center">管理者</th>
                  <th className="center">経理</th>
                  <th className="center">在籍</th>
                  <th>更新日</th>
                  <th>操作</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((u, i) => (
                  <tr key={u.id} className={i % 2 === 0 ? "row-even" : "row-odd"}>
                    <td>
                      <div className="month-cell">
                        <span>{u.name}</span>
                        <span className="month-id">{u.furigana}</span>
                      </div>
                    </td>

                    <td>{u.email}</td>
                    <td>{u.branchName}</td>

                    <td className="center">{u.isAdmin ? "✓" : ""}</td>
                    <td className="center">{u.isAccounting ? "✓" : ""}</td>

                    <td className="center">{u.isActive ? "✓" : ""}</td>

                    <td>{u.updatedAt}</td>

                    <td>
            <Link href="/admin/users/edit" className="btn btn-ghost">
              編集
            </Link>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td className="center" colSpan={8}>
                      該当するユーザがいません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
