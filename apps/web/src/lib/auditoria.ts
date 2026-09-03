// Log de auditoría inmutable (FR-44, FR-45, FR-46, AC-40, AC-41).
// Se escribe SIEMPRE dentro de la misma transacción que la operación auditada.
// La aplicación nunca hace UPDATE ni DELETE sobre `auditoria`.

import { Prisma, type AccionAuditada, type EntidadAuditada, type PrismaClient } from "@prisma/client";

type ClienteDB = PrismaClient | Prisma.TransactionClient;

export interface EntradaAuditoria {
  actorId: string;
  accion: AccionAuditada;
  entidad: EntidadAuditada;
  entidadId: string;
  motivo?: string | null;
  antes?: unknown;
  despues?: unknown;
}

export function registrarAuditoria(db: ClienteDB, e: EntradaAuditoria) {
  return db.auditoria.create({
    data: {
      actorId: e.actorId,
      accion: e.accion,
      entidad: e.entidad,
      entidadId: e.entidadId,
      motivo: e.motivo ?? null,
      antes: (e.antes ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      despues: (e.despues ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    },
  });
}
