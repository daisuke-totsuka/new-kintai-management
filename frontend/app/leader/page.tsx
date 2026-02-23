"use client";

import { useState } from "react";
import YearMonthSelector from "@/components/leader/YearMonthSelector";
import StatusSummary from "@/components/leader/StatusSummary";
import SubordinateTable from "@/components/leader/SubordinateTable";

export default function LeaderPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const rows = [
    {
      user_id: "1",
      user_name: "山田太郎",
      attendance_status: "submitted",
      expense_status: "draft",
      billing_status: "submitted",
      attendance_month_id: "uuid-1",
    },
    {
      user_id: "2",
      user_name: "佐藤花子",
      attendance_status: "none",
      expense_status: "none",
      billing_status: "none",
      attendance_month_id: null,
    },
    {
      user_id: "3",
      user_name: "鈴木一郎",
      attendance_status: "approved",
      expense_status: "approved",
      billing_status: "approved",
      attendance_month_id: "uuid-3",
    },
  ];

  const counts = {
    none: rows.filter((r) => r.attendance_status === "none").length,
    submitted: rows.filter((r) => r.attendance_status === "submitted").length,
    approved: rows.filter((r) => r.attendance_status === "approved").length,
    rejected: 0,
    draft: rows.filter((r) => r.attendance_status === "draft").length,
  };

  return (
    <div className="page-content leader-page">
      <div className="title-card page-header">
        <h1 className="page-title">提出状況</h1>
        <YearMonthSelector
          year={year}
          month={month}
          onChange={(y, m) => {
            setYear(y);
            setMonth(m);
          }}
        />
      </div>

      <StatusSummary counts={counts} />

      <SubordinateTable rows={rows} />
    </div>
  );
}
