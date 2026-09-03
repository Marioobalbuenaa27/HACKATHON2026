// GET /api/admin/auditoria — FR-45, AC-40. Lectura: ADMIN, COORDINACION. Sin escritura.

import { jsonOk, rutaAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { esGuardaFallida, exigirRoles } from "@/lib/sesion";
import { paginado } from "@/lib/catalogo";
import type { Prisma } from "@prisma/client";

export const GET = rutaAdmin(async (req) => {
  const g = await exigirRoles("ADMIN", "COORDINACION");
  if (esGuardaFallida(g)) return g.response;

  const sp = new URL(req.url).searchParams;
  const where: Prisma.AuditoriaWhereInput = {};
  const actorId = sp.get("actorId");
  const entidad = sp.get("entidad");
  const desde = sp.get("desde");
  const hasta = sp.get("hasta");
  if (actorId) where.actorId = actorId;
  if (entidad) where.entidad = entidad as Prisma.AuditoriaWhereInput["entidad"];
  if (desde || hasta) {
    where.timestamp = {};
    if (desde) where.timestamp.gte = new Date(desde);
    if (hasta) where.timestamp.lte = new Date(hasta);
  }

  const data = await paginado(
    () => db.auditoria.count({ where }),
    (skip, take) =>
      db.auditoria.findMany({
        where,
        orderBy: { timestamp: "desc" },
        skip,
        take,
        include: { actor: { select: { nombre: true } } },
      }),
    sp,
  );

  return jsonOk({
    ...data,
    items: data.items.map((a) => ({
      id: a.id,
      actorId: a.actorId,
      actorNombre: a.actor.nombre,
      accion: a.accion,
      entidad: a.entidad,
      entidadId: a.entidadId,
      motivo: a.motivo,
      antes: a.antes,
      despues: a.despues,
      timestamp: a.timestamp.toISOString(),
    })),
  });
});
