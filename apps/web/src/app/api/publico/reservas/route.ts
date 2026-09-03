import { jsonError, jsonOk, leerJson, rutaAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { reservarSlot } from "@/lib/ciudadano";
import { reservarSlotSchema } from "@/lib/validaciones";

export const POST = rutaAdmin(async (req) => {
  const parsed = await leerJson(req, reservarSlotSchema);
  if (!parsed.ok) return parsed.response;
  try { const reserva = await reservarSlot(db, parsed.data); return jsonOk({ token: reserva.token, expiraAt: reserva.expiraAt.toISOString(), slot: reserva.slot }, 201); }
  catch (e) { const code = e instanceof Error ? e.message : ""; if (["SLOT_NO_DISPONIBLE", "CATEGORIA_NO_RESERVABLE", "CATEGORIA_ESPECIALIDAD_INVALIDA"].includes(code)) return jsonError(409, code, "El turno ya no está disponible."); throw e; }
});