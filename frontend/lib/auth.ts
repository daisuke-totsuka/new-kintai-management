import { headers } from "next/headers";
import { redirect } from "next/navigation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL!;

export async function requireAuth() {
  const headerList = headers();
  const cookie = headerList.get("cookie"); // ← string

  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    method: "GET",
    headers: {
      //cookie: cookieStore.toString(),
      Cookie: cookie ?? "", // ← ここで転送
    },
    cache: "no-store",
  });

  if (!res.ok) {
    redirect("/");
  }

  const data = await res.json();

  return data.user;
}
