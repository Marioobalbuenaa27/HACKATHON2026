// Validaciones compartidas del ABM de profesionales (FR-14, FR-15).

import { db } from "@/lib/db";
import { jsonError } from "@/lib/api";

/** Valida que las especialidades existan y estén activas. Devuelve el id ofensor o null. */
export async function especialidadesInvalidas(ids: string[]): Promise<string | null> {
  const filas = await db.especialidad.findMany({
    where: { id: { in: ids } },
    select: { id: true, activa: true },
  });
  const set = new Map(filas.map((f) => [f.id, f.activa]));
  for (const id of ids) if (!set.get(id)) return id;
  return null;
}

/** Valida el usuario a vincular: debe existir, tener rol PROFESIONAL y no estar vinculado a otro. */
export async function usuarioVinculableError(usuarioId: string, profesionalId?: string) {
  const u = await db.usuario.findUnique({
    where: { id: usuarioId },
    include: { profesional: { select: { id: true } } },
  });
  if (!u || u.rol !== "PROFESIONAL") {
    return jsonError(400, "VALIDACION", "El usuario debe existir y tener rol PROFESIONAL.", {
      usuarioId: ["Inválido."],
    });
  }
  if (u.profesional && u.profesional.id !== profesionalId) {
    return jsonError(409, "USUARIO_YA_VINCULADO", "Ese usuario ya está vinculado a otro profesional.");
  }
  return null;
}
