"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const menuSections = [
  {
    title: "メニュー",
    hideTitle: true,
    items: [
      { href: "/dashboard", label: "確定画面" },
      { href: "/attendance", label: "勤務実績" },
      { href: "/ExpenseClaims", label: "経費請求" },
      { href: "/BusinessBillDetails", label: "業務請求分明細" }
    ]
  },
  {
    title: "上長メニュー",
    items: [{ href: "/leader", label: "提出状況" }]
  },
  {
    title: "管理メニュー",
    items: [{ href: "/AttendanceSettings", label: "勤務表設定" }]
  }
];

export default function SideNav() {
  const pathname = usePathname();

  return (
    <nav className="side-menu">
      {menuSections.map((section) => (
        <div key={section.title} className="side-section">
          {!section.hideTitle && (
            <div className="side-section-title">{section.title}</div>
          )}
          <div className="side-section-items">
            {section.items.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  className={`side-item${isActive ? " active" : ""}`}
                  href={item.href}
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
