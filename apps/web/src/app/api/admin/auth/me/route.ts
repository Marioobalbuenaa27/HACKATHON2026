// GET /api/admin/auth/me  (autenticado) — perfil propio.

import { jsonOk, rutaAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { esGuardaFallida, exigirSesion } from "@/lib/sesion";

export const GET = rutaAdmin(async () => {
  const g = await exigirSesion();
  if (esGuardaFallida(g)) return g.response;

  const usuario = await db.usuario.findUnique({
    where: { id: g.actor.usuarioId },
    include: { profesional: { select: { id: true } } },
  });
  if (!usuario || !usuario.activo) {
    return jsonOk({ error: "NO_AUTENTICADO", message: "Sesión inválida." }, 401);
  }

  return jsonOk({
    usuarioId: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol,
    profesionalId: usuario.profesional?.id ?? null,
  });
});
