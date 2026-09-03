import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { fechaISOaDateUTC } from "@/lib/fechas";

const CONSENTIMIENTO_ACTUAL = "2026-09-01";

export async function reservarSlot(db: PrismaClient, input: {
  slotId: string; categoriaId: string;
  paciente: { nombre: string; dni: string; fechaNacimiento: string };
  responsable: { nombre: string; dni: string; vinculo: string; telefono?: string; email?: string };
  consentimientoVersion: string;
}) {
  return db.$transaction(async (tx) => {
    const ahora = new Date();
    await tx.reservaTemporal.deleteMany({ where: { expiraAt: { lte: ahora } } });
    const slot = await tx.slot.findUnique({ where: { id: input.slotId } });
    const categoria = await tx.categoriaProblema.findUnique({ where: { id: input.categoriaId } });
    if (!slot || slot.estado !== "DISPONIBLE" || slot.inicioUtc <= ahora) throw new Error("SLOT_NO_DISPONIBLE");
    if (!categoria?.activa || categoria.derivarAGuardia) throw new Error("CATEGORIA_NO_RESERVABLE");
    const mapeo = await tx.categoriaEspecialidad.findUnique({ where: { categoriaId_especialidadId: { categoriaId: categoria.id, especialidadId: slot.especialidadId } } });
    if (!mapeo) throw new Error("CATEGORIA_ESPECIALIDAD_INVALIDA");
    const minutos = (await tx.parametroSistema.findUnique({ where: { clave: "reserva_temporal_minutos" } }))?.valor ?? 7;
    const expiraAt = new Date(ahora.getTime() + minutos * 60_000);
    const token = randomBytes(32).toString("base64url");
    const ocupacion = await tx.slot.updateMany({ where: { id: slot.id, estado: "DISPONIBLE" }, data: { estado: "RESERVADO_TEMPORAL", reservadoHasta: expiraAt, reservaToken: token } });
    if (ocupacion.count !== 1) throw new Error("SLOT_NO_DISPONIBLE");
    return tx.reservaTemporal.create({ data: {
      slotId: slot.id, token, expiraAt, categoriaId: categoria.id,
      pacienteNombre: input.paciente.nombre, pacienteDni: input.paciente.dni, pacienteNacimiento: fechaISOaDateUTC(input.paciente.fechaNacimiento),
      responsableNombre: input.responsable.nombre, responsableDni: input.responsable.dni, responsableVinculo: input.responsable.vinculo,
      telefono: input.responsable.telefono ?? null, email: input.responsable.email ?? null,
      consentimientoVersion: input.consentimientoVersion,
    }, include: { slot: { include: { profesional: true, especialidad: true, sala: true } } } });
  });
}

export async function confirmarReserva(db: PrismaClient, token: string) {
  return db.$transaction(async (tx) => {
    const reserva = await tx.reservaTemporal.findUnique({ where: { token }, include: { slot: true } });
    if (!reserva || reserva.expiraAt <= new Date() || reserva.slot.estado !== "RESERVADO_TEMPORAL") throw new Error("RESERVA_EXPIRADA");
    const turno = await tx.turno.create({ data: {
      slotId: reserva.slotId, profesionalId: reserva.slot.profesionalId, especialidadId: reserva.slot.especialidadId, salaId: reserva.slot.salaId,
      categoriaId: reserva.categoriaId, fecha: reserva.slot.fecha, horaProgramada: reserva.slot.horaInicio,
      pacienteNombre: reserva.pacienteNombre, pacienteDni: reserva.pacienteDni, pacienteNacimiento: reserva.pacienteNacimiento,
      responsableNombre: reserva.responsableNombre, responsableDni: reserva.responsableDni, responsableVinculo: reserva.responsableVinculo,
      telefono: reserva.telefono, email: reserva.email, consentimientoAceptadoAt: new Date(), consentimientoVersion: reserva.consentimientoVersion,
    } });
    await tx.slot.update({ where: { id: reserva.slotId }, data: { estado: "OCUPADO", reservadoHasta: null, reservaToken: null } });
    await tx.reservaTemporal.delete({ where: { id: reserva.id } });
    if (turno.email) await tx.eventoNotificable.create({ data: { turnoId: turno.id, tipo: "CAMBIO_ESTADO_TURNO", destinatario: turno.email, payload: { asunto: "Turno confirmado", turnoId: turno.id } } });
    return turno;
  });
}

export async function consultarTurnos(db: PrismaClient, dni: string, fechaNacimiento: string) {
  const turnos = await db.turno.findMany({ where: { pacienteDni: dni, pacienteNacimiento: fechaISOaDateUTC(fechaNacimiento), estado: { not: "CANCELADO" } }, include: { profesional: true, especialidad: true, sala: true }, orderBy: [{ fecha: "asc" }, { horaProgramada: "asc" }], take: 20 });
  return turnos.map((turno) => ({ id: turno.id, fecha: turno.fecha.toISOString().slice(0, 10), horaProgramada: turno.horaProgramada, estado: turno.estado, pacienteNombre: turno.pacienteNombre, profesional: `${turno.profesional.nombre} ${turno.profesional.apellido}`, especialidad: turno.especialidad.nombre, sala: turno.sala?.identificador ?? null }));
}

export async function expirarReservas(db: PrismaClient) {
  return db.$transaction(async (tx) => {
    const vencidas = await tx.reservaTemporal.findMany({ where: { expiraAt: { lte: new Date() } }, select: { slotId: true } });
    if (!vencidas.length) return 0;
    await tx.slot.updateMany({ where: { id: { in: vencidas.map((r) => r.slotId) }, estado: "RESERVADO_TEMPORAL" }, data: { estado: "DISPONIBLE", reservadoHasta: null, reservaToken: null } });
    await tx.reservaTemporal.deleteMany({ where: { slotId: { in: vencidas.map((r) => r.slotId) } } });
    return vencidas.length;
  });
}

export async function anonimizarDatosVencidos(db: PrismaClient) {
  const meses = (await db.parametroSistema.findUnique({ where: { clave: "retencion_datos_meses" } }))?.valor ?? 12;
  const limite = new Date();
  limite.setUTCMonth(limite.getUTCMonth() - meses);
  const resultado = await db.turno.updateMany({ where: { createdAt: { lt: limite }, pacienteNombre: { not: "Datos retenidos" } }, data: { pacienteNombre: "Datos retenidos", pacienteDni: "0000000", responsableNombre: "Datos retenidos", responsableDni: null, telefono: null, email: null } });
  return resultado.count;
}

export { CONSENTIMIENTO_ACTUAL };