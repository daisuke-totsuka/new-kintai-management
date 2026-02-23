import "./globals.css";
import type { ReactNode } from "react";
import SideNav from "./SideNav";
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
                  <SideNav />
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
