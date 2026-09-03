import { getActorOrRedirect } from "@/lib/session/server";
import { AdminShell } from "@/components/admin/AdminShell";
import { Providers } from "@/components/admin/Providers";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActorOrRedirect();

  return (
    <Providers>
      <AdminShell actor={actor}>{children}</AdminShell>
    </Providers>
  );
}
