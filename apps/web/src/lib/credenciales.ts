// Verificación de credenciales del panel para el login propio (FR-1, FR-2, FR-3).
// Error genérico: no se distingue email inexistente / cuenta inactiva / password.

import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

// Hash de forma válida pero que nunca coincide: iguala aproximadamente el costo
// temporal cuando el usuario no existe o está inactivo (mitiga enumeración).
const HASH_SENUELO =
  "$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0$RdescudvJCsgt3ub+b+dWRWJTmaaJObG";

export interface UsuarioAutenticado {
  id: string;
  nombre: string;
  email: string;
  rol: import("@prisma/client").Rol;
  profesionalId: string | null;
}

export async function verificarCredenciales(
  email: string,
  password: string,
): Promise<UsuarioAutenticado | null> {
  const usuario = await db.usuario.findUnique({
    where: { email: email.toLowerCase() },
    include: { profesional: { select: { id: true } } },
  });

  if (!usuario || !usuario.activo) {
    await verifyPassword(HASH_SENUELO, password);
    return null;
  }
  if (!(await verifyPassword(usuario.passwordHash, password))) return null;

  return {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol,
    profesionalId: usuario.profesional?.id ?? null,
  };
}
