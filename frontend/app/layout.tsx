import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "勤務実績（月間）",
  description: "勤怠管理アプリ"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>
        {children}
      </body>
    </html>
  );
}
