import { requireAuth } from "@/lib/auth";
import ClientPage from "./ClientPage";

export function generateStaticParams() {
  return [{ id: "u1" }, { id: "u2" }, { id: "u3" }];
}

export default async function Page({ params }: { params: { id: string } }) {
  const user = await requireAuth();

  return <ClientPage user={user} params={params} />;
}
