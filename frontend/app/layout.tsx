import "./globals.css";
import type { ReactNode } from "react";
import Link from "next/link";

export const metadata = {
  title: "勤務実績（月間）",
  description: "勤怠管理アプリ"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <div className="page">
          <div className="app-shell">
            <aside className="side-nav">
              <div className="side-title">メニュー</div>
              <nav className="side-menu">
                <Link className="side-item" href="/">勤務表</Link>
                <Link className="side-item" href="/AttendanceSettings">勤務表設定</Link>
                <Link className="side-item" href="/ExpenseClaims">経費請求</Link>
                <Link className="side-item" href="/BusinessBillDetails">業務請求分明細</Link>
              </nav>
            </aside>
            <div className="content-area">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
