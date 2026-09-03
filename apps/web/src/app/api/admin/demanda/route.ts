import { jsonError, jsonOk, leerJson, rutaAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { registrarDemandaEspontanea, traducirErrorOperacion } from "@/lib/operacion";
import { esGuardaFallida, exigirRoles } from "@/lib/sesion";
import { crearDemandaSchema } from "@/lib/validaciones";

export const POST = rutaAdmin(async (req) => {
  const g = await exigirRoles("ADMIN", "COORDINACION", "RECEPCION");
  if (esGuardaFallida(g)) return g.response;
  const parsed = await leerJson(req, crearDemandaSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return jsonOk(await registrarDemandaEspontanea(db, g.actor, parsed.data), 201);
  } catch (error) {
    const op = traducirErrorOperacion(error);
    if (op) return jsonError(op.status, op.code, "No se pudo registrar la demanda.");
    throw error;
  }
});

export const GET = rutaAdmin(async (req) => {
  const g = await exigirRoles("ADMIN", "COORDINACION", "RECEPCION");
  if (esGuardaFallida(g)) return g.response;
  const sp = new URL(req.url).searchParams;
  const items = await db.demandaEspontanea.findMany({
    where: { derivadaAGuardia: sp.get("derivadaAGuardia") === "true" ? true : undefined },
    include: { categoria: true, turno: true },
    orderBy: { horaLlegada: "desc" },
  });
  return jsonOk({ items });
});
