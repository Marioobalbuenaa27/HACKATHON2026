import { jsonError, jsonOk, leerJson, rutaAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { crearTurnoInterno, traducirErrorOperacion } from "@/lib/operacion";
import { esGuardaFallida, exigirRoles } from "@/lib/sesion";
import { crearTurnoSchema } from "@/lib/validaciones";
import type { Prisma } from "@prisma/client";

export const GET = rutaAdmin(async (req) => {
  const g = await exigirRoles("ADMIN", "COORDINACION", "RECEPCION", "PROFESIONAL"); if (esGuardaFallida(g)) return g.response;
  const sp = new URL(req.url).searchParams; const where: Prisma.TurnoWhereInput = {};
  if (g.actor.rol === "PROFESIONAL") where.profesionalId = g.actor.profesionalId ?? "__sin_profesional__";
  if (sp.get("fecha")) where.fecha = new Date(`${sp.get("fecha")}T00:00:00.000Z`);
  // Cola del día (FR-14): mayor prioridad primero. El enum PrioridadOperativa está
  // declarado NORMAL→URGENTE, así que `desc` deja URGENTE primero. Luego hora
  // programada, luego hora de llegada (sobreturnos / demanda espontánea), luego alta.
  const items = await db.turno.findMany({ where, include: { profesional: true, especialidad: true, sala: true }, orderBy: [{ prioridad: "desc" }, { horaProgramada: "asc" }, { horaLlegada: "asc" }, { createdAt: "asc" }] });
  return jsonOk({ items });
});
export const POST = rutaAdmin(async (req) => {
  const g = await exigirRoles("ADMIN", "COORDINACION", "RECEPCION"); if (esGuardaFallida(g)) return g.response;
  const parsed = await leerJson(req, crearTurnoSchema); if (!parsed.ok) return parsed.response;
  try { return jsonOk(await crearTurnoInterno(db, g.actor, parsed.data), 201); }
  catch (e) { const op = traducirErrorOperacion(e); return op ? jsonError(op.status, op.code, "No se pudo crear el turno.") : (() => { throw e; })(); }
});
