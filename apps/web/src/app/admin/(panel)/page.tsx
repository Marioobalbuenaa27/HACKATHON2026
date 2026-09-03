import { getActorOrRedirect } from "@/lib/session/server";
import { Dashboard } from "@/components/admin/Dashboard";

export default async function AdminHomePage() {
  const actor = await getActorOrRedirect();
  return <Dashboard actor={actor} />;
}
