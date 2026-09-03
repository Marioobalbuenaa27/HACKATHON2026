import { jsonError, jsonOk, leerJson, rutaAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { cambiarEstadoTurno, traducirErrorOperacion } from "@/lib/operacion";
import { esGuardaFallida, exigirRoles } from "@/lib/sesion";
import { cambiarEstadoTurnoSchema } from "@/lib/validaciones";
export const POST = rutaAdmin(async (req, ctx) => {
  const g = await exigirRoles("ADMIN", "COORDINACION", "RECEPCION", "PROFESIONAL"); if (esGuardaFallida(g)) return g.response;
  const parsed = await leerJson(req, cambiarEstadoTurnoSchema); if (!parsed.ok) return parsed.response;
  const { id } = await ctx.params;
  try { return jsonOk(await cambiarEstadoTurno(db, g.actor, id, parsed.data.estado)); }
  catch (e) { const op = traducirErrorOperacion(e); return op ? jsonError(op.status, op.code, "No se pudo cambiar el estado.") : (() => { throw e; })(); }
});
