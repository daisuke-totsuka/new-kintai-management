import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const cookie = req.headers.get("cookie");

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
    method: "GET",
    headers: {
      Cookie: cookie ?? "",
    },
    cache: "no-store",
  });

  const text = await res.text();

  try {
    const body = JSON.parse(text);
    return NextResponse.json(body, {
      status: res.status,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response(text, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  }
}
