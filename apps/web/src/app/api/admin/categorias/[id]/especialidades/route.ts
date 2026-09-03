// PUT /api/admin/categorias/:id/especialidades — FR-17, FR-18, AC-18, AC-19, EC-19.

import { jsonError, jsonOk, leerJson, rutaAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { esGuardaFallida, exigirRoles } from "@/lib/sesion";
import { mapeoCategoriaSchema } from "@/lib/validaciones";
import { especialidadesMapeoInvalidas, vistaCategoria } from "@/lib/categorias";

export const PUT = rutaAdmin(async (req, ctx) => {
  const g = await exigirRoles("ADMIN");
  if (esGuardaFallida(g)) return g.response;

  const { id } = await ctx.params;
  const parsed = await leerJson(req, mapeoCategoriaSchema);
  if (!parsed.ok) return parsed.response;
  const mapeo = parsed.data;

  const cat = await db.categoriaProblema.findUnique({ where: { id } });
  if (!cat) return jsonError(404, "NO_ENCONTRADO", "Categoría inexistente.");

  // FR-18: una categoría 'derivar a guardia' no admite mapeos.
  if (cat.derivarAGuardia && mapeo.length > 0) {
    return jsonError(409, "CATEGORIA_DERIVA_A_GUARDIA", "Esta categoría deriva a guardia y no admite especialidades.");
  }

  const ids = mapeo.map((m) => m.especialidadId);
  const ofensor = await especialidadesMapeoInvalidas(ids);
  if (ofensor) {
    return jsonError(400, "VALIDACION", "Especialidad inexistente o inactiva.", { especialidadId: [ofensor] });
  }
  if (new Set(ids).size !== ids.length) {
    return jsonError(400, "VALIDACION", "Hay especialidades repetidas en el mapeo.");
  }

  const upd = await db.$transaction(async (tx) => {
    await tx.categoriaEspecialidad.deleteMany({ where: { categoriaId: id } });
    if (mapeo.length) {
      await tx.categoriaEspecialidad.createMany({
        data: mapeo.map((m) => ({ categoriaId: id, especialidadId: m.especialidadId, nota: m.nota ?? null })),
      });
    }
    return tx.categoriaProblema.findUniqueOrThrow({
      where: { id },
      include: { especialidades: { select: { especialidadId: true, nota: true } } },
    });
  });

  return jsonOk(vistaCategoria(upd));
});
