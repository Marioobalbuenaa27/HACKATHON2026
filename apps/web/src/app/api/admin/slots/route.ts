// GET /api/admin/slots — FR-36. Lectura: ADMIN, COORDINACION, RECEPCION, PROFESIONAL (propios).

import { jsonError, jsonOk, rutaAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { esGuardaFallida, exigirSesion } from "@/lib/sesion";
import type { Prisma } from "@prisma/client";

export const GET = rutaAdmin(async (req) => {
  const g = await exigirSesion();
  if (esGuardaFallida(g)) return g.response;

  const sp = new URL(req.url).searchParams;
  const where: Prisma.SlotWhereInput = {};

  if (g.actor.rol === "PROFESIONAL") {
    if (!g.actor.profesionalId) return jsonOk({ items: [] });
    where.profesionalId = g.actor.profesionalId;
  } else if (sp.get("profesionalId")) {
    where.profesionalId = sp.get("profesionalId")!;
  }

  const desde = sp.get("desde");
  const hasta = sp.get("hasta");
  if (desde || hasta) {
    where.fecha = {};
    if (desde) where.fecha.gte = new Date(`${desde}T00:00:00.000Z`);
    if (hasta) where.fecha.lte = new Date(`${hasta}T00:00:00.000Z`);
  }
  const estado = sp.get("estado");
  if (estado) {
    if (estado !== "DISPONIBLE" && estado !== "BLOQUEADO") {
      return jsonError(400, "VALIDACION", "Estado inválido.", { estado: ["DISPONIBLE | BLOQUEADO"] });
    }
    where.estado = estado;
  }

  const filas = await db.slot.findMany({
    where,
    orderBy: [{ fecha: "asc" }, { horaInicio: "asc" }],
    take: 5000,
  });

  return jsonOk({
    items: filas.map((s) => ({
      id: s.id,
      profesionalId: s.profesionalId,
      especialidadId: s.especialidadId,
      salaId: s.salaId,
      fecha: s.fecha.toISOString().slice(0, 10),
      horaInicio: s.horaInicio,
      horaFin: s.horaFin,
      inicioUtc: s.inicioUtc.toISOString(),
      finUtc: s.finUtc.toISOString(),
      estado: s.estado,
      origen: s.origen,
      origenId: s.origenId,
      huerfano: s.huerfano,
    })),
  });
});
