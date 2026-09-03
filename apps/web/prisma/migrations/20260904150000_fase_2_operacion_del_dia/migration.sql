-- Fase 2: dominio operativo diario.
ALTER TYPE "EstadoSlot" ADD VALUE IF NOT EXISTS 'OCUPADO';
CREATE TYPE "PrioridadOperativa" AS ENUM ('NORMAL', 'PREFERENCIAL', 'PRIORITARIO', 'URGENTE');
CREATE TYPE "EstadoTurno" AS ENUM ('CONFIRMADO', 'PRESENTE', 'AUSENTE', 'ATENDIDO', 'CANCELADO', 'A_REPROGRAMAR', 'REPROGRAMADO_PENDIENTE_CONFIRMACION');
CREATE TYPE "TipoTurno" AS ENUM ('NORMAL', 'SOBRETURNO');
CREATE TYPE "EstadoCasoReprogramacion" AS ENUM ('PENDIENTE', 'RESUELTO');
CREATE TYPE "TipoEventoNotificable" AS ENUM ('REPROGRAMACION_INICIADA', 'TURNO_REPROGRAMADO', 'SOBRETURNO_CREADO');
CREATE TYPE "EstadoEventoNotificable" AS ENUM ('PENDIENTE', 'ENTREGADO', 'FALLIDO');
ALTER TYPE "AccionAuditada" ADD VALUE IF NOT EXISTS 'CREAR_TURNO';
ALTER TYPE "AccionAuditada" ADD VALUE IF NOT EXISTS 'CAMBIAR_ESTADO_TURNO';
ALTER TYPE "AccionAuditada" ADD VALUE IF NOT EXISTS 'CREAR_SOBRETURNO';
ALTER TYPE "AccionAuditada" ADD VALUE IF NOT EXISTS 'OVERRIDE_SOBRETURNO';
ALTER TYPE "AccionAuditada" ADD VALUE IF NOT EXISTS 'MARCAR_AUSENCIA_PROFESIONAL';
ALTER TYPE "AccionAuditada" ADD VALUE IF NOT EXISTS 'REPROGRAMAR_TURNO';
ALTER TYPE "EntidadAuditada" ADD VALUE IF NOT EXISTS 'turno';
ALTER TYPE "EntidadAuditada" ADD VALUE IF NOT EXISTS 'demanda_espontanea';
ALTER TYPE "EntidadAuditada" ADD VALUE IF NOT EXISTS 'ausencia_profesional';
ALTER TYPE "EntidadAuditada" ADD VALUE IF NOT EXISTS 'caso_reprogramacion';

CREATE TABLE "turno" (
  "id" TEXT PRIMARY KEY, "slotId" TEXT UNIQUE, "profesionalId" TEXT NOT NULL, "especialidadId" TEXT NOT NULL, "salaId" TEXT, "categoriaId" TEXT NOT NULL,
  "fecha" DATE NOT NULL, "horaProgramada" TEXT, "horaLlegada" TIMESTAMPTZ, "tipo" "TipoTurno" NOT NULL DEFAULT 'NORMAL', "prioridad" "PrioridadOperativa" NOT NULL DEFAULT 'NORMAL', "estado" "EstadoTurno" NOT NULL DEFAULT 'CONFIRMADO',
  "pacienteNombre" VARCHAR(160) NOT NULL, "pacienteDni" VARCHAR(16) NOT NULL, "pacienteNacimiento" DATE NOT NULL, "responsableNombre" VARCHAR(160) NOT NULL, "responsableDni" VARCHAR(16), "responsableVinculo" VARCHAR(80) NOT NULL, "telefono" VARCHAR(32), "email" VARCHAR(254), "presenteAt" TIMESTAMPTZ, "ausenteAt" TIMESTAMPTZ, "atendidoAt" TIMESTAMPTZ, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ NOT NULL,
  FOREIGN KEY ("slotId") REFERENCES "slot"("id") ON DELETE SET NULL, FOREIGN KEY ("profesionalId") REFERENCES "profesional"("id"), FOREIGN KEY ("especialidadId") REFERENCES "especialidad"("id"), FOREIGN KEY ("salaId") REFERENCES "sala"("id") ON DELETE SET NULL, FOREIGN KEY ("categoriaId") REFERENCES "categoria_problema"("id")
);
CREATE INDEX "turno_fecha_estado_idx" ON "turno"("fecha", "estado"); CREATE INDEX "turno_profesional_fecha_idx" ON "turno"("profesionalId", "fecha"); CREATE INDEX "turno_paciente_idx" ON "turno"("pacienteDni", "especialidadId", "estado");
CREATE TABLE "demanda_espontanea" ("id" TEXT PRIMARY KEY, "turnoId" TEXT UNIQUE, "categoriaId" TEXT NOT NULL, "prioridadSugerida" "PrioridadOperativa" NOT NULL, "prioridadConfirmada" "PrioridadOperativa" NOT NULL, "respuestas" JSONB NOT NULL, "motivoAjuste" VARCHAR(280), "derivadaAGuardia" BOOLEAN NOT NULL DEFAULT false, "horaLlegada" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("turnoId") REFERENCES "turno"("id") ON DELETE SET NULL, FOREIGN KEY ("categoriaId") REFERENCES "categoria_problema"("id"));
CREATE INDEX "demanda_hora_idx" ON "demanda_espontanea"("horaLlegada"); CREATE INDEX "demanda_prioridad_idx" ON "demanda_espontanea"("prioridadConfirmada");
CREATE TABLE "ausencia_profesional_dia" ("id" TEXT PRIMARY KEY, "profesionalId" TEXT NOT NULL, "fecha" DATE NOT NULL, "motivo" VARCHAR(280) NOT NULL, "marcadaPorId" TEXT NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE("profesionalId", "fecha"), FOREIGN KEY ("profesionalId") REFERENCES "profesional"("id"), FOREIGN KEY ("marcadaPorId") REFERENCES "usuario"("id"));
CREATE TABLE "caso_reprogramacion" ("id" TEXT PRIMARY KEY, "turnoOrigenId" TEXT NOT NULL, "turnoDestinoId" TEXT UNIQUE, "estado" "EstadoCasoReprogramacion" NOT NULL DEFAULT 'PENDIENTE', "motivo" VARCHAR(280) NOT NULL, "resueltoPorId" TEXT, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "resueltoAt" TIMESTAMPTZ, FOREIGN KEY ("turnoOrigenId") REFERENCES "turno"("id"), FOREIGN KEY ("turnoDestinoId") REFERENCES "turno"("id") ON DELETE SET NULL);
CREATE INDEX "caso_reprogramacion_estado_idx" ON "caso_reprogramacion"("estado");
CREATE TABLE "evento_notificable" ("id" TEXT PRIMARY KEY, "turnoId" TEXT NOT NULL, "tipo" "TipoEventoNotificable" NOT NULL, "destinatario" VARCHAR(254) NOT NULL, "payload" JSONB NOT NULL, "estado" "EstadoEventoNotificable" NOT NULL DEFAULT 'PENDIENTE', "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "procesadoAt" TIMESTAMPTZ, FOREIGN KEY ("turnoId") REFERENCES "turno"("id"));
CREATE INDEX "evento_estado_created_idx" ON "evento_notificable"("estado", "createdAt");
INSERT INTO "parametro_sistema" ("clave", "valor") VALUES ('tope_sobreturnos_por_profesional_dia', 2) ON CONFLICT ("clave") DO NOTHING;
