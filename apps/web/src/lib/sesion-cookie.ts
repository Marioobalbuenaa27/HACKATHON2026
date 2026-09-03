// Emisión y borrado de la cookie de sesión (JWT) compatible con Auth.js.
// Contrato: docs/specs/fase-1-nucleo-administrativo.md (FR-4, AC-1, AC-10).
//
// El endpoint de login (POST /api/admin/auth/login) verifica las credenciales y
// las limita por rate, y luego emite el mismo JWT cifrado que emitiría NextAuth.
// `auth()` de NextAuth lo lee y lo revalida en el callback `jwt` (ver src/auth.ts).

import { encode } from "next-auth/jwt";
import type { NextResponse } from "next/server";
import type { Rol } from "@prisma/client";

export const SESION_MAX_AGE = 8 * 60 * 60; // 8 h (FR-4)

const usarSecure = process.env.NODE_ENV === "production";

/** Nombre de cookie de sesión de Auth.js (prefijo __Secure- sobre HTTPS). */
export const COOKIE_SESION = `${usarSecure ? "__Secure-" : ""}authjs.session-token`;

export interface ClaimsSesion {
  usuarioId: string;
  rol: Rol;
  profesionalId: string | null;
  nombre: string;
  email: string;
}

export function mintSessionToken(claims: ClaimsSesion): Promise<string> {
  return encode({
    salt: COOKIE_SESION,
    secret: process.env.AUTH_SECRET ?? "",
    maxAge: SESION_MAX_AGE,
    token: { ...claims, name: claims.nombre, sub: claims.usuarioId },
  });
}

const OPCIONES_BASE = {
  httpOnly: true,
  sameSite: "lax",
  secure: usarSecure,
  path: "/",
} as const;

export function setSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(COOKIE_SESION, token, { ...OPCIONES_BASE, maxAge: SESION_MAX_AGE });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(COOKIE_SESION, "", { ...OPCIONES_BASE, maxAge: 0 });
}
