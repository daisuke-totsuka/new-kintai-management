"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type RoleRow = {
  role_code: string;
  role_name: string;
  description: string;
  display_order: number;
};

const DEFAULT_ROLES: RoleRow[] = [
  {
    role_code: "ADMIN",
    role_name: "管理者",
    description: "管理メニューと一般メニューを利用できます",
    display_order: 10,
  },
  {
    role_code: "ACCOUNTING",
    role_name: "経理",
    description: "経理メニューを利用できます",
    display_order: 20,
  },
  {
    role_code: "ADMIN_ACCOUNTING",
    role_name: "管理者兼経理",
    description: "管理者と経理の全機能を利用できます",
    display_order: 30,
  },
  {
    role_code: "USER",
    role_name: "一般ユーザ",
    description: "一般メニューを利用できます",
    display_order: 40,
  },
];

const MENU_BY_ROLE: Record<string, string[]> = {
  ADMIN: [
    "勤務実績",
    "通常出勤時間設定",
    "経費請求",
    "業務請求分明細",
    "ユーザ検索",
    "ユーザ登録",
    "ユーザ編集",
    "支店管理",
    "権限管理",
  ],
  ACCOUNTING: ["提出状況", "勤務表設定"],
  ADMIN_ACCOUNTING: [
    "勤務実績",
    "通常出勤時間設定",
    "経費請求",
    "業務請求分明細",
    "提出状況",
    "勤務表設定",
    "ユーザ検索",
    "ユーザ登録",
    "ユーザ編集",
    "支店管理",
    "権限管理",
  ],
  USER: ["勤務実績", "通常出勤時間設定", "経費請求", "業務請求分明細"],
};

export default function ClientPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<RoleRow[]>(DEFAULT_ROLES);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => {
    if (!API_BASE_URL) return;

    fetch(`${API_BASE_URL}/auth/me`, {
      credentials: "include",
    }).then((res) => {
      if (!res.ok) {
        router.push("/");
      }
    });
  }, [API_BASE_URL, router]);

  useEffect(() => {
    if (!API_BASE_URL) return;

    setLoading(true);
    setError("");

    fetch(`${API_BASE_URL}/roles`, {
      credentials: "include",
    })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) {
          throw new Error(body?.error ?? "権限一覧の取得に失敗しました");
        }
        return body;
      })
      .then((body) => {
        setRoles((body.roles ?? DEFAULT_ROLES).map(toRoleRow));
      })
      .catch(() => {
        setError("権限一覧の取得に失敗しました");
        setRoles(DEFAULT_ROLES);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [API_BASE_URL]);

  const filteredRoles = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return roles;

    return roles.filter((role) =>
      [
        role.role_code,
        role.role_name,
        role.description,
        ...(MENU_BY_ROLE[role.role_code] ?? []),
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [query, roles]);

  return (
    <div className="page dashboard-page">
      <div className="dashboard-wrap">
        <section className="dashboard-card dashboard-header-card">
          <div className="dashboard-head page-header">
            <div>
              <h1 className="page-title dashboard-title">権限管理</h1>
              <p className="dashboard-sub">登録済み権限数: {roles.length}</p>
            </div>
            <button
              type="button"
              className="btn btn-dark"
              disabled={loading}
              onClick={() => window.location.reload()}
            >
              再読み込み
            </button>
          </div>
        </section>

        <section className="dashboard-card">
          <div className="dashboard-controls">
            <input
              className="cell-input"
              placeholder="権限コード/権限名/メニューで検索"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {error && <div className="dashboard-sub">{error}</div>}
        </section>

        <section className="dashboard-table-wrap">
          <div className="dashboard-table-scroll">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>権限コード</th>
                  <th>権限名</th>
                  <th>利用可能メニュー</th>
                  <th className="center">表示順</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoles.map((role, index) => (
                  <tr
                    key={role.role_code}
                    className={index % 2 === 0 ? "row-even" : "row-odd"}
                  >
                    <td>{role.role_code}</td>
                    <td>
                      <div className="month-cell">
                        <span>{role.role_name}</span>
                        <span className="month-id">{role.description}</span>
                      </div>
                    </td>
                    <td>{(MENU_BY_ROLE[role.role_code] ?? []).join(" / ")}</td>
                    <td className="center">{role.display_order}</td>
                  </tr>
                ))}

                {filteredRoles.length === 0 && (
                  <tr>
                    <td className="center" colSpan={4}>
                      該当する権限がありません
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

function toRoleRow(row: Record<string, unknown>): RoleRow {
  return {
    role_code: String(row.role_code ?? row.roleCode ?? ""),
    role_name: String(row.role_name ?? row.roleName ?? ""),
    description: String(row.description ?? ""),
    display_order: Number(row.display_order ?? row.displayOrder ?? 0),
  };
}
