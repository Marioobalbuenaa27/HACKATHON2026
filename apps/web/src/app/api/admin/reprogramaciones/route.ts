import { jsonError, jsonOk, leerJson, rutaAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { resolverCasoReprogramacion, traducirErrorOperacion } from "@/lib/operacion";
import { esGuardaFallida, exigirRoles } from "@/lib/sesion";
import { resolverCasoSchema } from "@/lib/validaciones";

export const GET = rutaAdmin(async () => {
  const g = await exigirRoles("ADMIN", "COORDINACION", "RECEPCION");
  if (esGuardaFallida(g)) return g.response;
  const items = await db.casoReprogramacion.findMany({ where: { estado: "PENDIENTE" }, include: { turnoOrigen: { include: { profesional: true, especialidad: true, sala: true } } }, orderBy: { createdAt: "asc" } });
  return jsonOk({ items });
});

export const POST = rutaAdmin(async (req) => {
  const g = await exigirRoles("ADMIN", "COORDINACION", "RECEPCION");
  if (esGuardaFallida(g)) return g.response;
  const parsed = await leerJson(req, resolverCasoSchema);
  if (!parsed.ok) return parsed.response;
  const casoId = new URL(req.url).searchParams.get("casoId");
  if (!casoId) return jsonError(400, "VALIDACION", "casoId es obligatorio.");
  try {
    const caso = await db.casoReprogramacion.findUnique({ where: { id: casoId }, select: { id: true } });
    if (!caso) return jsonError(404, "CASO_O_SLOT_NO_ENCONTRADO", "No se encontró el caso.");
    return jsonOk(await resolverCasoReprogramacion(db, g.actor, casoId, parsed.data.slotDestinoId, parsed.data.motivo), 200);
  } catch (error) {
    const op = traducirErrorOperacion(error);
    if (op) return jsonError(op.status, op.code, "No se pudo resolver la reprogramación.");
    throw error;
  }
});