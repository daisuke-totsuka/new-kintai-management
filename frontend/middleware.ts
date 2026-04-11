// frontend/middleware.ts

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  // 👇 これが本質（超重要）
  if (req.nextUrl.pathname === "/") {
    return NextResponse.next();
  }

  console.log("MIDDLEWARE HIT:", req.nextUrl.pathname);

  const cookie = req.headers.get("cookie") || "";

  try {
    const res = await fetch("http://localhost:5000/auth/me", {
      method: "GET",
      headers: {
        cookie: cookie, // ← これ超重要
      },
    });

    // 未ログイン
    if (!res.ok) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // ログイン済
    return NextResponse.next();
  } catch (error) {
    return NextResponse.redirect(new URL("/", req.url));
  }
}

export const config = {
  matcher: [
    "/attendance/:path*",
    "/dashboard/:path*",
    "/admin/:path*",
    "/leader/:path*",
    "/UserManagement/:path*",
    "/ExpenseClaims/:path*",
    "/BusinessBillDetails/:path*",
    "/AttendanceSettings/:path*",
  ],
};
