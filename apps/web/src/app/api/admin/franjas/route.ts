// /api/admin/franjas — FR-25..FR-28, FR-39. Lectura: todos; escritura: ADMIN, COORDINACION.

import { jsonOk, leerJson, parseBool, rutaAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { esGuardaFallida, exigirRoles, exigirSesion } from "@/lib/sesion";
import { crearFranjaSchema } from "@/lib/validaciones";
import { registrarAuditoria } from "@/lib/auditoria";
import { fechasDeFranjaEnVentana, regenerarIncremental } from "@/lib/agenda";
import { validarFranja, vistaFranja } from "@/lib/franjas";

export const GET = rutaAdmin(async (req) => {
  const g = await exigirSesion();
  if (esGuardaFallida(g)) return g.response;

  const sp = new URL(req.url).searchParams;
  const where = {
    ...(sp.get("profesionalId") ? { profesionalId: sp.get("profesionalId")! } : {}),
    ...(parseBool(sp.get("incluirInactivas")) ? {} : { activa: true }),
    ...(g.actor.rol === "PROFESIONAL" ? { profesionalId: g.actor.profesionalId ?? "__ninguno__" } : {}),
  };
  const filas = await db.franjaAgenda.findMany({
    where,
    orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }],
  });
  return jsonOk({ items: filas.map(vistaFranja) });
});

export const POST = rutaAdmin(async (req) => {
  const g = await exigirRoles("ADMIN", "COORDINACION");
  if (esGuardaFallida(g)) return g.response;

  const parsed = await leerJson(req, crearFranjaSchema);
  if (!parsed.ok) return parsed.response;
  const d = parsed.data;

  const problema = await validarFranja({
    profesionalId: d.profesionalId,
    especialidadId: d.especialidadId,
    salaId: d.salaId,
    diaSemana: d.diaSemana,
    horaInicio: d.horaInicio,
    horaFin: d.horaFin,
    vigenciaDesde: d.vigenciaDesde,
    vigenciaHasta: d.vigenciaHasta ?? null,
  });
  if (problema) return problema;

  const creada = await db.$transaction(async (tx) => {
    const f = await tx.franjaAgenda.create({
      data: {
        profesionalId: d.profesionalId,
        diaSemana: d.diaSemana,
        horaInicio: d.horaInicio,
        horaFin: d.horaFin,
        especialidadId: d.especialidadId,
        salaId: d.salaId,
        vigenciaDesde: new Date(`${d.vigenciaDesde}T00:00:00.000Z`),
        vigenciaHasta: d.vigenciaHasta ? new Date(`${d.vigenciaHasta}T00:00:00.000Z`) : null,
      },
    });
    await registrarAuditoria(tx, {
      actorId: g.actor.usuarioId,
      accion: "CREAR",
      entidad: "franja",
      entidadId: f.id,
      despues: vistaFranja(f),
    });
    return f;
  });

  await regenerarIncremental(creada.profesionalId, await fechasDeFranjaEnVentana(creada));
  return jsonOk(vistaFranja(creada), 201);
});
