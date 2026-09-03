import { jsonOk, rutaAdmin } from "@/lib/api";
import { db } from "@/lib/db";

export const GET = rutaAdmin(async (req) => {
  const sp = new URL(req.url).searchParams;
  const categoriaId = sp.get("categoriaId");
  const especialidadId = sp.get("especialidadId");
  if (!categoriaId || !especialidadId) return jsonOk({ items: [] });
  const desde = new Date();
  const hasta = new Date(desde.getTime() + 90 * 86400000);
  const slots = await db.slot.findMany({ where: { especialidadId, fecha: { gte: new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), desde.getUTCDate())), lte: hasta }, estado: "DISPONIBLE", inicioUtc: { gt: desde }, profesional: { activo: true }, especialidad: { activa: true }, }, include: { profesional: true, sala: true }, orderBy: [{ fecha: "asc" }, { horaInicio: "asc" }], take: 500 });
  return jsonOk({ items: slots.map((s) => ({ id: s.id, fecha: s.fecha.toISOString().slice(0, 10), horaInicio: s.horaInicio, horaFin: s.horaFin, profesional: sp.get("profesionalId") && sp.get("profesionalId") !== s.profesionalId ? null : { id: s.profesional.id, nombre: `${s.profesional.nombre} ${s.profesional.apellido}` }, sala: s.sala?.identificador ?? null })) });
});