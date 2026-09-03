// /api/admin/especialidades — FR-13, FR-22, FR-24. Lectura: todos; escritura: ADMIN.

import { esUniqueViolation, jsonError, jsonOk, leerJson, rutaAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { esGuardaFallida, exigirRoles, exigirSesion } from "@/lib/sesion";
import { filtroActivas, idPorNombreCI, paginado } from "@/lib/catalogo";
import { crearEspecialidadSchema } from "@/lib/validaciones";

const vista = (e: { id: string; nombre: string; duracionTurnoMin: number; activa: boolean }) => ({
  id: e.id,
  nombre: e.nombre,
  duracionTurnoMin: e.duracionTurnoMin,
  activa: e.activa,
});

export const GET = rutaAdmin(async (req) => {
  const g = await exigirSesion();
  if (esGuardaFallida(g)) return g.response;

  const sp = new URL(req.url).searchParams;
  const where = filtroActivas(sp);
  const data = await paginado(
    () => db.especialidad.count({ where }),
    (skip, take) =>
      db.especialidad.findMany({ where, orderBy: { nombre: "asc" }, skip, take }),
    sp,
  );
  return jsonOk({ ...data, items: data.items.map(vista) });
});

export const POST = rutaAdmin(async (req) => {
  const g = await exigirRoles("ADMIN");
  if (esGuardaFallida(g)) return g.response;

  const parsed = await leerJson(req, crearEspecialidadSchema);
  if (!parsed.ok) return parsed.response;
  const { nombre, duracionTurnoMin } = parsed.data;

  if (await idPorNombreCI("especialidad", "nombre", nombre)) {
    return jsonError(409, "NOMBRE_DUPLICADO", "Ya existe una especialidad con ese nombre.");
  }

  try {
    const creada = await db.especialidad.create({ data: { nombre, duracionTurnoMin } });
    return jsonOk(vista(creada), 201);
  } catch (e) {
    if (esUniqueViolation(e)) {
      return jsonError(409, "NOMBRE_DUPLICADO", "Ya existe una especialidad con ese nombre.");
    }
    throw e;
  }
});
