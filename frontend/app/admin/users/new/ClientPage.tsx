"use client";

import { useMemo, useState } from "react";
import UserForm from "@/components/admin/UserForm";

export default function ClientPage({ user }: { user: any }) {
  return (
    <div className="page dashboard-page">
      <div className="dashboard-wrap">
        <UserForm mode="create" />
      </div>
    </div>
  );
}
