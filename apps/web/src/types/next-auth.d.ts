import type { Rol } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      usuarioId: string;
      rol: Rol;
      profesionalId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    usuarioId?: string;
    rol?: Rol;
    profesionalId?: string | null;
  }
}

// La interfaz `JWT` vive en `@auth/core/jwt`; `next-auth/jwt` sólo la re-exporta,
// así que la augmentación tiene que apuntar al módulo de origen para que TS la
// funda con la interfaz real.
declare module "@auth/core/jwt" {
  interface JWT {
    usuarioId: string;
    rol: Rol;
    profesionalId: string | null;
    nombre: string;
    email: string;
  }
}
