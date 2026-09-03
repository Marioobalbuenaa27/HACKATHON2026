// Setup global de Vitest para la suite de Fase 1.
// - Carga las variables de entorno de `.env.test` ANTES de que se importe `@/lib/db`.
// - Mockea `@/auth` para poder inyectar la sesión actual desde cada test sin
//   levantar NextAuth: las guardas reales de `@/lib/sesion` siguen ejecutándose
//   sobre el objeto de sesión que se inyecta.
// - Trunca todas las tablas antes de cada test (aislamiento).

import { config as cargarEnv } from "dotenv";
import { resolve } from "node:path";
import { beforeEach, vi } from "vitest";

cargarEnv({ path: resolve(__dirname, "../.env.test") });

// Sesión inyectable por test. `null` => sin sesión (401).
export interface SesionTest {
  user: {
    usuarioId: string;
    rol: "ADMIN" | "COORDINACION" | "RECEPCION" | "PROFESIONAL";
    profesionalId: string | null;
    name?: string | null;
    email?: string | null;
  };
}

const holder = vi.hoisted(() => ({ estado: { sesion: null as unknown } }));

export function usarSesion(sesion: SesionTest | null): void {
  holder.estado.sesion = sesion;
}

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => holder.estado.sesion),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
}));

const { db } = await import("../src/lib/db");
export { db };

const TABLAS = [
  "auditoria",
  "corrida_generacion",
  "slot",
  "excepcion_agenda",
  "franja_agenda",
  "categoria_especialidad",
  "categoria_problema",
  "profesional_especialidad",
  "profesional",
  "especialidad",
  "sala",
  "obra_social",
  "parametro_sistema",
  "usuario",
];

export async function limpiarDB(): Promise<void> {
  await db.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLAS.map((t) => `"turnero_test"."${t}"`).join(", ")} RESTART IDENTITY CASCADE`,
  );
}

beforeEach(async () => {
  usarSesion(null);
  await limpiarDB();
});
