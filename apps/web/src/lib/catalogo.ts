// Helpers compartidos de los ABM de catálogo (FR-13..FR-24).

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { parseBool, parsePaginacion, type Paginated } from "@/lib/api";

/** Filtro `activa` estándar: por defecto sólo activas, salvo ?incluirInactivas=true (FR-22). */
export function filtroActivas(sp: URLSearchParams, campo = "activa"): Record<string, boolean> {
  return parseBool(sp.get("incluirInactivas")) ? {} : { [campo]: true };
}

export async function paginado<T>(
  contar: () => Promise<number>,
  listar: (skip: number, take: number) => Promise<T[]>,
  sp: URLSearchParams,
): Promise<Paginated<T>> {
  const { page, pageSize, skip, take } = parsePaginacion(sp);
  const [total, items] = await Promise.all([contar(), listar(skip, take)]);
  return { items, page, pageSize, total };
}

type ModeloConNombre = "especialidad" | "obraSocial" | "sala" | "categoriaProblema" | "profesional";

/**
 * Devuelve el id de una fila cuyo `campo` coincide case-insensitive con `valor`,
 * excluyendo opcionalmente un id (para edición). Coherente con los índices únicos
 * funcionales `lower(campo)` de la migración (FR-24, EC-4).
 */
export async function idPorNombreCI(
  modelo: ModeloConNombre,
  campo: string,
  valor: string,
  exceptoId?: string,
): Promise<string | null> {
  const where: Prisma.Sql | Record<string, unknown> = {
    [campo]: { equals: valor, mode: "insensitive" },
    ...(exceptoId ? { id: { not: exceptoId } } : {}),
  };
  // @ts-expect-error acceso dinámico al delegate
  const fila = await db[modelo].findFirst({ where, select: { id: true } });
  return fila?.id ?? null;
}
