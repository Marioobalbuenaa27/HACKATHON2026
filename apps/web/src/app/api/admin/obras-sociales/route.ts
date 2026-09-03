// /api/admin/obras-sociales — FR-20, FR-22, FR-24. Lectura: todos; escritura: ADMIN.

import { esUniqueViolation, jsonError, jsonOk, leerJson, rutaAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { esGuardaFallida, exigirRoles, exigirSesion } from "@/lib/sesion";
import { filtroActivas, idPorNombreCI, paginado } from "@/lib/catalogo";
import { crearObraSocialSchema } from "@/lib/validaciones";

const vista = (o: { id: string; nombre: string; activa: boolean }) => ({ id: o.id, nombre: o.nombre, activa: o.activa });

export const GET = rutaAdmin(async (req) => {
  const g = await exigirSesion();
  if (esGuardaFallida(g)) return g.response;

  const sp = new URL(req.url).searchParams;
  const where = filtroActivas(sp);
  const data = await paginado(
    () => db.obraSocial.count({ where }),
    (skip, take) => db.obraSocial.findMany({ where, orderBy: { nombre: "asc" }, skip, take }),
    sp,
  );
  return jsonOk({ ...data, items: data.items.map(vista) });
});

export const POST = rutaAdmin(async (req) => {
  const g = await exigirRoles("ADMIN");
  if (esGuardaFallida(g)) return g.response;

  const parsed = await leerJson(req, crearObraSocialSchema);
  if (!parsed.ok) return parsed.response;
  const { nombre } = parsed.data;

  if (await idPorNombreCI("obraSocial", "nombre", nombre)) {
    return jsonError(409, "NOMBRE_DUPLICADO", "Ya existe una obra social con ese nombre.");
  }
  try {
    const creada = await db.obraSocial.create({ data: { nombre } });
    return jsonOk(vista(creada), 201);
  } catch (e) {
    if (esUniqueViolation(e)) return jsonError(409, "NOMBRE_DUPLICADO", "Ya existe una obra social con ese nombre.");
    throw e;
  }
});
