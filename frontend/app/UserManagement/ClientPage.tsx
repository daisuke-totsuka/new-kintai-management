"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

export default function ClientPage({ user }: { user?: any } = {}) {
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
  }, []);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);
  const [onlyAdmin, setOnlyAdmin] = useState(false);
  const [onlyAccounting, setOnlyAccounting] = useState(false);

  useEffect(() => {
    if (!API_BASE_URL) return;

    fetch(`${API_BASE_URL}/users/search?include_inactive=1`, {
      credentials: "include",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        setUsers((body?.users ?? []).map(toUserRow));
      })
      .catch(() => {
        setUsers([]);
      });
  }, [API_BASE_URL]);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return users.filter((u) => {
      if (onlyActive && !u.isActive) return false;
      if (onlyAdmin && !u.isAdmin) return false;
      if (onlyAccounting && !u.isAccounting) return false;

      if (!kw) return true;
      const hay =
        `${u.name} ${u.furigana} ${u.email} ${u.employeeCode ?? ""} ${u.branchName}`.toLowerCase();
      return hay.includes(kw);
    });
  }, [q, onlyActive, onlyAdmin, onlyAccounting, users]);

  return (
    <div className="page dashboard-page">
      <div className="dashboard-wrap">
        <section className="dashboard-card dashboard-header-card">
          <div className="dashboard-head page-header">
            <div>
              <h1 className="page-title dashboard-title">ユーザ検索</h1>
              <p className="dashboard-sub">
                ユーザの登録・編集・権限（管理者/経理）を管理します。
              </p>
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
              <input
                type="checkbox"
                checked={onlyActive}
                onChange={(e) => setOnlyActive(e.target.checked)}
              />
              在籍のみ
            </label>

            <label>
              <input
                type="checkbox"
                checked={onlyAdmin}
                onChange={(e) => setOnlyAdmin(e.target.checked)}
              />
              管理者のみ
            </label>

            <label>
              <input
                type="checkbox"
                checked={onlyAccounting}
                onChange={(e) => setOnlyAccounting(e.target.checked)}
              />
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
                  <tr
                    key={u.id}
                    className={i % 2 === 0 ? "row-even" : "row-odd"}
                  >
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

function toUserRow(row: Record<string, any>): UserRow {
  const employeeCode = String(row.employee_id ?? row.employeeCode ?? "");

  return {
    id: String(row.id ?? employeeCode),
    name: String(row.name ?? row.username ?? ""),
    furigana: String(row.kana_name ?? row.furigana ?? ""),
    email: String(row.email ?? ""),
    employeeCode,
    branchName: String(row.branch_name ?? row.branchName ?? ""),
    isAdmin: Boolean(row.is_admin ?? row.isAdmin ?? false),
    isAccounting: Boolean(row.is_accounting ?? row.isAccounting ?? false),
    isActive: Boolean(row.is_active ?? row.isActive ?? true),
    createdAt: String(row.created_at ?? row.createdAt ?? "").slice(0, 10),
    updatedAt: String(row.updated_at ?? row.updatedAt ?? "").slice(0, 10),
  };
}
