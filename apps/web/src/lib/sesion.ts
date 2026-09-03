// Guardas de sesión y rol para los Route Handlers (FR-6, FR-7, NFR-S1, NFR-S7).
// AC-4: sin sesión -> 401 NO_AUTENTICADO. AC-5: rol no autorizado -> 403 NO_AUTORIZADO.

import type { NextResponse } from "next/server";
import type { Rol } from "@prisma/client";
import { auth } from "@/auth";
import { jsonError } from "@/lib/api";

export interface Actor {
  usuarioId: string;
  rol: Rol;
  profesionalId: string | null;
  nombre: string;
  email: string;
}

export async function obtenerActor(): Promise<Actor | null> {
  const session = await auth();
  if (!session?.user?.usuarioId) return null;
  return {
    usuarioId: session.user.usuarioId,
    rol: session.user.rol,
    profesionalId: session.user.profesionalId ?? null,
    nombre: session.user.name ?? "",
    email: session.user.email ?? "",
  };
}

type Guarda = { actor: Actor } | { response: NextResponse };

export async function exigirSesion(): Promise<Guarda> {
  const actor = await obtenerActor();
  if (!actor) return { response: jsonError(401, "NO_AUTENTICADO", "Necesitás iniciar sesión.") };
  return { actor };
}

export async function exigirRoles(...roles: Rol[]): Promise<Guarda> {
  const g = await exigirSesion();
  if ("response" in g) return g;
  if (roles.length && !roles.includes(g.actor.rol)) {
    return { response: jsonError(403, "NO_AUTORIZADO", "No tenés permiso para esta operación.") };
  }
  return g;
}

export function esGuardaFallida(g: Guarda): g is { response: NextResponse } {
  return "response" in g;
}
