// Hashing de contraseñas del personal del panel (FR-3, NFR-S3).
// Algoritmo: argon2id (derivación lenta). El hash nunca sale en una respuesta de API.

import { hash, verify } from "@node-rs/argon2";
import { randomBytes } from "node:crypto";

export const PASSWORD_MIN = 10; // NFR-S3

export function hashPassword(plano: string): Promise<string> {
  return hash(plano);
}

export async function verifyPassword(hashGuardado: string, plano: string): Promise<boolean> {
  try {
    return await verify(hashGuardado, plano);
  } catch {
    return false;
  }
}

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/** Contraseña temporal legible de 14 caracteres (> PASSWORD_MIN). Para reset asistido por ADMIN (FR-12). */
export function generarPasswordTemporal(largo = 14): string {
  const bytes = randomBytes(largo);
  let out = "";
  for (let i = 0; i < largo; i++) out += ALFABETO[bytes[i] % ALFABETO.length];
  return out;
}
