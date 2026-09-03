import { jsonError, jsonOk, leerJson, rutaAdmin } from "@/lib/api";
import { confirmarReserva } from "@/lib/ciudadano";
import { db } from "@/lib/db";
import { confirmarReservaSchema } from "@/lib/validaciones";

export const POST = rutaAdmin(async (req) => {
  const parsed = await leerJson(req, confirmarReservaSchema); if (!parsed.ok) return parsed.response;
  try { return jsonOk({ turno: await confirmarReserva(db, parsed.data.token) }, 201); }
  catch (e) { if (e instanceof Error && e.message === "RESERVA_EXPIRADA") return jsonError(409, e.message, "La reserva expiró. Elegí otro horario."); throw e; }
});