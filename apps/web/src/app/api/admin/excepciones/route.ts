// /api/admin/excepciones — FR-29..FR-32, FR-39. Lectura: todos; escritura: ADMIN, COORDINACION.

import { jsonOk, leerJson, rutaAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { esGuardaFallida, exigirRoles, exigirSesion } from "@/lib/sesion";
import { crearExcepcionSchema } from "@/lib/validaciones";
import { registrarAuditoria } from "@/lib/auditoria";
import { regenerarIncremental } from "@/lib/agenda";
import { validarExcepcion, vistaExcepcion } from "@/lib/excepciones";

export const GET = rutaAdmin(async (req) => {
  const g = await exigirSesion();
  if (esGuardaFallida(g)) return g.response;

  const sp = new URL(req.url).searchParams;
  const where: Record<string, unknown> = {};
  if (sp.get("profesionalId")) where.profesionalId = sp.get("profesionalId");
  if (g.actor.rol === "PROFESIONAL") where.profesionalId = g.actor.profesionalId ?? "__ninguno__";
  const desde = sp.get("desde");
  const hasta = sp.get("hasta");
  if (desde || hasta) {
    where.fecha = {};
    if (desde) (where.fecha as Record<string, Date>).gte = new Date(`${desde}T00:00:00.000Z`);
    if (hasta) (where.fecha as Record<string, Date>).lte = new Date(`${hasta}T00:00:00.000Z`);
  }

  const filas = await db.excepcionAgenda.findMany({ where, orderBy: { fecha: "asc" } });
  return jsonOk({ items: filas.map(vistaExcepcion) });
});

export const POST = rutaAdmin(async (req) => {
  const g = await exigirRoles("ADMIN", "COORDINACION");
  if (esGuardaFallida(g)) return g.response;

  const parsed = await leerJson(req, crearExcepcionSchema);
  if (!parsed.ok) return parsed.response;
  const d = parsed.data;

  const problema = await validarExcepcion({
    profesionalId: d.profesionalId,
    fecha: d.fecha,
    tipo: d.tipo,
    horaInicio: d.horaInicio ?? null,
    horaFin: d.horaFin ?? null,
    especialidadId: d.especialidadId ?? null,
    salaId: d.salaId ?? null,
  });
  if (problema) return problema;

  const creada = await db.$transaction(async (tx) => {
    const e = await tx.excepcionAgenda.create({
      data: {
        profesionalId: d.profesionalId,
        fecha: new Date(`${d.fecha}T00:00:00.000Z`),
        tipo: d.tipo,
        horaInicio: d.horaInicio ?? null,
        horaFin: d.horaFin ?? null,
        especialidadId: d.especialidadId ?? null,
        salaId: d.salaId ?? null,
        motivo: d.motivo,
      },
    });
    await registrarAuditoria(tx, {
      actorId: g.actor.usuarioId,
      accion: "CREAR",
      entidad: "excepcion",
      entidadId: e.id,
      motivo: d.motivo,
      despues: vistaExcepcion(e),
    });
    return e;
  });

  await regenerarIncremental(creada.profesionalId, [d.fecha]);
  return jsonOk(vistaExcepcion(creada), 201);
});
