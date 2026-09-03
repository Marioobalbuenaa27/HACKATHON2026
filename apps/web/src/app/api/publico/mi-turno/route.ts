import { jsonOk, leerJson, rutaAdmin } from "@/lib/api";
import { consultarTurnoSchema } from "@/lib/validaciones";
import { consultarTurnos } from "@/lib/ciudadano";
import { db } from "@/lib/db";

export const POST = rutaAdmin(async (req) => {
  const parsed = await leerJson(req, consultarTurnoSchema); if (!parsed.ok) return parsed.response;
  return jsonOk({ items: await consultarTurnos(db, parsed.data.dni, parsed.data.fechaNacimiento) });
});