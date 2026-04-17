import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL!;

export async function requireAuth() {
  const cookieStore = cookies();

  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      cookie: cookieStore.toString(),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    redirect("/");
  }

  const data = await res.json();

  return data.user;
}
