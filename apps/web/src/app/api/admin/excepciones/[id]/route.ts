// DELETE /api/admin/excepciones/:id — FR-32, FR-39.

import { jsonError, noContent, rutaAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { esGuardaFallida, exigirRoles } from "@/lib/sesion";
import { registrarAuditoria } from "@/lib/auditoria";
import { regenerarIncremental } from "@/lib/agenda";
import { vistaExcepcion } from "@/lib/excepciones";

export const DELETE = rutaAdmin(async (_req, ctx) => {
  const g = await exigirRoles("ADMIN", "COORDINACION");
  if (esGuardaFallida(g)) return g.response;

  const { id } = await ctx.params;
  const actual = await db.excepcionAgenda.findUnique({ where: { id } });
  if (!actual) return jsonError(404, "NO_ENCONTRADO", "Excepción inexistente.");

  const fecha = actual.fecha.toISOString().slice(0, 10);

  await db.$transaction(async (tx) => {
    if (actual.tipo === "APERTURA") {
      // Los slots no ocupados de la apertura se borran; los ocupados quedan huérfanos.
      await tx.slot.updateMany({
        where: { origen: "APERTURA", origenId: id, estado: { not: "DISPONIBLE" } },
        data: { huerfano: true },
      });
      await tx.slot.deleteMany({ where: { origen: "APERTURA", origenId: id, estado: "DISPONIBLE" } });
    }
    await tx.excepcionAgenda.delete({ where: { id } });
    await registrarAuditoria(tx, {
      actorId: g.actor.usuarioId,
      accion: "ELIMINAR",
      entidad: "excepcion",
      entidadId: id,
      antes: vistaExcepcion(actual),
    });
  });

  // BLOQUEO borrado => los slots de la franja se regeneran; APERTURA => quedó limpio.
  await regenerarIncremental(actual.profesionalId, [fecha]);
  return noContent();
});
