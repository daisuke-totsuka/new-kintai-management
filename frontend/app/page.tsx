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
    try {
      // バックエンドのログインAPIを呼び出す
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      //const response = await fetch(`${API_URL}/login`, {
      //  method: "POST",
      //  headers: {
      //    "Content-Type": "application/json",
      //  },
      //  body: JSON.stringify({
      //    email: email,
      //    password: password,
      //  }),
      //  credentials: "include", // cookie保存
      //});

      //const response = await fetch("/api/login", {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      const data = await response.json();

      if (data.success) {
        console.log("遷移します");
        router.push("/attendance");
      } else {
        alert("ログイン失敗");
      }
    } catch (error) {
      console.log("ログインエラー");
      console.error("ログインエラー:", error);
    }
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
