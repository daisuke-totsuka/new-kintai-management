"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import UserForm from "@/components/admin/UserForm";

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

  return (
    <div className="page dashboard-page">
      <div className="dashboard-wrap">
        <UserForm mode="create" />
      </div>
    </div>
  );
}
