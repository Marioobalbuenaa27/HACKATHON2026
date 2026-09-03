// Helpers de test: invocación de Route Handlers sin servidor HTTP + factories.

import { vi } from "vitest";
import { db, usarSesion, type SesionTest } from "./setup";
import { hashPassword } from "@/lib/password";
import type { Rol } from "@prisma/client";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Hace fallar la primera invocación de `obj[metodo]` y delega el resto al método
 * real. No se puede `mockRestore` un método del delegate de Prisma (lo deja en
 * `undefined`), así que se fija una implementación base que llama al original.
 */
export function fallarUnaVez(obj: any, metodo: string, error: unknown): void {
  const real = (obj[metodo] as any).bind(obj);
  vi.spyOn(obj, metodo)
    .mockImplementationOnce((() => Promise.reject(error)) as any)
    .mockImplementation(((...a: any[]) => real(...a)) as any);
}

type Handler = (
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
) => Promise<Response>;

interface OpcionesLlamada {
  body?: unknown;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  raw?: string; // cuerpo crudo (para probar JSON malformado)
}

export async function llamar(handler: Handler, opts: OpcionesLlamada = {}) {
  const url = new URL("http://test.local/api/admin/x");
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);

  const tieneCuerpo = opts.body !== undefined || opts.raw !== undefined;
  const req = new Request(url, {
    method: tieneCuerpo ? "POST" : "GET",
    headers: { "content-type": "application/json", ...opts.headers },
    body: opts.raw ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  });

  const res = await handler(req, { params: Promise.resolve(opts.params ?? {}) });
  const texto = await res.text();
  let json: unknown = null;
  try {
    json = texto ? JSON.parse(texto) : null;
  } catch {
    json = texto;
  }
  return {
    status: res.status,
    body: json as any,
    headers: res.headers,
    setCookie: res.headers.get("set-cookie"),
  };
}

// --- Sesión ---
export function actuarComo(actor: {
  usuarioId: string;
  rol: Rol;
  profesionalId?: string | null;
  nombre?: string;
  email?: string;
}): SesionTest {
  const s: SesionTest = {
    user: {
      usuarioId: actor.usuarioId,
      rol: actor.rol,
      profesionalId: actor.profesionalId ?? null,
      name: actor.nombre ?? "Test",
      email: actor.email ?? "test@hospital.test",
    },
  };
  usarSesion(s);
  return s;
}

// --- Factories ---
let seq = 0;
const uniq = () => `${Date.now().toString(36)}-${seq++}`;

export const PASSWORD_OK = "clave-segura-123";

export async function crearUsuarioDB(opts: Partial<{ nombre: string; email: string; rol: Rol; activo: boolean; password: string }> = {}) {
  return db.usuario.create({
    data: {
      nombre: opts.nombre ?? "Usuario Test",
      email: (opts.email ?? `u-${uniq()}@hospital.test`).toLowerCase(),
      rol: opts.rol ?? "ADMIN",
      activo: opts.activo ?? true,
      passwordHash: await hashPassword(opts.password ?? PASSWORD_OK),
    },
  });
}

export async function actuarComoRol(rol: Rol) {
  const u = await crearUsuarioDB({ rol });
  actuarComo({ usuarioId: u.id, rol, nombre: u.nombre, email: u.email });
  return u;
}

export function crearEspecialidadDB(opts: Partial<{ nombre: string; duracionTurnoMin: number; activa: boolean }> = {}) {
  return db.especialidad.create({
    data: {
      nombre: opts.nombre ?? `Especialidad ${uniq()}`,
      duracionTurnoMin: opts.duracionTurnoMin ?? 15,
      activa: opts.activa ?? true,
    },
  });
}

export function crearSalaDB(opts: Partial<{ identificador: string; activa: boolean }> = {}) {
  return db.sala.create({
    data: { identificador: opts.identificador ?? `Consultorio ${uniq()}`, activa: opts.activa ?? true },
  });
}

export async function crearProfesionalDB(
  especialidadIds: string[],
  opts: Partial<{ nombre: string; apellido: string; matricula: string; activo: boolean; usuarioId: string | null }> = {},
) {
  return db.profesional.create({
    data: {
      nombre: opts.nombre ?? "Prof",
      apellido: opts.apellido ?? "Esional",
      matricula: opts.matricula ?? `MP-${uniq()}`,
      activo: opts.activo ?? true,
      usuarioId: opts.usuarioId ?? null,
      especialidades: { create: especialidadIds.map((especialidadId) => ({ especialidadId })) },
    },
  });
}

export async function sembrarParametros() {
  const { PARAMETROS_DEFAULT } = await import("@/lib/parametros");
  for (const [clave, valor] of Object.entries(PARAMETROS_DEFAULT)) {
    await db.parametroSistema.upsert({ where: { clave }, update: {}, create: { clave, valor } });
  }
}
