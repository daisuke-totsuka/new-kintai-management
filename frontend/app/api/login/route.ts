import { NextResponse } from "next/server";

export async function POST(req: Request) {
  //const body = await req.text();
  const body = await req.json();

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  const response = NextResponse.json(data);

  const setCookie = res.headers.get("set-cookie");

  if (setCookie) {
    // Cookieをパースして設定
    const match = setCookie.match(/access_token=([^;]+)/);

    if (setCookie) {
      response.headers.set("set-cookie", setCookie);
    }
  }

  return response;

  // ★ Cookieをそのままブラウザへ返す
  //const setCookie = res.headers.get("set-cookie");

  //return new Response(await res.text(), {
  //  status: res.status,
  //  headers: {
  //    "Set-Cookie": setCookie ?? "",
  //    "Content-Type": "application/json",
  //  },
  //});
}
