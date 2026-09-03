// PATCH /api/admin/salas/:id — FR-19, FR-21, FR-24.

import { esUniqueViolation, jsonError, jsonOk, leerJson, rutaAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { esGuardaFallida, exigirRoles } from "@/lib/sesion";
import { idPorNombreCI } from "@/lib/catalogo";
import { editarSalaSchema } from "@/lib/validaciones";

export const PATCH = rutaAdmin(async (req, ctx) => {
  const g = await exigirRoles("ADMIN", "COORDINACION");
  if (esGuardaFallida(g)) return g.response;

  const { id } = await ctx.params;
  const parsed = await leerJson(req, editarSalaSchema);
  if (!parsed.ok) return parsed.response;
  const cambios = parsed.data;

  const actual = await db.sala.findUnique({ where: { id } });
  if (!actual) return jsonError(404, "NO_ENCONTRADO", "Sala inexistente.");

  if (cambios.identificador && (await idPorNombreCI("sala", "identificador", cambios.identificador, id))) {
    return jsonError(409, "IDENTIFICADOR_DUPLICADO", "Ya existe una sala con ese identificador.");
  }

  if (cambios.activa === false && actual.activa) {
    const franjas = await db.franjaAgenda.findMany({
      where: { salaId: id, activa: true },
      select: { id: true },
    });
    if (franjas.length) {
      return jsonError(409, "ENTIDAD_EN_USO", "Hay franjas activas que usan esta sala.", {
        franjas: franjas.map((f) => f.id),
      });
    }
  }

  try {
    const upd = await db.sala.update({ where: { id }, data: cambios });
    return jsonOk({ id: upd.id, identificador: upd.identificador, ubicacion: upd.ubicacion, activa: upd.activa });
  } catch (e) {
    if (esUniqueViolation(e)) {
      return jsonError(409, "IDENTIFICADOR_DUPLICADO", "Ya existe una sala con ese identificador.");
    }
    throw e;
  }
});
