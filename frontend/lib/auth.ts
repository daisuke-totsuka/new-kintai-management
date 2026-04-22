import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export async function requireAuth() {
  //const res = await fetch(`${BASE_URL}/api/me`, {
  //  cache: "no-store",
  //  credentials: "include",
  //});

  const cookieStore = cookies();

  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    method: "GET",
    headers: {
      Cookie: cookieHeader, // ← これが最重要
    },
    cache: "no-store",
  });

  if (!res.ok) {
    redirect("/");
  }

  const data = await res.json();
  return data.user;
}
//import { headers } from "next/headers";
//import { redirect } from "next/navigation";
//
//const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL!;
//
//export async function requireAuth() {
//  const headerList = headers();
//  const cookie = headerList.get("cookie"); // ← string
//
//  console.log("🔥 cookie:", cookie); // ← 追加
//
//  const res = await fetch(`${API_BASE_URL}/auth/me`, {
//    method: "GET",
//    headers: {
//      //cookie: cookieStore.toString(),
//      Cookie: cookie ?? "", // ← ここで転送
//    },
//    cache: "no-store",
//  });
//
//  console.log("🔥 status:", res.status);
//
//  if (!res.ok) {
//    redirect("/");
//  }
//
//  const data = await res.json();
//
//  return data.user;
//}
