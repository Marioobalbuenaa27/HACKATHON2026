import { jsonError, jsonOk, leerJson, rutaAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { desplazarTurno, traducirErrorOperacion } from "@/lib/operacion";
import { esGuardaFallida, exigirRoles } from "@/lib/sesion";
import { desplazarTurnoSchema } from "@/lib/validaciones";

export const POST = rutaAdmin(async (req, ctx) => {
  const g = await exigirRoles("ADMIN", "COORDINACION");
  if (esGuardaFallida(g)) return g.response;
  const parsed = await leerJson(req, desplazarTurnoSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await ctx.params;
  try {
    return jsonOk(await desplazarTurno(db, g.actor, id, parsed.data.slotDestinoId, parsed.data.motivo), 201);
  } catch (error) {
    const op = traducirErrorOperacion(error);
    if (op) return jsonError(op.status, op.code, "No se pudo desplazar el turno.");
    throw error;
  }
});
