// GET/PATCH /api/admin/parametros — FR-43, AC-38, AC-39.
// Lectura: ADMIN, COORDINACION. Escritura: ADMIN.

import { jsonError, jsonOk, leerJson, rutaAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { esGuardaFallida, exigirRoles } from "@/lib/sesion";
import { editarParametrosSchema } from "@/lib/validaciones";
import { PARAMETROS_DEFAULT, type ClaveParametro } from "@/lib/parametros";
import { registrarAuditoria } from "@/lib/auditoria";

async function leerParametros(): Promise<Record<ClaveParametro, number>> {
  const filas = await db.parametroSistema.findMany();
  const mapa = new Map(filas.map((f) => [f.clave, f.valor]));
  return Object.fromEntries(
    (Object.keys(PARAMETROS_DEFAULT) as ClaveParametro[]).map((k) => [k, mapa.get(k) ?? PARAMETROS_DEFAULT[k]]),
  ) as Record<ClaveParametro, number>;
}

export const GET = rutaAdmin(async () => {
  const g = await exigirRoles("ADMIN", "COORDINACION");
  if (esGuardaFallida(g)) return g.response;
  return jsonOk(await leerParametros());
});

export const PATCH = rutaAdmin(async (req) => {
  const g = await exigirRoles("ADMIN");
  if (esGuardaFallida(g)) return g.response;

  const parsed = await leerJson(req, editarParametrosSchema);
  if (!parsed.ok) return parsed.response;
  const cambios = parsed.data as Partial<Record<ClaveParametro, number>>;

  const antes = await leerParametros();
  const despues = { ...antes, ...cambios };

  if (despues.ventana_generacion_dias < despues.ventana_reserva_dias) {
    return jsonError(400, "VALIDACION", "La ventana de generación no puede ser menor que la de reserva.", {
      ventana_generacion_dias: ["Debe ser >= ventana_reserva_dias."],
    });
  }

  await db.$transaction(async (tx) => {
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === undefined) continue;
      await tx.parametroSistema.upsert({ where: { clave }, update: { valor }, create: { clave, valor } });
    }
    await registrarAuditoria(tx, {
      actorId: g.actor.usuarioId,
      accion: "EDITAR",
      entidad: "parametros",
      entidadId: "sistema",
      antes,
      despues,
    });
  });

  return jsonOk(despues);
});
