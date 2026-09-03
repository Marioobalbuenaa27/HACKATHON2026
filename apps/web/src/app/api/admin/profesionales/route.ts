// /api/admin/profesionales — FR-14, FR-15, FR-22, FR-24. Lectura: todos; escritura: ADMIN, COORDINACION.

import { esUniqueViolation, jsonError, jsonOk, leerJson, parseBool, rutaAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { esGuardaFallida, exigirRoles, exigirSesion } from "@/lib/sesion";
import { idPorNombreCI, paginado } from "@/lib/catalogo";
import { crearProfesionalSchema } from "@/lib/validaciones";
import { especialidadesInvalidas, usuarioVinculableError } from "@/lib/profesionales";

interface ProfConEsp {
  id: string;
  nombre: string;
  apellido: string;
  matricula: string;
  usuarioId: string | null;
  activo: boolean;
  especialidades: { especialidadId: string }[];
}
const vista = (p: ProfConEsp) => ({
  id: p.id,
  nombre: p.nombre,
  apellido: p.apellido,
  matricula: p.matricula,
  especialidadIds: p.especialidades.map((e) => e.especialidadId),
  usuarioId: p.usuarioId,
  activo: p.activo,
});

export const GET = rutaAdmin(async (req) => {
  const g = await exigirSesion();
  if (esGuardaFallida(g)) return g.response;

  const sp = new URL(req.url).searchParams;
  const especialidadId = sp.get("especialidadId");
  const where = {
    ...(parseBool(sp.get("incluirInactivos")) ? {} : { activo: true }),
    ...(especialidadId ? { especialidades: { some: { especialidadId } } } : {}),
  };
  const data = await paginado(
    () => db.profesional.count({ where }),
    (skip, take) =>
      db.profesional.findMany({
        where,
        orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
        skip,
        take,
        include: { especialidades: { select: { especialidadId: true } } },
      }),
    sp,
  );
  return jsonOk({ ...data, items: data.items.map(vista) });
});

export const POST = rutaAdmin(async (req) => {
  const g = await exigirRoles("ADMIN", "COORDINACION");
  if (esGuardaFallida(g)) return g.response;

  const parsed = await leerJson(req, crearProfesionalSchema);
  if (!parsed.ok) return parsed.response;
  const { nombre, apellido, matricula, especialidadIds, usuarioId } = parsed.data;

  if (await idPorNombreCI("profesional", "matricula", matricula)) {
    return jsonError(409, "MATRICULA_DUPLICADA", "Ya existe un profesional con esa matrícula.");
  }
  const ofensor = await especialidadesInvalidas(especialidadIds);
  if (ofensor) {
    return jsonError(400, "VALIDACION", "Especialidad inexistente o inactiva.", { especialidadIds: [ofensor] });
  }
  if (usuarioId) {
    const err = await usuarioVinculableError(usuarioId);
    if (err) return err;
  }

  try {
    const creado = await db.profesional.create({
      data: {
        nombre,
        apellido,
        matricula,
        usuarioId: usuarioId ?? null,
        especialidades: { create: [...new Set(especialidadIds)].map((especialidadId) => ({ especialidadId })) },
      },
      include: { especialidades: { select: { especialidadId: true } } },
    });
    return jsonOk(vista(creado), 201);
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
