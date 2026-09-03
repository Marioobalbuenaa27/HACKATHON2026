// Helpers comunes para los Route Handlers de /api/admin.
// Contrato: docs/specs/fase-1-nucleo-administrativo.md (sección API Contracts, NFR-S6, EC-2, EC-5, EC-17).

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError, type ZodType } from "zod";

export interface ApiErrorBody {
  error: string;
  message: string;
  details?: Record<string, string | string[]>;
}

export function jsonError(
  status: number,
  error: string,
  message: string,
  details?: ApiErrorBody["details"],
): NextResponse<ApiErrorBody> {
  return NextResponse.json(details ? { error, message, details } : { error, message }, { status });
}

export function jsonOk<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

/** 405 para métodos no soportados (ej. escritura sobre auditoría — AC-41). */
export function metodoNoPermitido(): NextResponse<ApiErrorBody> {
  return jsonError(405, "METODO_NO_PERMITIDO", "El recurso no admite esta operación.");
}

type LeerJsonResultado<T> = { ok: true; data: T } | { ok: false; response: NextResponse<ApiErrorBody> };

/** Parsea el body JSON y lo valida con un schema Zod. Traduce errores a los contratos de la spec. */
export async function leerJson<T>(req: Request, schema: ZodType<T>): Promise<LeerJsonResultado<T>> {
  let crudo: unknown;
  try {
    crudo = await req.json();
  } catch {
    return { ok: false, response: jsonError(400, "JSON_INVALIDO", "El cuerpo de la petición no es JSON válido.") };
  }
  const parsed = schema.safeParse(crudo);
  if (!parsed.success) {
    return { ok: false, response: jsonError(400, "VALIDACION", "Hay campos inválidos.", zodADetalles(parsed.error)) };
  }
  return { ok: true, data: parsed.data };
}

export function zodADetalles(error: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const clave = issue.path.length ? issue.path.join(".") : "_";
    (out[clave] ??= []).push(issue.message);
  }
  return out;
}

export interface Paginacion {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

/** Normaliza page/pageSize (EC-17): page >= 1, pageSize 1..100 (default 25). */
export function parsePaginacion(sp: URLSearchParams): Paginacion {
  const rawPage = Number(sp.get("page"));
  const rawSize = Number(sp.get("pageSize"));
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const pageSize =
    Number.isFinite(rawSize) && rawSize >= 1 ? Math.min(Math.floor(rawSize), 100) : 25;
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export function parseBool(v: string | null): boolean {
  return v === "true" || v === "1";
}

/**
 * Envuelve un handler para capturar errores no controlados sin filtrar detalles
 * internos (NFR-S6). Traduce fallos de conexión de Prisma a 503 (EC-5).
 */
export function rutaAdmin(
  handler: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>,
) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }): Promise<Response> => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      return traducirError(e);
    }
  };
}

export function traducirError(e: unknown): NextResponse<ApiErrorBody> {
  if (e instanceof ZodError) {
    return jsonError(400, "VALIDACION", "Hay campos inválidos.", zodADetalles(e));
  }
  if (
    e instanceof Prisma.PrismaClientInitializationError ||
    e instanceof Prisma.PrismaClientRustPanicError ||
    (e instanceof Prisma.PrismaClientKnownRequestError && ["P1000", "P1001", "P1002", "P1008", "P1017"].includes(e.code))
  ) {
    return jsonError(503, "BASE_DE_DATOS_NO_DISPONIBLE", "La base de datos no está disponible. Intentá de nuevo en unos minutos.");
  }
  console.error("[api] error no controlado:", e);
  return jsonError(500, "ERROR_INTERNO", "Ocurrió un error inesperado.");
}

/** true si el error de Prisma es una violación de unique constraint sobre alguno de los campos dados. */
export function esUniqueViolation(e: unknown, campo?: string): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== "P2002") return false;
  if (!campo) return true;
  const target = e.meta?.target;
  const campos = Array.isArray(target) ? target : typeof target === "string" ? [target] : [];
  return campos.some((c) => c.includes(campo));
}
