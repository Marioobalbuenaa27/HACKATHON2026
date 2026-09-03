// Sólo para páginas server de `/admin/**`.

import { notFound } from "next/navigation";
import { getActorOrRedirect } from "./server";
import { puedeEditar, puedeVer, type Seccion } from "@/lib/permisos";
import type { Perfil } from "@/lib/http/tipos";

export interface AccesoSeccion {
  actor: Perfil;
  puedeEditar: boolean;
}

/**
 * Para páginas de `/admin/<seccion>`: exige sesión y que el rol pueda VER la sección
 * (si no, 404 — la nav ya la oculta, esto cubre el acceso directo por URL).
 * Devuelve además si el rol puede editar, para pasarlo a la tabla.
 */
export async function exigirAccesoSeccion(seccion: Seccion): Promise<AccesoSeccion> {
  const actor = await getActorOrRedirect(`/admin/${seccion}`);
  if (!puedeVer(actor.rol, seccion)) notFound();
  return { actor, puedeEditar: puedeEditar(actor.rol, seccion) };
}
