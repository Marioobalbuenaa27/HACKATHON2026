import { rutaAdmin, jsonError } from "@/lib/api";
import { db } from "@/lib/db";
import { esGuardaFallida, exigirRoles } from "@/lib/sesion";

const REPORTES = ["turnos", "especialidades", "categorias", "sobreturnos", "demanda"] as const;
type Reporte = (typeof REPORTES)[number];

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}
function csv(rows: string[][]) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export const GET = rutaAdmin(async (req) => {
  const g = await exigirRoles("ADMIN", "COORDINACION");
  if (esGuardaFallida(g)) return g.response;
  const sp = new URL(req.url).searchParams;
  const tipo = (sp.get("tipo") ?? "turnos") as Reporte;
  if (!REPORTES.includes(tipo)) return jsonError(400, "REPORTE_INVALIDO", "El tipo de reporte no es válido.");
  const desde = sp.get("desde") ? new Date(`${sp.get("desde")}T00:00:00.000Z`) : undefined;
  const hasta = sp.get("hasta") ? new Date(`${sp.get("hasta")}T23:59:59.999Z`) : undefined;
  const fecha = desde || hasta ? { ...(desde ? { gte: desde } : {}), ...(hasta ? { lte: hasta } : {}) } : undefined;

  if (tipo === "turnos" || tipo === "sobreturnos") {
    const items = await db.turno.findMany({ where: { fecha, ...(tipo === "sobreturnos" ? { tipo: "SOBRETURNO" } : {}) }, include: { profesional: true, especialidad: true, categoria: true }, orderBy: { fecha: "asc" } });
    const rows = [["id", "fecha", "hora", "tipo", "estado", "prioridad", "profesional", "especialidad", "categoria"]];
    rows.push(...items.map((item) => [item.id, item.fecha.toISOString().slice(0, 10), item.horaProgramada ?? "", item.tipo, item.estado, item.prioridad, `${item.profesional.apellido}, ${item.profesional.nombre}`, item.especialidad.nombre, item.categoria.nombre]));
    return new Response(csv(rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="reporte-${tipo}.csv"` } });
  }
  if (tipo === "demanda") {
    const items = await db.demandaEspontanea.findMany({ where: { horaLlegada: fecha }, include: { categoria: true, turno: true }, orderBy: { horaLlegada: "asc" } });
    const rows = [["id", "llegada", "categoria", "prioridad_sugerida", "prioridad_confirmada", "derivada_guardia", "turno_id"]];
    rows.push(...items.map((item) => [item.id, item.horaLlegada.toISOString(), item.categoria.nombre, item.prioridadSugerida, item.prioridadConfirmada, String(item.derivadaAGuardia), item.turnoId ?? ""]));
    return new Response(csv(rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="reporte-demanda.csv"' } });
  }
  if (tipo === "especialidades") {
    const items = await db.especialidad.findMany({ include: { _count: { select: { turnos: true } } }, orderBy: { nombre: "asc" } });
    const rows = [["id", "nombre", "activa", "turnos"], ...items.map((item) => [item.id, item.nombre, String(item.activa), String(item._count.turnos)])];
    return new Response(csv(rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="reporte-especialidades.csv"' } });
  }
  const items = await db.categoriaProblema.findMany({ include: { _count: { select: { turnos: true, demandas: true } } }, orderBy: { orden: "asc" } });
  const rows = [["id", "nombre", "activa", "turnos", "demandas"], ...items.map((item) => [item.id, item.nombre, String(item.activa), String(item._count.turnos), String(item._count.demandas)])];
  return new Response(csv(rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="reporte-categorias.csv"' } });
});
