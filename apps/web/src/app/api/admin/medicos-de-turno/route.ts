import { jsonOk, rutaAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { fechaISOaDateUTC } from "@/lib/fechas";
import { esGuardaFallida, exigirRoles } from "@/lib/sesion";

export const GET = rutaAdmin(async (req) => {
  const g = await exigirRoles("ADMIN", "COORDINACION", "RECEPCION", "PROFESIONAL");
  if (esGuardaFallida(g)) return g.response;
  const fechaTexto = new URL(req.url).searchParams.get("fecha") ?? new Date().toISOString().slice(0, 10);
  const fecha = fechaISOaDateUTC(fechaTexto);
  const profesionales = await db.profesional.findMany({
    where: { activo: true, ...(g.actor.rol === "PROFESIONAL" ? { id: g.actor.profesionalId ?? "__sin_profesional__" } : {}) },
    include: {
      franjas: { where: { activa: true, vigenciaDesde: { lte: fecha }, OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: fecha } }] }, include: { especialidad: true, sala: true } },
      ausenciasDia: { where: { fecha } },
    },
    orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
  });
  return jsonOk({ fecha: fechaTexto, items: profesionales.map((profesional) => ({ ...profesional, ausente: profesional.ausenciasDia.length > 0 })) });
});
