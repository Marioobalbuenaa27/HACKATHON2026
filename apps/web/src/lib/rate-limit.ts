// Rate limiting en memoria para el login (NFR-S2, AC-6).
// - 10 intentos fallidos por IP cada 10 minutos.
// - 5 intentos fallidos por email cada 10 minutos.
// Sin Redis en el MVP (decisión de stack). Ventana deslizante por proceso.

const VENTANA_MS = 10 * 60 * 1000;
const LIMITE_IP = 10;
const LIMITE_EMAIL = 5;

const fallosPorClave = new Map<string, number[]>();

function vigentes(clave: string, ahora: number): number[] {
  const arr = (fallosPorClave.get(clave) ?? []).filter((t) => ahora - t < VENTANA_MS);
  if (arr.length) fallosPorClave.set(clave, arr);
  else fallosPorClave.delete(clave);
  return arr;
}

/** true si el par (ip, email) ya superó alguno de los límites y debe recibir 429. */
export function loginBloqueado(ip: string, email: string, ahora: number = Date.now()): boolean {
  const emailKey = `email:${email.toLowerCase()}`;
  return vigentes(`ip:${ip}`, ahora).length >= LIMITE_IP || vigentes(emailKey, ahora).length >= LIMITE_EMAIL;
}

/** Registra un intento fallido para ip y email. */
export function registrarLoginFallido(ip: string, email: string, ahora: number = Date.now()): void {
  for (const clave of [`ip:${ip}`, `email:${email.toLowerCase()}`]) {
    const arr = vigentes(clave, ahora);
    arr.push(ahora);
    fallosPorClave.set(clave, arr);
  }
}

/** Limpia el contador de un email tras un login exitoso. */
export function limpiarLoginEmail(email: string): void {
  fallosPorClave.delete(`email:${email.toLowerCase()}`);
}

/** Solo para tests. */
export function _resetRateLimit(): void {
  fallosPorClave.clear();
}
