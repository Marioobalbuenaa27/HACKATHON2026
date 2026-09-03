// PATCH /api/admin/profesionales/:id — FR-14, FR-15, FR-21, AC-16, EC-18.

import { esUniqueViolation, jsonError, jsonOk, leerJson, rutaAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { esGuardaFallida, exigirRoles } from "@/lib/sesion";
import { idPorNombreCI } from "@/lib/catalogo";
import { editarProfesionalSchema } from "@/lib/validaciones";
import { especialidadesInvalidas, usuarioVinculableError } from "@/lib/profesionales";

export const PATCH = rutaAdmin(async (req, ctx) => {
  const g = await exigirRoles("ADMIN", "COORDINACION");
  if (esGuardaFallida(g)) return g.response;

  const { id } = await ctx.params;
  const parsed = await leerJson(req, editarProfesionalSchema);
  if (!parsed.ok) return parsed.response;
  const cambios = parsed.data;

  const actual = await db.profesional.findUnique({ where: { id } });
  if (!actual) return jsonError(404, "NO_ENCONTRADO", "Profesional inexistente.");

  if (cambios.matricula && (await idPorNombreCI("profesional", "matricula", cambios.matricula, id))) {
    return jsonError(409, "MATRICULA_DUPLICADA", "Ya existe un profesional con esa matrícula.");
  }
  if (cambios.especialidadIds) {
    const ofensor = await especialidadesInvalidas(cambios.especialidadIds);
    if (ofensor) {
      return jsonError(400, "VALIDACION", "Especialidad inexistente o inactiva.", { especialidadIds: [ofensor] });
    }
  }
  if (cambios.usuarioId) {
    const err = await usuarioVinculableError(cambios.usuarioId, id);
    if (err) return err;
  }
  if (cambios.activo === false && actual.activo) {
    const franjas = await db.franjaAgenda.findMany({ where: { profesionalId: id, activa: true }, select: { id: true } });
    if (franjas.length) {
      return jsonError(409, "ENTIDAD_EN_USO", "Hay franjas activas de este profesional.", {
        franjas: franjas.map((f) => f.id),
      });
    }
  }

  const { especialidadIds, ...escalares } = cambios;

  try {
    const upd = await db.profesional.update({
      where: { id },
      data: {
        ...escalares,
        ...(especialidadIds
          ? {
              especialidades: {
                deleteMany: {},
                create: [...new Set(especialidadIds)].map((especialidadId) => ({ especialidadId })),
              },
            }
          : {}),
      },
      include: { especialidades: { select: { especialidadId: true } } },
    });
    return jsonOk({
      id: upd.id,
      nombre: upd.nombre,
      apellido: upd.apellido,
      matricula: upd.matricula,
      especialidadIds: upd.especialidades.map((e) => e.especialidadId),
      usuarioId: upd.usuarioId,
      activo: upd.activo,
    });
  } catch (e) {
    if (esUniqueViolation(e, "matricula")) {
      return jsonError(409, "MATRICULA_DUPLICADA", "Ya existe un profesional con esa matrícula.");
    }
    if (esUniqueViolation(e, "usuarioId")) {
      return jsonError(409, "USUARIO_YA_VINCULADO", "Ese usuario ya está vinculado a otro profesional.");
    }
    throw e;
  }
});
