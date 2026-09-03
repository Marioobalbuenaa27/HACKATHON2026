// POST /api/admin/auth/logout  (autenticado) — FR-11, AC-10.

import { noContent, rutaAdmin } from "@/lib/api";
import { clearSessionCookie } from "@/lib/sesion-cookie";
import { exigirSesion, esGuardaFallida } from "@/lib/sesion";

export const POST = rutaAdmin(async () => {
  const g = await exigirSesion();
  if (esGuardaFallida(g)) return g.response;

  const res = noContent();
  clearSessionCookie(res);
  return res;
});
