// PATCH / DELETE /api/admin/franjas/:id — FR-28, FR-39.

import { jsonError, jsonOk, leerJson, noContent, rutaAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { esGuardaFallida, exigirRoles } from "@/lib/sesion";
import { editarFranjaSchema } from "@/lib/validaciones";
import { registrarAuditoria } from "@/lib/auditoria";
import { fechasDeFranjaEnVentana, regenerarIncremental } from "@/lib/agenda";
import { validarFranja, vistaFranja } from "@/lib/franjas";

export const PATCH = rutaAdmin(async (req, ctx) => {
  const g = await exigirRoles("ADMIN", "COORDINACION");
  if (esGuardaFallida(g)) return g.response;

  const { id } = await ctx.params;
  const parsed = await leerJson(req, editarFranjaSchema);
  if (!parsed.ok) return parsed.response;
  const cambios = parsed.data;

  const actual = await db.franjaAgenda.findUnique({ where: { id } });
  if (!actual) return jsonError(404, "NO_ENCONTRADO", "Franja inexistente.");

  const fusion = {
    profesionalId: cambios.profesionalId ?? actual.profesionalId,
    especialidadId: cambios.especialidadId ?? actual.especialidadId,
    salaId: cambios.salaId ?? actual.salaId,
    diaSemana: cambios.diaSemana ?? actual.diaSemana,
    horaInicio: cambios.horaInicio ?? actual.horaInicio,
    horaFin: cambios.horaFin ?? actual.horaFin,
    vigenciaDesde: cambios.vigenciaDesde ?? actual.vigenciaDesde.toISOString().slice(0, 10),
    vigenciaHasta:
      cambios.vigenciaHasta !== undefined
        ? cambios.vigenciaHasta ?? null
        : actual.vigenciaHasta
          ? actual.vigenciaHasta.toISOString().slice(0, 10)
          : null,
  };
  if (fusion.horaFin <= fusion.horaInicio) {
    return jsonError(400, "VALIDACION", "La hora de fin debe ser posterior al inicio.", { horaFin: ["Inválida."] });
  }
  if (fusion.vigenciaHasta && fusion.vigenciaHasta < fusion.vigenciaDesde) {
    return jsonError(400, "VALIDACION", "Vigencia hasta anterior a vigencia desde.", { vigenciaHasta: ["Inválida."] });
  }

  const problema = await validarFranja(fusion, id);
  if (problema) return problema;

  const fechasAntes = await fechasDeFranjaEnVentana(actual);

  const upd = await db.$transaction(async (tx) => {
    const f = await tx.franjaAgenda.update({
      where: { id },
      data: {
        ...(cambios.profesionalId ? { profesionalId: cambios.profesionalId } : {}),
        ...(cambios.diaSemana ? { diaSemana: cambios.diaSemana } : {}),
        ...(cambios.horaInicio ? { horaInicio: cambios.horaInicio } : {}),
        ...(cambios.horaFin ? { horaFin: cambios.horaFin } : {}),
        ...(cambios.especialidadId ? { especialidadId: cambios.especialidadId } : {}),
        ...(cambios.salaId ? { salaId: cambios.salaId } : {}),
        ...(cambios.vigenciaDesde ? { vigenciaDesde: new Date(`${cambios.vigenciaDesde}T00:00:00.000Z`) } : {}),
        ...(cambios.vigenciaHasta !== undefined
          ? { vigenciaHasta: cambios.vigenciaHasta ? new Date(`${cambios.vigenciaHasta}T00:00:00.000Z`) : null }
          : {}),
        ...(cambios.activa !== undefined ? { activa: cambios.activa } : {}),
        inconsistente: false,
      },
    });
    await registrarAuditoria(tx, {
      actorId: g.actor.usuarioId,
      accion: "EDITAR",
      entidad: "franja",
      entidadId: id,
      antes: vistaFranja(actual),
      despues: vistaFranja(f),
    });
    return f;
  });

  const fechasDespues = await fechasDeFranjaEnVentana(upd);
  await regenerarIncremental(upd.profesionalId, [...fechasAntes, ...fechasDespues]);
  return jsonOk(vistaFranja(upd));
});

export const DELETE = rutaAdmin(async (_req, ctx) => {
  const g = await exigirRoles("ADMIN", "COORDINACION");
  if (esGuardaFallida(g)) return g.response;

  const { id } = await ctx.params;
  const actual = await db.franjaAgenda.findUnique({ where: { id } });
  if (!actual) return jsonError(404, "NO_ENCONTRADO", "Franja inexistente.");

  const fechas = await fechasDeFranjaEnVentana(actual);

  await db.$transaction(async (tx) => {
    // Slots ocupados de esta franja quedan huérfanos; los DISPONIBLE se borran luego por regen.
    await tx.slot.updateMany({
      where: { origen: "FRANJA", origenId: id, estado: { not: "DISPONIBLE" } },
      data: { huerfano: true },
    });
    await tx.franjaAgenda.delete({ where: { id } });
    await registrarAuditoria(tx, {
      actorId: g.actor.usuarioId,
      accion: "ELIMINAR",
      entidad: "franja",
      entidadId: id,
      antes: vistaFranja(actual),
    });
  });

  await regenerarIncremental(actual.profesionalId, fechas);
  return noContent();
});
