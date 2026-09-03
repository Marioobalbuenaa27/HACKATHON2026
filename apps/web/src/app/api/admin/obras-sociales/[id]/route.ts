// PATCH /api/admin/obras-sociales/:id — FR-20, FR-24.

import { esUniqueViolation, jsonError, jsonOk, leerJson, rutaAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { esGuardaFallida, exigirRoles } from "@/lib/sesion";
import { idPorNombreCI } from "@/lib/catalogo";
import { editarObraSocialSchema } from "@/lib/validaciones";

export const PATCH = rutaAdmin(async (req, ctx) => {
  const g = await exigirRoles("ADMIN");
  if (esGuardaFallida(g)) return g.response;

  const { id } = await ctx.params;
  const parsed = await leerJson(req, editarObraSocialSchema);
  if (!parsed.ok) return parsed.response;
  const cambios = parsed.data;

  const actual = await db.obraSocial.findUnique({ where: { id } });
  if (!actual) return jsonError(404, "NO_ENCONTRADO", "Obra social inexistente.");

  if (cambios.nombre && (await idPorNombreCI("obraSocial", "nombre", cambios.nombre, id))) {
    return jsonError(409, "NOMBRE_DUPLICADO", "Ya existe una obra social con ese nombre.");
  }
  try {
    const upd = await db.obraSocial.update({ where: { id }, data: cambios });
    return jsonOk({ id: upd.id, nombre: upd.nombre, activa: upd.activa });
  } catch (e) {
    if (esUniqueViolation(e)) return jsonError(409, "NOMBRE_DUPLICADO", "Ya existe una obra social con ese nombre.");
    throw e;
  }
});
