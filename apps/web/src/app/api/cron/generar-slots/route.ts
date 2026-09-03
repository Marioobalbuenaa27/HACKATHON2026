// POST /api/cron/generar-slots — job programado de generación de slots (FR-39a, NFR-R3).
// Se invoca desde un scheduler externo (cron del SO, Vercel Cron, etc.) al menos una
// vez por día. Autenticación por secreto compartido en el header, no por sesión.

import { jsonError, jsonOk, rutaAdmin } from "@/lib/api";
import { generarSlots } from "@/lib/slots/generar";

export const POST = rutaAdmin(async (req) => {
  const secreto = process.env.CRON_SECRET;
  const enviado = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secreto || enviado !== secreto) {
    return jsonError(401, "NO_AUTENTICADO", "Falta el secreto del cron.");
  }

  const r = await generarSlots({ disparador: "JOB" });
  return jsonOk({
    estado: r.estado,
    profesionales: r.profesionales,
    creados: r.creados,
    eliminados: r.eliminados,
    sinCambios: r.sinCambios,
    corridaId: r.corridaId,
  });
});
