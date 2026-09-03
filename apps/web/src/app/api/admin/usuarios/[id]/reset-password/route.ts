// POST /api/admin/usuarios/:id/reset-password — FR-12, NFR-S4.
// Genera una contraseña temporal e invalida las sesiones del usuario
// (bump de passwordActualizadaAt: el callback jwt de src/auth.ts rechaza tokens previos).

import { jsonError, jsonOk, rutaAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { esGuardaFallida, exigirRoles } from "@/lib/sesion";
import { generarPasswordTemporal, hashPassword } from "@/lib/password";
import { registrarAuditoria } from "@/lib/auditoria";

export const POST = rutaAdmin(async (_req, ctx) => {
  const g = await exigirRoles("ADMIN");
  if (esGuardaFallida(g)) return g.response;

  const { id } = await ctx.params;
  const actual = await db.usuario.findUnique({ where: { id } });
  if (!actual) return jsonError(404, "NO_ENCONTRADO", "Usuario inexistente.");

  const passwordTemporal = generarPasswordTemporal();
  const passwordHash = await hashPassword(passwordTemporal);

  await db.$transaction(async (tx) => {
    await tx.usuario.update({ where: { id }, data: { passwordHash, passwordActualizadaAt: new Date() } });
    await registrarAuditoria(tx, {
      actorId: g.actor.usuarioId,
      accion: "RESET_PASSWORD",
      entidad: "usuario",
      entidadId: id,
    });
  });

  return jsonOk({ passwordTemporal });
});
