ALTER TYPE "EstadoSlot" ADD VALUE IF NOT EXISTS 'RESERVADO_TEMPORAL';

ALTER TABLE "slot"
  ADD COLUMN "reservadoHasta" TIMESTAMP(3),
  ADD COLUMN "reservaToken" TEXT;
CREATE UNIQUE INDEX "slot_reservaToken_key" ON "slot"("reservaToken");

ALTER TABLE "turno"
  ADD COLUMN "consentimientoAceptadoAt" TIMESTAMP(3),
  ADD COLUMN "consentimientoVersion" VARCHAR(40);

CREATE TABLE "reserva_temporal" (
  "id" TEXT NOT NULL,
  "slotId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expiraAt" TIMESTAMP(3) NOT NULL,
  "categoriaId" TEXT NOT NULL,
  "pacienteNombre" VARCHAR(160) NOT NULL,
  "pacienteDni" VARCHAR(16) NOT NULL,
  "pacienteNacimiento" DATE NOT NULL,
  "responsableNombre" VARCHAR(160) NOT NULL,
  "responsableDni" VARCHAR(16),
  "responsableVinculo" VARCHAR(80) NOT NULL,
  "telefono" VARCHAR(32),
  "email" VARCHAR(254),
  "consentimientoVersion" VARCHAR(40) NOT NULL,
  "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reserva_temporal_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "reserva_temporal_slotId_key" ON "reserva_temporal"("slotId");
CREATE UNIQUE INDEX "reserva_temporal_token_key" ON "reserva_temporal"("token");
CREATE INDEX "reserva_temporal_expiraAt_idx" ON "reserva_temporal"("expiraAt");
ALTER TABLE "reserva_temporal"
  ADD CONSTRAINT "reserva_temporal_slotId_fkey"
  FOREIGN KEY ("slotId") REFERENCES "slot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reserva_temporal"
  ADD CONSTRAINT "reserva_temporal_categoriaId_fkey"
  FOREIGN KEY ("categoriaId") REFERENCES "categoria_problema"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
