// /api/cron/generar-slots — job programado de generación de slots (FR-39a, NFR-R3).
// Se invoca desde un scheduler externo al menos una vez por día. Autenticación por
// secreto compartido en el header `Authorization: Bearer <CRON_SECRET>`, no por sesión.
//
// - Vercel Cron invoca con GET y adjunta el header automáticamente cuando existe la
//   env var CRON_SECRET (ver apps/web/vercel.json).
// - Un cron de sistema / GitHub Action puede usar POST con el mismo header.

import { jsonError, jsonOk, rutaAdmin } from "@/lib/api";
import { generarSlots } from "@/lib/slots/generar";

const ejecutar = rutaAdmin(async (req) => {
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

export const GET = ejecutar;
export const POST = ejecutar;
