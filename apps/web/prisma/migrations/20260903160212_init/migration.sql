-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'COORDINACION', 'RECEPCION', 'PROFESIONAL');

-- CreateEnum
CREATE TYPE "PrioridadBase" AS ENUM ('NORMAL', 'PREFERENCIAL', 'PRIORITARIO');

-- CreateEnum
CREATE TYPE "DiaSemana" AS ENUM ('LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO');

-- CreateEnum
CREATE TYPE "TipoExcepcion" AS ENUM ('BLOQUEO', 'APERTURA');

-- CreateEnum
CREATE TYPE "EstadoSlot" AS ENUM ('DISPONIBLE', 'BLOQUEADO');

-- CreateEnum
CREATE TYPE "OrigenSlot" AS ENUM ('FRANJA', 'APERTURA');

-- CreateEnum
CREATE TYPE "DisparadorCorrida" AS ENUM ('JOB', 'MANUAL', 'INCREMENTAL');

-- CreateEnum
CREATE TYPE "EstadoCorrida" AS ENUM ('OK', 'SALTADA', 'ERROR');

-- CreateEnum
CREATE TYPE "AccionAuditada" AS ENUM ('CREAR', 'EDITAR', 'ELIMINAR', 'DESACTIVAR', 'ACTIVAR', 'RESET_PASSWORD');

-- CreateEnum
CREATE TYPE "EntidadAuditada" AS ENUM ('usuario', 'franja', 'excepcion', 'parametros');

-- CreateTable
CREATE TABLE "usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "passwordActualizadaAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "especialidad" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "duracionTurnoMin" INTEGER NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "especialidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profesional" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "matricula" TEXT NOT NULL,
    "usuarioId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profesional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profesional_especialidad" (
    "profesionalId" TEXT NOT NULL,
    "especialidadId" TEXT NOT NULL,

    CONSTRAINT "profesional_especialidad_pkey" PRIMARY KEY ("profesionalId","especialidadId")
);

-- CreateTable
CREATE TABLE "categoria_problema" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "ayuda" TEXT,
    "prioridadBase" "PrioridadBase" NOT NULL DEFAULT 'NORMAL',
    "derivarAGuardia" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categoria_problema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categoria_especialidad" (
    "categoriaId" TEXT NOT NULL,
    "especialidadId" TEXT NOT NULL,
    "nota" VARCHAR(280),

    CONSTRAINT "categoria_especialidad_pkey" PRIMARY KEY ("categoriaId","especialidadId")
);

-- CreateTable
CREATE TABLE "sala" (
    "id" TEXT NOT NULL,
    "identificador" TEXT NOT NULL,
    "ubicacion" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sala_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obra_social" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "obra_social_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "franja_agenda" (
    "id" TEXT NOT NULL,
    "profesionalId" TEXT NOT NULL,
    "diaSemana" "DiaSemana" NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,
    "especialidadId" TEXT NOT NULL,
    "salaId" TEXT NOT NULL,
    "vigenciaDesde" DATE NOT NULL,
    "vigenciaHasta" DATE,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "inconsistente" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "franja_agenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "excepcion_agenda" (
    "id" TEXT NOT NULL,
    "profesionalId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "tipo" "TipoExcepcion" NOT NULL,
    "horaInicio" TEXT,
    "horaFin" TEXT,
    "especialidadId" TEXT,
    "salaId" TEXT,
    "motivo" VARCHAR(280) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "excepcion_agenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slot" (
    "id" TEXT NOT NULL,
    "profesionalId" TEXT NOT NULL,
    "especialidadId" TEXT NOT NULL,
    "salaId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,
    "inicioUtc" TIMESTAMP(3) NOT NULL,
    "finUtc" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoSlot" NOT NULL DEFAULT 'DISPONIBLE',
    "origen" "OrigenSlot" NOT NULL,
    "origenId" TEXT NOT NULL,
    "huerfano" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametro_sistema" (
    "clave" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parametro_sistema_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "corrida_generacion" (
    "id" TEXT NOT NULL,
    "disparador" "DisparadorCorrida" NOT NULL,
    "actorId" TEXT,
    "profesionalId" TEXT,
    "creados" INTEGER NOT NULL DEFAULT 0,
    "eliminados" INTEGER NOT NULL DEFAULT 0,
    "sinCambios" INTEGER NOT NULL DEFAULT 0,
    "estado" "EstadoCorrida" NOT NULL,
    "detalle" TEXT,
    "iniciadaAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizadaAt" TIMESTAMP(3),

    CONSTRAINT "corrida_generacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "accion" "AccionAuditada" NOT NULL,
    "entidad" "EntidadAuditada" NOT NULL,
    "entidadId" TEXT NOT NULL,
    "motivo" VARCHAR(280),
    "antes" JSONB,
    "despues" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE INDEX "usuario_rol_idx" ON "usuario"("rol");

-- CreateIndex
CREATE UNIQUE INDEX "especialidad_nombre_key" ON "especialidad"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "profesional_matricula_key" ON "profesional"("matricula");

-- CreateIndex
CREATE UNIQUE INDEX "profesional_usuarioId_key" ON "profesional"("usuarioId");

-- CreateIndex
CREATE INDEX "profesional_especialidad_especialidadId_idx" ON "profesional_especialidad"("especialidadId");

-- CreateIndex
CREATE UNIQUE INDEX "categoria_problema_nombre_key" ON "categoria_problema"("nombre");

-- CreateIndex
CREATE INDEX "categoria_problema_orden_idx" ON "categoria_problema"("orden");

-- CreateIndex
CREATE INDEX "categoria_especialidad_especialidadId_idx" ON "categoria_especialidad"("especialidadId");

-- CreateIndex
CREATE UNIQUE INDEX "sala_identificador_key" ON "sala"("identificador");

-- CreateIndex
CREATE UNIQUE INDEX "obra_social_nombre_key" ON "obra_social"("nombre");

-- CreateIndex
CREATE INDEX "franja_agenda_profesionalId_diaSemana_idx" ON "franja_agenda"("profesionalId", "diaSemana");

-- CreateIndex
CREATE INDEX "franja_agenda_profesionalId_activa_idx" ON "franja_agenda"("profesionalId", "activa");

-- CreateIndex
CREATE INDEX "excepcion_agenda_profesionalId_fecha_idx" ON "excepcion_agenda"("profesionalId", "fecha");

-- CreateIndex
CREATE INDEX "slot_profesionalId_fecha_idx" ON "slot"("profesionalId", "fecha");

-- CreateIndex
CREATE INDEX "slot_fecha_estado_idx" ON "slot"("fecha", "estado");

-- CreateIndex
CREATE INDEX "slot_origen_origenId_idx" ON "slot"("origen", "origenId");

-- CreateIndex
CREATE UNIQUE INDEX "slot_profesionalId_fecha_horaInicio_key" ON "slot"("profesionalId", "fecha", "horaInicio");

-- CreateIndex
CREATE INDEX "corrida_generacion_iniciadaAt_idx" ON "corrida_generacion"("iniciadaAt");

-- CreateIndex
CREATE INDEX "auditoria_entidad_timestamp_idx" ON "auditoria"("entidad", "timestamp");

-- CreateIndex
CREATE INDEX "auditoria_actorId_timestamp_idx" ON "auditoria"("actorId", "timestamp");

-- AddForeignKey
ALTER TABLE "profesional" ADD CONSTRAINT "profesional_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profesional_especialidad" ADD CONSTRAINT "profesional_especialidad_profesionalId_fkey" FOREIGN KEY ("profesionalId") REFERENCES "profesional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profesional_especialidad" ADD CONSTRAINT "profesional_especialidad_especialidadId_fkey" FOREIGN KEY ("especialidadId") REFERENCES "especialidad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categoria_especialidad" ADD CONSTRAINT "categoria_especialidad_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categoria_problema"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categoria_especialidad" ADD CONSTRAINT "categoria_especialidad_especialidadId_fkey" FOREIGN KEY ("especialidadId") REFERENCES "especialidad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "franja_agenda" ADD CONSTRAINT "franja_agenda_profesionalId_fkey" FOREIGN KEY ("profesionalId") REFERENCES "profesional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "franja_agenda" ADD CONSTRAINT "franja_agenda_especialidadId_fkey" FOREIGN KEY ("especialidadId") REFERENCES "especialidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "franja_agenda" ADD CONSTRAINT "franja_agenda_salaId_fkey" FOREIGN KEY ("salaId") REFERENCES "sala"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "excepcion_agenda" ADD CONSTRAINT "excepcion_agenda_profesionalId_fkey" FOREIGN KEY ("profesionalId") REFERENCES "profesional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "excepcion_agenda" ADD CONSTRAINT "excepcion_agenda_especialidadId_fkey" FOREIGN KEY ("especialidadId") REFERENCES "especialidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "excepcion_agenda" ADD CONSTRAINT "excepcion_agenda_salaId_fkey" FOREIGN KEY ("salaId") REFERENCES "sala"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot" ADD CONSTRAINT "slot_profesionalId_fkey" FOREIGN KEY ("profesionalId") REFERENCES "profesional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot" ADD CONSTRAINT "slot_especialidadId_fkey" FOREIGN KEY ("especialidadId") REFERENCES "especialidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot" ADD CONSTRAINT "slot_salaId_fkey" FOREIGN KEY ("salaId") REFERENCES "sala"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrida_generacion" ADD CONSTRAINT "corrida_generacion_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
