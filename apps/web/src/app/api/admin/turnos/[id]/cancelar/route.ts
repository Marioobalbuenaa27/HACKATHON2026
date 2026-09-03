import { jsonError, jsonOk, leerJson, rutaAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { cancelarTurno, traducirErrorOperacion } from "@/lib/operacion";
import { esGuardaFallida, exigirRoles } from "@/lib/sesion";
import { cancelarTurnoSchema } from "@/lib/validaciones";

export const POST = rutaAdmin(async (req, ctx) => {
  const g = await exigirRoles("ADMIN", "COORDINACION", "RECEPCION"); if (esGuardaFallida(g)) return g.response;
  const parsed = await leerJson(req, cancelarTurnoSchema); if (!parsed.ok) return parsed.response;
  const { id } = await ctx.params;
  try { return jsonOk(await cancelarTurno(db, g.actor, id, parsed.data.motivo)); }
  catch (e) { const op = traducirErrorOperacion(e); return op ? jsonError(op.status, op.code, "No se pudo cancelar el turno.") : (() => { throw e; })(); }
});
