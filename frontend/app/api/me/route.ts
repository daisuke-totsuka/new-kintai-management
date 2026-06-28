import { NextResponse } from "next/server";

const DEFAULT_ROLE_CODE = "ADMIN";

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
    const body = withRoleFallback(JSON.parse(text));
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

function withRoleFallback(body: any) {
  if (!body?.user || typeof body.user !== "object") {
    return body;
  }

  const roleId = firstNonEmpty(body.user.role_id, body.user.roleId);
  const role = firstNonEmpty(body.user.role);

  if (!roleId && role) {
    body.user.role_id = role;
  }

  if (!role && roleId) {
    body.user.role = roleId;
  }

  if (!roleId && !role) {
    body.user.role_id = DEFAULT_ROLE_CODE;
    body.user.role = DEFAULT_ROLE_CODE;
  }

  return body;
}

function firstNonEmpty(...values: unknown[]) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return undefined;
}
