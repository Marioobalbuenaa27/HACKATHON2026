// Vista y validaciones compartidas del ABM de categorías de problema (FR-16..FR-18).

import { db } from "@/lib/db";

export interface CatConEsp {
  id: string;
  nombre: string;
  ayuda: string | null;
  prioridadBase: string;
  derivarAGuardia: boolean;
  orden: number;
  activa: boolean;
  especialidades: { especialidadId: string; nota: string | null }[];
}

export const vistaCategoria = (c: CatConEsp) => ({
  id: c.id,
  nombre: c.nombre,
  ayuda: c.ayuda,
  prioridadBase: c.prioridadBase,
  derivarAGuardia: c.derivarAGuardia,
  orden: c.orden,
  activa: c.activa,
  especialidades: c.especialidades.map((e) => ({ especialidadId: e.especialidadId, nota: e.nota })),
});

/** Devuelve el id de especialidad inexistente/inactiva, o null si todas sirven (EC-19). */
export async function especialidadesMapeoInvalidas(ids: string[]): Promise<string | null> {
  const filas = await db.especialidad.findMany({
    where: { id: { in: ids } },
    select: { id: true, activa: true },
  });
  const set = new Map(filas.map((f) => [f.id, f.activa]));
  for (const id of ids) if (!set.get(id)) return id;
  return null;
}
