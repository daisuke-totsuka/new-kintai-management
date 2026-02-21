import "./globals.css";
import type { ReactNode } from "react";
import Link from "next/link";
import ClientLayout from "./ClientLayout";

export const metadata = {
  title: "勤務実績（月間）",
  description: "勤怠管理アプリ"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <ClientLayout
          chrome={
            <>
              <header className="app-header">
                <div className="app-header-title">勤怠管理システム</div>
                <div className="app-header-sub">Kintai Management</div>
              </header>
              <div className="app-shell">
                <aside className="side-nav">
                  <div className="side-title">メニュー</div>
                  <nav className="side-menu">
                    <Link className="side-item" href="/attendance">勤務表</Link>
                    <Link className="side-item" href="/AttendanceSettings">勤務表設定</Link>
                    <Link className="side-item" href="/ExpenseClaims">経費請求</Link>
                    <Link className="side-item" href="/BusinessBillDetails">業務請求分明細</Link>
                  </nav>
                </aside>
                <div className="content-area">{children}</div>
              </div>
              <footer className="app-footer">
                <div className="app-footer-text">© 2026 Kintai Management</div>
              </footer>
            </>
          }
        >
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
