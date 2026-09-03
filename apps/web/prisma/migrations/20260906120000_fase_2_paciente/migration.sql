-- Fase 2: entidad Paciente (FR-1, FR-5).
-- Aditiva: los campos paciente* de `turno` se conservan como snapshot del turno;
-- `pacienteId` referencia la ficha canónica por DNI. Nullable para el backfill.

CREATE TABLE "paciente" (
  "id" TEXT PRIMARY KEY,
  "dni" VARCHAR(16) NOT NULL,
  "nombre" VARCHAR(160) NOT NULL,
  "fechaNacimiento" DATE NOT NULL,
  "obraSocialId" TEXT,
  "obraSocialOtra" VARCHAR(120),
  "contadorAusencias" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "paciente_obraSocialId_fkey" FOREIGN KEY ("obraSocialId") REFERENCES "obra_social"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "paciente_dni_key" ON "paciente"("dni");

ALTER TABLE "turno" ADD COLUMN "pacienteId" TEXT;
ALTER TABLE "turno"
  ADD CONSTRAINT "turno_pacienteId_fkey"
  FOREIGN KEY ("pacienteId") REFERENCES "paciente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "turno_pacienteId_idx" ON "turno"("pacienteId");

-- Backfill: una ficha por DNI a partir de los turnos existentes (el turno más
-- reciente aporta nombre y fecha de nacimiento).
INSERT INTO "paciente" ("id", "dni", "nombre", "fechaNacimiento", "createdAt", "updatedAt")
SELECT DISTINCT ON ("pacienteDni")
  gen_random_uuid()::text, "pacienteDni", "pacienteNombre", "pacienteNacimiento",
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "turno"
ORDER BY "pacienteDni", "createdAt" DESC;

UPDATE "turno" t SET "pacienteId" = p."id"
FROM "paciente" p WHERE p."dni" = t."pacienteDni";

UPDATE "paciente" p SET "contadorAusencias" = sub.n
FROM (
  SELECT "pacienteDni", COUNT(*)::int AS n
  FROM "turno" WHERE "estado" = 'AUSENTE' GROUP BY "pacienteDni"
) sub
WHERE sub."pacienteDni" = p."dni";
