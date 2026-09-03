import { jsonError, jsonOk, rutaAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { procesarNotificaciones } from "@/lib/notificaciones";

export const POST = rutaAdmin(async (req) => {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") !== secreto) return jsonError(401, "NO_AUTENTICADO", "Falta el secreto del cron.");
  return jsonOk(await procesarNotificaciones(db));
});