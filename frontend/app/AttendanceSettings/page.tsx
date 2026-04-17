import { requireAuth } from "@/lib/auth";
import ClientPage from "./ClientPage";

export default async function Page() {
  const user = await requireAuth();

  return <ClientPage user={user} />;
}
