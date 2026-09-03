// PATCH /api/admin/categorias/:id — FR-16, FR-18, FR-23, AC-20, AC-24.

import { esUniqueViolation, jsonError, jsonOk, leerJson, rutaAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { esGuardaFallida, exigirRoles } from "@/lib/sesion";
import { idPorNombreCI } from "@/lib/catalogo";
import { editarCategoriaSchema } from "@/lib/validaciones";
import { vistaCategoria } from "@/lib/categorias";

export const PATCH = rutaAdmin(async (req, ctx) => {
  const g = await exigirRoles("ADMIN");
  if (esGuardaFallida(g)) return g.response;

  const { id } = await ctx.params;
  const parsed = await leerJson(req, editarCategoriaSchema);
  if (!parsed.ok) return parsed.response;
  const cambios = parsed.data;

  const actual = await db.categoriaProblema.findUnique({
    where: { id },
    include: { especialidades: { select: { especialidadId: true } } },
  });
  if (!actual) return jsonError(404, "NO_ENCONTRADO", "Categoría inexistente.");

  if (cambios.nombre && (await idPorNombreCI("categoriaProblema", "nombre", cambios.nombre, id))) {
    return jsonError(409, "NOMBRE_DUPLICADO", "Ya existe una categoría con ese nombre.");
  }

  // FR-18: no se puede marcar derivarAGuardia si ya tiene mapeos.
  if (cambios.derivarAGuardia === true && !actual.derivarAGuardia && actual.especialidades.length > 0) {
    return jsonError(409, "CATEGORIA_TIENE_MAPEOS", "Quitá primero las especialidades mapeadas.");
  }

  try {
    const upd = await db.categoriaProblema.update({
      where: { id },
      data: cambios,
      include: { especialidades: { select: { especialidadId: true, nota: true } } },
    });
    return jsonOk(vistaCategoria(upd));
  } catch (e) {
    if (esUniqueViolation(e)) return jsonError(409, "NOMBRE_DUPLICADO", "Ya existe una categoría con ese nombre.");
    throw e;
  }
});
