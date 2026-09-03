// Configuración de Auth.js (NextAuth v5) — provider Credentials, estrategia JWT.
// Contrato: docs/specs/fase-1-nucleo-administrativo.md (Data Models → "Sesión", FR-1..FR-4, FR-11, NFR-S4).
//
// No hay tabla de sesión: la cookie es el JWT firmado con AUTH_SECRET (httpOnly + Secure
// + SameSite=Lax, maxAge 8 h). Para invalidación server-side sin tabla, el callback `jwt`
// revalida el Usuario contra la base en cada request y rechaza el token si la cuenta se
// desactivó o la contraseña cambió después de emitirse el token.

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { Rol } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

/** Forma del JWT de sesión que persistimos entre requests. */
interface TokenSesion {
  usuarioId: string;
  rol: Rol;
  profesionalId: string | null;
  nombre: string;
  email: string;
  iat?: number;
  [k: string]: unknown;
}

const SESION_MAX_AGE = 8 * 60 * 60; // 8 h (FR-4)

const credsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: SESION_MAX_AGE },
  pages: { signIn: "/admin/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const usuario = await db.usuario.findUnique({
          where: { email: email.toLowerCase() },
          include: { profesional: { select: { id: true } } },
        });
        // Error genérico: no distinguir inexistente / inactivo / password (FR-2).
        if (!usuario || !usuario.activo) {
          // Igualar el costo temporal aproximando una verificación.
          await verifyPassword(
            "$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0$0000000000000000000000000000000000000000000",
            password,
          );
          return null;
        }
        if (!(await verifyPassword(usuario.passwordHash, password))) return null;

        return {
          id: usuario.id,
          usuarioId: usuario.id,
          name: usuario.nombre,
          email: usuario.email,
          rol: usuario.rol,
          profesionalId: usuario.profesional?.id ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const t = token as TokenSesion;

      // Alta de sesión.
      if (user) {
        const u = user as { id?: string; usuarioId?: string; rol?: Rol; profesionalId?: string | null; name?: string | null; email?: string | null };
        t.usuarioId = u.usuarioId ?? u.id ?? "";
        t.rol = u.rol as Rol;
        t.profesionalId = u.profesionalId ?? null;
        t.nombre = u.name ?? "";
        t.email = u.email ?? "";
        return t;
      }

      // Revalidación en cada request (FR-11 / NFR-S4).
      if (!t.usuarioId) return null;
      const usuario = await db.usuario.findUnique({
        where: { id: t.usuarioId },
        include: { profesional: { select: { id: true } } },
      });
      if (!usuario || !usuario.activo) return null;
      const iatMs = (t.iat ?? 0) * 1000;
      if (usuario.passwordActualizadaAt.getTime() > iatMs) return null;

      t.rol = usuario.rol;
      t.nombre = usuario.nombre;
      t.email = usuario.email;
      t.profesionalId = usuario.profesional?.id ?? null;
      return t;
    },
    async session({ session, token }) {
      const t = token as TokenSesion;
      if (t?.usuarioId) {
        session.user.usuarioId = t.usuarioId;
        session.user.rol = t.rol;
        session.user.profesionalId = t.profesionalId;
        session.user.name = t.nombre;
        session.user.email = t.email;
      }
      return session;
    },
  },
});
