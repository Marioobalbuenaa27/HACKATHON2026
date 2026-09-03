// Wrapper `fetch` tipado para los Route Handlers de `/api/admin/**`.
// Traduce el cuerpo de error común `{ error, message, details? }` a `ApiError`.

import type { ApiErrorBody } from "./tipos";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ApiErrorBody["details"];

  constructor(status: number, body: Partial<ApiErrorBody>) {
    super(body.message || body.error || `Error ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.code = body.error || "ERROR";
    this.details = body.details;
  }

  /** Primer mensaje de error asociado a un campo, si lo hay. */
  detalleDe(campo: string): string | undefined {
    const v = this.details?.[campo];
    if (!v) return undefined;
    return Array.isArray(v) ? v[0] : v;
  }
}

async function parsear(res: Response): Promise<unknown> {
  const texto = await res.text();
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      credentials: "same-origin",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(0, {
      error: "SIN_CONEXION",
      message: "No se pudo contactar al servidor. Revisá tu conexión.",
    });
  }

  const cuerpo = await parsear(res);

  if (!res.ok) {
    throw new ApiError(res.status, (cuerpo as Partial<ApiErrorBody>) ?? {});
  }

  return cuerpo as T;
}

/** Helpers de verbo. El body se serializa acá. */
export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  del: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
};
