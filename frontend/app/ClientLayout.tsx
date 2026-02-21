"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";

export default function ClientLayout({
  children,
  chrome,
}: {
  children: ReactNode;
  chrome: ReactNode;
}) {
  const pathname = usePathname();
  const hideChrome = pathname === "/" || pathname === "/login";

  if (hideChrome) {
    return <div className="page">{children}</div>;
  }

  return (
    <div className="page">
      {chrome}
      {children}
    </div>
  );
}
