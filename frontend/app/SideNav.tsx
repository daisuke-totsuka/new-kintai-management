"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type MenuItem = {
  menuId: string;
  menuName: string;
  menuCategory: string;
  menuPath: string;
  isActive: boolean;
};

type MenuSection = {
  category: string;
  title: string;
  items: MenuItem[];
};

const CATEGORY_ORDER = ["USER", "ADMIN", "LEADER", "ACCOUNTING"];
const CATEGORY_LABELS: Record<string, string> = {
  USER: "ユーザ権限",
  ADMIN: "管理権限",
  LEADER: "リーダー権限",
  ACCOUNTING: "経理権限",
};

export default function SideNav() {
  const pathname = usePathname();
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadMenus() {
      setError("");
      setMenus([]);

      try {
        const meBody = await requestJson("/api/me");
        const roleId = normalizeRoleId(
          meBody?.user?.role_id ?? meBody?.user?.roleId,
        );

        if (!mounted || !roleId) return;

        const menuBody = await requestJson(
          `/api/roles/${encodeURIComponent(roleId)}/menus`,
        );
        if (!mounted) return;

        setMenus((menuBody?.menus ?? []).map(toMenuItem).filter(isVisibleMenu));
      } catch {
        if (!mounted) return;
        setMenus([]);
        setError("メニュー情報の取得に失敗しました");
      }
    }

    loadMenus();

    return () => {
      mounted = false;
    };
  }, []);

  const visibleSections = useMemo(() => groupMenus(menus), [menus]);

  return (
    <nav className="side-menu" aria-label="利用可能メニュー">
      {error && (
        <div className="dashboard-sub" role="alert">
          {error}
        </div>
      )}

      {visibleSections.map((section) => (
        <div key={section.category} className="side-section">
          <div className="side-section-title">{section.title}</div>
          <div className="side-section-items">
            {section.items.map((item) => {
              const isActive =
                pathname === item.menuPath ||
                pathname.startsWith(`${item.menuPath}/`);

              return (
                <Link
                  key={item.menuId}
                  className={`side-item${isActive ? " active" : ""}`}
                  href={item.menuPath}
                >
                  {item.menuName}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

async function requestJson(url: string) {
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store",
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error ?? "API request failed");
  }

  return body;
}

function toMenuItem(row: Record<string, any>): MenuItem {
  return {
    menuId: String(row.menu_id ?? row.menuId ?? ""),
    menuName: String(row.menu_name ?? row.menuName ?? ""),
    menuCategory: normalizeMenuCategory(row.menu_category ?? row.menuCategory),
    menuPath: String(row.menu_path ?? row.menuPath ?? ""),
    isActive: row.is_active ?? row.isActive ?? true,
  };
}

function isVisibleMenu(menu: MenuItem) {
  return menu.isActive && Boolean(menu.menuId && menu.menuName && menu.menuPath);
}

function groupMenus(menus: MenuItem[]): MenuSection[] {
  const categoryOrder = new Map(
    CATEGORY_ORDER.map((category, index) => [category, index]),
  );
  const categories = Array.from(
    new Set(menus.map((menu) => menu.menuCategory).filter(Boolean)),
  );

  return categories
    .sort(
      (a, b) =>
        (categoryOrder.get(a) ?? CATEGORY_ORDER.length) -
          (categoryOrder.get(b) ?? CATEGORY_ORDER.length) ||
        a.localeCompare(b),
    )
    .map((category) => ({
      category,
      title: CATEGORY_LABELS[category] ?? category,
      items: menus
        .filter((menu) => menu.menuCategory === category)
        .sort((a, b) => a.menuId.localeCompare(b.menuId)),
    }));
}

function normalizeRoleId(value: unknown) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  return String(value).trim().toUpperCase().replace(/[-\s]/g, "_");
}

function normalizeMenuCategory(value: unknown) {
  if (value === undefined || value === null) return "";
  return String(value).trim().toUpperCase().replace(/[-\s]/g, "_");
}
