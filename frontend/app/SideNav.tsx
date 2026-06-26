"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type RoleCode = "ADMIN" | "ACCOUNTING" | "ADMIN_ACCOUNTING" | "USER";

type MenuItem = {
  label: string;
  path: string;
  roles: RoleCode[];
};

type MenuSection = {
  title: string;
  items: MenuItem[];
};

const DEFAULT_ROLE: RoleCode = "ADMIN";

const menuSections: MenuSection[] = [
  {
    title: "一般メニュー",
    items: [
      { label: "勤務実績", path: "/attendance", roles: ["ADMIN", "ADMIN_ACCOUNTING", "ACCOUNTING", "USER"] },
      { label: "通常出勤時間設定", path: "/NormalWorkTimeSettings", roles: ["ADMIN", "ADMIN_ACCOUNTING", "ACCOUNTING", "USER"] },
      { label: "経費請求", path: "/ExpenseClaims", roles: ["ADMIN", "ADMIN_ACCOUNTING", "ACCOUNTING", "USER"] },
      { label: "業務請求分明細", path: "/BusinessBillDetails", roles: ["ADMIN", "ADMIN_ACCOUNTING", "ACCOUNTING", "USER"] },
    ],
  },
  {
    title: "経理メニュー",
    items: [
      { label: "提出状況", path: "/leader", roles: ["ACCOUNTING", "ADMIN_ACCOUNTING"] },
      { label: "勤務表設定", path: "/AttendanceSettings", roles: ["ACCOUNTING", "ADMIN_ACCOUNTING"] },
    ],
  },
  {
    title: "管理メニュー",
    items: [
      { label: "ユーザ管理", path: "/admin/users", roles: ["ADMIN", "ADMIN_ACCOUNTING"] },
      { label: "支店管理", path: "/admin/branches", roles: ["ADMIN", "ADMIN_ACCOUNTING"] },
      { label: "権限管理", path: "/admin/roles", roles: ["ADMIN", "ADMIN_ACCOUNTING"] },
    ],
  },
];

export { menuSections };

export default function SideNav() {
  const pathname = usePathname();
  const [role, setRole] = useState<RoleCode>(DEFAULT_ROLE);

  useEffect(() => {
    let mounted = true;

    fetch("/api/me", {
      credentials: "include",
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!mounted) return;
        setRole(resolveUserRole(body?.user));
      })
      .catch(() => {
        if (mounted) setRole(DEFAULT_ROLE);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const visibleSections = useMemo(
    () =>
      menuSections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => item.roles.includes(role)),
        }))
        .filter((section) => section.items.length > 0),
    [role],
  );

  return (
    <nav className="side-menu">
      {visibleSections.map((section) => (
        <div key={section.title} className="side-section">
          <div className="side-section-title">{section.title}</div>
          <div className="side-section-items">
            {section.items.map((item) => {
              const isActive =
                pathname === item.path || pathname.startsWith(`${item.path}/`);

              return (
                <Link
                  key={item.path}
                  className={`side-item${isActive ? " active" : ""}`}
                  href={item.path}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function resolveUserRole(user: any): RoleCode {
  return (
    toRoleCode(user?.role_id) ??
    toRoleCode(user?.roleId) ??
    toRoleCode(user?.role) ??
    toRoleCode(user?.role_code) ??
    toRoleCode(user?.roleCode) ??
    DEFAULT_ROLE
  );
}

function toRoleCode(value: unknown): RoleCode | null {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  const role = String(value || "USER").trim().toUpperCase().replace(/[-\s]/g, "_");

  if (role === "EMPLOYEE" || role === "GENERAL") return "USER";
  if (role === "ADMINACCOUNTING") return "ADMIN_ACCOUNTING";
  if (
    role === "ADMIN" ||
    role === "ACCOUNTING" ||
    role === "ADMIN_ACCOUNTING" ||
    role === "USER"
  ) {
    return role;
  }

  return null;
}
