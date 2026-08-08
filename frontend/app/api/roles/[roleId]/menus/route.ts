import { NextResponse } from "next/server";

type RouteContext = {
  params: {
    roleId: string;
  };
};

export async function GET(req: Request, { params }: RouteContext) {
  const cookie = req.headers.get("cookie");
  const roleId = encodeURIComponent(params.roleId);

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/roles/${roleId}/menus`,
    {
      method: "GET",
      headers: {
        Cookie: cookie ?? "",
      },
      cache: "no-store",
    },
  );

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
