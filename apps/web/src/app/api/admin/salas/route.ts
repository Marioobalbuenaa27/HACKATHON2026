// /api/admin/salas — FR-19, FR-22, FR-24. Lectura: todos; escritura: ADMIN, COORDINACION.

import { esUniqueViolation, jsonError, jsonOk, leerJson, rutaAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { esGuardaFallida, exigirRoles, exigirSesion } from "@/lib/sesion";
import { filtroActivas, idPorNombreCI, paginado } from "@/lib/catalogo";
import { crearSalaSchema } from "@/lib/validaciones";

const vista = (s: { id: string; identificador: string; ubicacion: string | null; activa: boolean }) => ({
  id: s.id,
  identificador: s.identificador,
  ubicacion: s.ubicacion,
  activa: s.activa,
});

export const GET = rutaAdmin(async (req) => {
  const g = await exigirSesion();
  if (esGuardaFallida(g)) return g.response;

  const sp = new URL(req.url).searchParams;
  const where = filtroActivas(sp);
  const data = await paginado(
    () => db.sala.count({ where }),
    (skip, take) => db.sala.findMany({ where, orderBy: { identificador: "asc" }, skip, take }),
    sp,
  );
  return jsonOk({ ...data, items: data.items.map(vista) });
});

export const POST = rutaAdmin(async (req) => {
  const g = await exigirRoles("ADMIN", "COORDINACION");
  if (esGuardaFallida(g)) return g.response;

  const parsed = await leerJson(req, crearSalaSchema);
  if (!parsed.ok) return parsed.response;
  const { identificador, ubicacion } = parsed.data;

  if (await idPorNombreCI("sala", "identificador", identificador)) {
    return jsonError(409, "IDENTIFICADOR_DUPLICADO", "Ya existe una sala con ese identificador.");
  }
  try {
    const creada = await db.sala.create({ data: { identificador, ubicacion: ubicacion ?? null } });
    return jsonOk(vista(creada), 201);
  } catch (e) {
    if (esUniqueViolation(e)) {
      return jsonError(409, "IDENTIFICADOR_DUPLICADO", "Ya existe una sala con ese identificador.");
    }
    throw e;
  }
});
