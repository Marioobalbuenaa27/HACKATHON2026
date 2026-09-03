// POST /api/admin/auth/login  (público, rate-limited) — FR-1..FR-3, NFR-S2, AC-1..AC-3, AC-6, EC-1.

import { jsonError, jsonOk, leerJson, rutaAdmin } from "@/lib/api";
import { loginSchema } from "@/lib/validaciones";
import { limpiarLoginEmail, loginBloqueado, registrarLoginFallido } from "@/lib/rate-limit";
import { verificarCredenciales } from "@/lib/credenciales";
import { mintSessionToken, setSessionCookie } from "@/lib/sesion-cookie";

function ipDe(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  return xff?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "0.0.0.0";
}

export const POST = rutaAdmin(async (req) => {
  const parsed = await leerJson(req, loginSchema);
  if (!parsed.ok) return parsed.response;
  const { email, password } = parsed.data;
  const ip = ipDe(req);

  // El rate-limit se evalúa ANTES de tocar las credenciales (AC-6).
  if (loginBloqueado(ip, email)) {
    return jsonError(429, "DEMASIADOS_INTENTOS", "Demasiados intentos fallidos. Esperá unos minutos.");
  }

  const usuario = await verificarCredenciales(email, password);
  if (!usuario) {
    registrarLoginFallido(ip, email);
    return jsonError(401, "CREDENCIALES_INVALIDAS", "Email o contraseña incorrectos.");
  }

  limpiarLoginEmail(email);
  const token = await mintSessionToken({
    usuarioId: usuario.id,
    rol: usuario.rol,
    profesionalId: usuario.profesionalId,
    nombre: usuario.nombre,
    email: usuario.email,
  });

  const res = jsonOk({ usuarioId: usuario.id, nombre: usuario.nombre, rol: usuario.rol });
  setSessionCookie(res, token);
  return res;
});
