import { jsonOk, rutaAdmin } from "@/lib/api";
import { db } from "@/lib/db";

export const GET = rutaAdmin(async () => {
  const categorias = await db.categoriaProblema.findMany({ where: { activa: true }, include: { especialidades: { include: { especialidad: true } } }, orderBy: [{ orden: "asc" }, { nombre: "asc" }] });
  return jsonOk({ items: categorias.map((c) => ({ id: c.id, nombre: c.nombre, ayuda: c.ayuda, derivarAGuardia: c.derivarAGuardia, especialidades: c.especialidades.filter((m) => m.especialidad.activa).map((m) => ({ id: m.especialidad.id, nombre: m.especialidad.nombre })) })) });
});