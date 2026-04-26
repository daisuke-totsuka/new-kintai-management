"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import UserForm from "@/components/admin/UserForm";

// 本来はAPIで取得します。ここではダミー。
const DUMMY = {
  id: "u1",
  name: "山田 太郎",
  furigana: "ヤマダ タロウ",
  email: "yamada@example.com",
  employeeCode: "A001",
  branchId: "tokyo",
  isAdmin: true,
  isAccounting: false,
  isActive: true,
};

export default function ClientPage({
  user,
  params,
}: {
  user?: any;
  params?: { id: string };
} = {}) {
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

  // params.id で取得する想定。今回は固定ダミー。
  const initial = { ...DUMMY, id: params?.id ?? DUMMY.id };

  return (
    <div className="page dashboard-page">
      <div className="dashboard-wrap">
        <UserForm mode="edit" initialValue={initial} />
      </div>
    </div>
  );
}

//export default function ClientPage({ user }: { user: any }) {
// params.id で取得する想定。今回は固定ダミー。
//  const initial = { ...DUMMY, id: params.id };

//  return (
//    <div className="page dashboard-page">
//      <div className="dashboard-wrap">
//        <UserForm mode="edit" initialValue={initial} />
//      </div>
//    </div>
//  );
//}
