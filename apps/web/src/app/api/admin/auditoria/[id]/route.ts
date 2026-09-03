// /api/admin/auditoria/:id — FR-46, AC-41: el log es inmutable, no expone escritura.

import { metodoNoPermitido, rutaAdmin } from "@/lib/api";

export const GET = rutaAdmin(async () => metodoNoPermitido());
export const PATCH = rutaAdmin(async () => metodoNoPermitido());
export const PUT = rutaAdmin(async () => metodoNoPermitido());
export const DELETE = rutaAdmin(async () => metodoNoPermitido());
