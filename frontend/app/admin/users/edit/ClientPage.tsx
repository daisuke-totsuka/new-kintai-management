"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import UserForm from "@/components/admin/UserForm";

export default function ClientPage({
  user,
  params,
}: {
  user?: any;
  params?: { id: string };
} = {}) {
  const router = useRouter();
  const [initial, setInitial] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState("");

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

  useEffect(() => {
    const employeeId = params?.id;
    if (!API_BASE_URL || !employeeId) {
      setError("ユーザ情報を取得できませんでした");
      return;
    }

    fetch(`${API_BASE_URL}/users/search?employee_id=${encodeURIComponent(employeeId)}`, {
      credentials: "include",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        const userRow = body?.users?.[0];
        if (!userRow) {
          setError("ユーザ情報を取得できませんでした");
          setInitial(null);
          return;
        }

        setInitial(toInitialValue(userRow));
        setError("");
      })
      .catch(() => {
        setInitial(null);
        setError("ユーザ情報を取得できませんでした");
      });
  }, [API_BASE_URL, params?.id]);

  return (
    <div className="page dashboard-page">
      <div className="dashboard-wrap">
        {initial ? (
          <UserForm mode="edit" initialValue={initial} />
        ) : (
          <section className="dashboard-card">
            <p className="dashboard-sub">
              {error || "ユーザ情報を読み込み中です"}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

function toInitialValue(row: Record<string, any>) {
  return {
    id: String(row.id ?? row.employee_id ?? row.employeeId ?? ""),
    name: String(row.name ?? row.username ?? ""),
    furigana: String(row.kana_name ?? row.furigana ?? ""),
    email: String(row.email ?? ""),
    employeeCode: String(row.employee_id ?? row.employeeCode ?? ""),
    branchId: String(row.branch_code ?? row.branchId ?? ""),
    isAdmin: Boolean(row.is_admin ?? row.isAdmin ?? false),
    isAccounting: Boolean(row.is_accounting ?? row.isAccounting ?? false),
    isActive: Boolean(row.is_active ?? row.isActive ?? true),
  };
}
