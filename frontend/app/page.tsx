"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Page() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log("ログイン情報:", { email, password });

    // ここでAPI接続
    // await fetch("/api/login", { ... })

    router.push("/attendance");
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="logo-area">
          <div className="logo-icon">✓</div>
          <h1>勤怠管理</h1>
        </div>

        <h2 className="login-title">ログイン</h2>

        <form onSubmit={handleLogin}>
          <div className="input-group">
            <input
              type="email"
              placeholder="メールアドレス"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="input-group">
            <input
              type="password"
              placeholder="パスワード"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="forgot-password">
            <a href="#">パスワードをお忘れですか？</a>
          </div>

          <button type="submit" className="login-button">
            ログイン
          </button>
        </form>

        <div className="register-link">
          アカウントをお持ちでない方は <a href="#">新規登録はこちら</a>
        </div>
      </div>
    </div>
  );
}
