// /api/admin/categorias — FR-16, FR-18, FR-23, FR-24. Lectura: todos; escritura: ADMIN.

import { esUniqueViolation, jsonError, jsonOk, leerJson, rutaAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { esGuardaFallida, exigirRoles, exigirSesion } from "@/lib/sesion";
import { filtroActivas, idPorNombreCI, paginado } from "@/lib/catalogo";
import { crearCategoriaSchema } from "@/lib/validaciones";
import { vistaCategoria } from "@/lib/categorias";

export const GET = rutaAdmin(async (req) => {
  const g = await exigirSesion();
  if (esGuardaFallida(g)) return g.response;

  const sp = new URL(req.url).searchParams;
  const where = filtroActivas(sp);
  const data = await paginado(
    () => db.categoriaProblema.count({ where }),
    (skip, take) =>
      db.categoriaProblema.findMany({
        where,
        orderBy: [{ orden: "asc" }, { nombre: "asc" }],
        skip,
        take,
        include: { especialidades: { select: { especialidadId: true, nota: true } } },
      }),
    sp,
  );
  return jsonOk({ ...data, items: data.items.map(vistaCategoria) });
});

export const POST = rutaAdmin(async (req) => {
  const g = await exigirRoles("ADMIN");
  if (esGuardaFallida(g)) return g.response;

  const parsed = await leerJson(req, crearCategoriaSchema);
  if (!parsed.ok) return parsed.response;
  const { nombre, ayuda, prioridadBase, derivarAGuardia, orden } = parsed.data;

  if (await idPorNombreCI("categoriaProblema", "nombre", nombre)) {
    return jsonError(409, "NOMBRE_DUPLICADO", "Ya existe una categoría con ese nombre.");
  }

  try {
    const creada = await db.categoriaProblema.create({
      data: { nombre, ayuda: ayuda ?? null, prioridadBase, derivarAGuardia, orden: orden ?? 0 },
      include: { especialidades: { select: { especialidadId: true, nota: true } } },
    });
    return jsonOk(vistaCategoria(creada), 201);
  } catch (e) {
    if (esUniqueViolation(e)) return jsonError(409, "NOMBRE_DUPLICADO", "Ya existe una categoría con ese nombre.");
    throw e;
  }
});
