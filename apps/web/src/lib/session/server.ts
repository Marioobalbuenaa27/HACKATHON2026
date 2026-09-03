// Sólo debe importarse desde Server Components / route handlers (usa `auth()`).

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Perfil } from "@/lib/http/tipos";

/**
 * Resuelve el actor de la sesión en un Server Component. Si el token no es válido
 * (o la cuenta se desactivó / cambió la contraseña — lo revalida el callback `jwt`
 * de `src/auth.ts`), redirige al login. Usar en `app/admin/layout.tsx`.
 */
export async function getActorOrRedirect(next?: string): Promise<Perfil> {
  const session = await auth();
  if (!session?.user?.usuarioId) {
    redirect(next ? `/admin/login?next=${encodeURIComponent(next)}` : "/admin/login");
  }
  const u = session.user;
  return {
    usuarioId: u.usuarioId,
    nombre: u.name ?? "",
    email: u.email ?? "",
    rol: u.rol,
    profesionalId: u.profesionalId ?? null,
  };
}
