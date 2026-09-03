// PATCH /api/admin/especialidades/:id — FR-13, FR-21, FR-24, AC-22.

import { esUniqueViolation, jsonError, jsonOk, leerJson, rutaAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { esGuardaFallida, exigirRoles } from "@/lib/sesion";
import { idPorNombreCI } from "@/lib/catalogo";
import { editarEspecialidadSchema } from "@/lib/validaciones";
import { horaAMinutos as minutos } from "@/lib/fechas";

export const PATCH = rutaAdmin(async (req, ctx) => {
  const g = await exigirRoles("ADMIN");
  if (esGuardaFallida(g)) return g.response;

  const { id } = await ctx.params;
  const parsed = await leerJson(req, editarEspecialidadSchema);
  if (!parsed.ok) return parsed.response;
  const cambios = parsed.data;

  const actual = await db.especialidad.findUnique({ where: { id } });
  if (!actual) return jsonError(404, "NO_ENCONTRADO", "Especialidad inexistente.");

  if (cambios.nombre && (await idPorNombreCI("especialidad", "nombre", cambios.nombre, id))) {
    return jsonError(409, "NOMBRE_DUPLICADO", "Ya existe una especialidad con ese nombre.");
  }

  // No se puede desactivar si tiene franjas activas (FR-21, AC-22).
  if (cambios.activa === false && actual.activa) {
    const franjas = await db.franjaAgenda.findMany({
      where: { especialidadId: id, activa: true },
      select: { id: true },
    });
    if (franjas.length) {
      return jsonError(409, "ENTIDAD_EN_USO", "Hay franjas activas que usan esta especialidad.", {
        franjas: franjas.map((f) => f.id),
      });
    }
  }

  try {
    const upd = await db.especialidad.update({ where: { id }, data: cambios });

    // EC-11: al cambiar la duración de turno, marcar/desmarcar como inconsistentes
    // las franjas cuya duración deja de ser (o vuelve a ser) múltiplo.
    if (cambios.duracionTurnoMin && cambios.duracionTurnoMin !== actual.duracionTurnoMin) {
      const franjas = await db.franjaAgenda.findMany({ where: { especialidadId: id } });
      for (const f of franjas) {
        const dur = minutos(f.horaFin) - minutos(f.horaInicio);
        const inconsistente = dur % upd.duracionTurnoMin !== 0;
        if (inconsistente !== f.inconsistente) {
          await db.franjaAgenda.update({ where: { id: f.id }, data: { inconsistente } });
        }
      }
    }

    return jsonOk({
      id: upd.id,
      nombre: upd.nombre,
      duracionTurnoMin: upd.duracionTurnoMin,
      activa: upd.activa,
    });
  } catch (e) {
    if (esUniqueViolation(e)) {
      return jsonError(409, "NOMBRE_DUPLICADO", "Ya existe una especialidad con ese nombre.");
    }
    throw e;
  }
});
