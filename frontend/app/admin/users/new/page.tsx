"use client";

import UserForm from "@/components/admin/UserForm";

export default function NewUserPage() {
  return (
    <div className="page dashboard-page">
      <div className="dashboard-wrap">
        <UserForm mode="create" />
      </div>
    </div>
  );
}
