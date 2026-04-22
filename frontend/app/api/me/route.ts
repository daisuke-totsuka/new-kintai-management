export async function GET(req: Request) {
  const cookie = req.headers.get("cookie");

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
    method: "GET",
    headers: {
      Cookie: cookie ?? "",
    },
    cache: "no-store",
  });

  return new Response(await res.text(), {
    status: res.status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
