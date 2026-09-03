// POST /api/admin/slots/generar — FR-40, FR-42, AC-37. Escritura: ADMIN, COORDINACION.

import { jsonError, jsonOk, rutaAdmin } from "@/lib/api";
import { esGuardaFallida, exigirRoles } from "@/lib/sesion";
import { generarSlotsSchema } from "@/lib/validaciones";
import { generarSlots } from "@/lib/slots/generar";

export const POST = rutaAdmin(async (req) => {
  const g = await exigirRoles("ADMIN", "COORDINACION");
  if (esGuardaFallida(g)) return g.response;

  // El cuerpo es opcional: sin él (o `{}`) se generan los slots de todos los profesionales.
  let crudo: unknown = {};
  try {
    const txt = await req.text();
    if (txt.trim()) crudo = JSON.parse(txt);
  } catch {
    return jsonError(400, "JSON_INVALIDO", "El cuerpo de la petición no es JSON válido.");
  }
  const parsed = generarSlotsSchema.safeParse(crudo);
  if (!parsed.success) {
    return jsonError(400, "VALIDACION", "Hay campos inválidos.");
  }

  const r = await generarSlots({
    profesionalId: parsed.data.profesionalId ?? null,
    disparador: "MANUAL",
    actorId: g.actor.usuarioId,
  });

  return jsonOk({
    profesionales: r.profesionales,
    creados: r.creados,
    eliminados: r.eliminados,
    sinCambios: r.sinCambios,
    franjasInconsistentesOmitidas: r.franjasInconsistentesOmitidas,
    corridaId: r.corridaId,
  });
});
