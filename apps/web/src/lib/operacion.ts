import { Prisma, type EstadoTurno, type PrioridadOperativa, type PrismaClient } from "@prisma/client";
import { registrarAuditoria } from "@/lib/auditoria";
import { fechaHoraARaUTC, fechaISOaDateUTC } from "@/lib/fechas";

export interface ActorOperacion { usuarioId: string; rol: "ADMIN" | "COORDINACION" | "RECEPCION" | "PROFESIONAL"; profesionalId: string | null; }
export interface DatosPersona { nombre: string; dni: string; }

/** Ficha canónica del paciente por DNI (FR-1). Crea o actualiza nombre/nacimiento. */
async function upsertPaciente(tx: Prisma.TransactionClient, p: { nombre: string; dni: string; fechaNacimiento: string }) {
  const fechaNacimiento = fechaISOaDateUTC(p.fechaNacimiento);
  return tx.paciente.upsert({
    where: { dni: p.dni },
    update: { nombre: p.nombre, fechaNacimiento },
    create: { dni: p.dni, nombre: p.nombre, fechaNacimiento },
  });
}
const ESTADOS_ACTIVOS: EstadoTurno[] = ["CONFIRMADO", "PRESENTE", "A_REPROGRAMAR", "REPROGRAMADO_PENDIENTE_CONFIRMACION"];

function destinatarioProfesional(profesional: { usuario?: { email: string } | null }, id: string) {
  return profesional.usuario?.email ?? `profesional:${id}`;
}

export async function crearTurnoInterno(db: PrismaClient, actor: ActorOperacion, input: {
  slotId: string; categoriaId: string; paciente: DatosPersona & { fechaNacimiento: string };
  responsable: DatosPersona & { vinculo: string; telefono?: string; email?: string };
}) {
  return db.$transaction(async (tx) => {
    const slot = await tx.slot.findUnique({ where: { id: input.slotId } });
    if (!slot || slot.estado !== "DISPONIBLE") throw new Error("SLOT_NO_DISPONIBLE");
    const categoria = await tx.categoriaProblema.findUnique({ where: { id: input.categoriaId } });
    if (!categoria || categoria.derivarAGuardia) throw new Error("CATEGORIA_NO_RESERVABLE");
    const ocupacion = await tx.slot.updateMany({ where: { id: slot.id, estado: "DISPONIBLE" }, data: { estado: "OCUPADO" } });
    if (ocupacion.count !== 1) throw new Error("SLOT_NO_DISPONIBLE");
    const paciente = await upsertPaciente(tx, input.paciente);
    const turno = await tx.turno.create({ data: {
      slotId: slot.id, pacienteId: paciente.id, profesionalId: slot.profesionalId, especialidadId: slot.especialidadId, salaId: slot.salaId,
      categoriaId: categoria.id, fecha: slot.fecha, horaProgramada: slot.horaInicio, prioridad: categoria.prioridadBase as PrioridadOperativa,
      pacienteNombre: input.paciente.nombre, pacienteDni: input.paciente.dni, pacienteNacimiento: fechaISOaDateUTC(input.paciente.fechaNacimiento),
      responsableNombre: input.responsable.nombre, responsableDni: input.responsable.dni, responsableVinculo: input.responsable.vinculo,
      telefono: input.responsable.telefono ?? null, email: input.responsable.email ?? null,
    } });
    await registrarAuditoria(tx, { actorId: actor.usuarioId, accion: "CREAR_TURNO", entidad: "turno", entidadId: turno.id, despues: { slotId: slot.id, tipo: "NORMAL" } });
    return turno;
  });
}

const SIGUIENTES: Record<EstadoTurno, EstadoTurno[]> = {
  CONFIRMADO: ["PRESENTE", "AUSENTE"], PRESENTE: ["ATENDIDO", "AUSENTE"], AUSENTE: [], ATENDIDO: [], CANCELADO: [], A_REPROGRAMAR: [], REPROGRAMADO_PENDIENTE_CONFIRMACION: [],
};

export async function cambiarEstadoTurno(db: PrismaClient, actor: ActorOperacion, turnoId: string, estado: EstadoTurno) {
  return db.$transaction(async (tx) => {
    const turno = await tx.turno.findUnique({ where: { id: turnoId } });
    if (!turno) throw new Error("TURNO_NO_ENCONTRADO");
    if (actor.rol === "PROFESIONAL" && turno.profesionalId !== actor.profesionalId) throw new Error("SIN_PERMISO");
    if (!SIGUIENTES[turno.estado].includes(estado)) throw new Error("TRANSICION_INVALIDA");
    const ahora = new Date();
    const actualizado = await tx.turno.update({ where: { id: turno.id }, data: { estado, presenteAt: estado === "PRESENTE" ? ahora : undefined, ausenteAt: estado === "AUSENTE" ? ahora : undefined, atendidoAt: estado === "ATENDIDO" ? ahora : undefined } });
    // FR-5 / NFR-R5: el contador de ausencias del paciente sigue a sus turnos AUSENTE.
    if (estado === "AUSENTE" && turno.pacienteId) {
      await tx.paciente.update({ where: { id: turno.pacienteId }, data: { contadorAusencias: { increment: 1 } } });
    }
    await tx.eventoNotificable.create({ data: { turnoId: turno.id, tipo: "CAMBIO_ESTADO_TURNO", destinatario: turno.email ?? "responsable-sin-email", payload: { estadoAnterior: turno.estado, estadoNuevo: estado } } });
    await registrarAuditoria(tx, { actorId: actor.usuarioId, accion: "CAMBIAR_ESTADO_TURNO", entidad: "turno", entidadId: turno.id, antes: { estado: turno.estado }, despues: { estado } });
    return actualizado;
  });
}

// FR-40, FR-41: cancelación de un turno no finalizado por el personal, con motivo.
// El slot vuelve a DISPONIBLE si sigue en el futuro; si no, queda BLOQUEADO y no se re-ofrece.
const CANCELABLES: EstadoTurno[] = ["CONFIRMADO", "PRESENTE", "A_REPROGRAMAR", "REPROGRAMADO_PENDIENTE_CONFIRMACION"];

export async function cancelarTurno(db: PrismaClient, actor: ActorOperacion, turnoId: string, motivo: string) {
  return db.$transaction(async (tx) => {
    const turno = await tx.turno.findUnique({ where: { id: turnoId } });
    if (!turno) throw new Error("TURNO_NO_ENCONTRADO");
    if (!CANCELABLES.includes(turno.estado)) throw new Error("TRANSICION_INVALIDA");
    const cancelado = await tx.turno.update({ where: { id: turno.id }, data: { estado: "CANCELADO" } });
    if (turno.slotId) {
      const slot = await tx.slot.findUnique({ where: { id: turno.slotId } });
      const enFuturo = slot ? slot.inicioUtc.getTime() > Date.now() : false;
      await tx.slot.update({ where: { id: turno.slotId }, data: { estado: enFuturo ? "DISPONIBLE" : "BLOQUEADO" } });
    }
    await tx.eventoNotificable.create({ data: { turnoId: turno.id, tipo: "CAMBIO_ESTADO_TURNO", destinatario: turno.email ?? "responsable-sin-email", payload: { estadoAnterior: turno.estado, estadoNuevo: "CANCELADO", motivo, cancelacionHospital: true } } });
    await registrarAuditoria(tx, { actorId: actor.usuarioId, accion: "CAMBIAR_ESTADO_TURNO", entidad: "turno", entidadId: turno.id, motivo, antes: { estado: turno.estado }, despues: { estado: "CANCELADO" } });
    return cancelado;
  });
}

export async function registrarDemandaEspontanea(db: PrismaClient, actor: ActorOperacion, input: {
  categoriaId: string; profesionalId: string; especialidadId: string; salaId?: string; prioridadConfirmada?: PrioridadOperativa;
  motivoAjuste?: string; respuestas: Record<string, string>; paciente: DatosPersona & { fechaNacimiento: string };
  responsable: DatosPersona & { fechaNacimiento?: string; vinculo: string; telefono?: string; email?: string };
}) {
  return db.$transaction(async (tx) => {
    const categoria = await tx.categoriaProblema.findUnique({ where: { id: input.categoriaId } });
    if (!categoria) throw new Error("CATEGORIA_NO_ENCONTRADA");
    const prioridadSugerida = categoria.derivarAGuardia ? "URGENTE" : categoria.prioridadBase as PrioridadOperativa;
    const prioridad = input.prioridadConfirmada ?? prioridadSugerida;
    if (categoria.derivarAGuardia || prioridad === "URGENTE") {
      const demanda = await tx.demandaEspontanea.create({ data: {
        categoriaId: categoria.id, prioridadSugerida, prioridadConfirmada: "URGENTE", respuestas: input.respuestas, motivoAjuste: input.motivoAjuste ?? null, derivadaAGuardia: true,
      } });
      await registrarAuditoria(tx, { actorId: actor.usuarioId, accion: "CREAR_SOBRETURNO", entidad: "demanda_espontanea", entidadId: demanda.id, despues: { derivadaAGuardia: true } });
      return { demanda, turno: null };
    }
    const profesional = await tx.profesional.findUnique({ where: { id: input.profesionalId }, include: { usuario: { select: { email: true } } } });
    const especialidad = await tx.especialidad.findUnique({ where: { id: input.especialidadId } });
    if (!profesional?.activo || !especialidad?.activa) throw new Error("PROFESIONAL_O_ESPECIALIDAD_INVALIDO");
    const hoy = new Date();
    const inicioDia = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()));
    // FR-33: no se crea un sobreturno para un profesional marcado ausente esa fecha.
    const ausente = await tx.ausenciaProfesionalDia.findUnique({ where: { profesionalId_fecha: { profesionalId: profesional.id, fecha: inicioDia } } });
    if (ausente) throw new Error("PROFESIONAL_AUSENTE");
    const limite = await tx.parametroSistema.findUnique({ where: { clave: "tope_sobreturnos_por_profesional_dia" } });
    const cantidad = await tx.turno.count({ where: { profesionalId: profesional.id, fecha: inicioDia, tipo: "SOBRETURNO", estado: { in: ESTADOS_ACTIVOS } } });
    const override = actor.rol === "ADMIN" || actor.rol === "COORDINACION";
    const tope = limite?.valor ?? 2;
    if (cantidad >= tope && !override) throw new Error("TOPE_SOBRETURNOS_ALCANZADO");
    if (cantidad >= tope && !input.motivoAjuste) throw new Error("MOTIVO_OVERRIDE_REQUERIDO");
    const paciente = await upsertPaciente(tx, input.paciente);
    const turno = await tx.turno.create({ data: {
      pacienteId: paciente.id,
      profesionalId: profesional.id, especialidadId: especialidad.id, salaId: input.salaId ?? null, categoriaId: categoria.id, fecha: inicioDia,
      horaLlegada: hoy, tipo: "SOBRETURNO", prioridad, pacienteNombre: input.paciente.nombre, pacienteDni: input.paciente.dni,
      pacienteNacimiento: fechaISOaDateUTC(input.paciente.fechaNacimiento), responsableNombre: input.responsable.nombre,
      responsableDni: input.responsable.dni, responsableVinculo: input.responsable.vinculo, telefono: input.responsable.telefono ?? null, email: input.responsable.email ?? null,
    } });
    const demanda = await tx.demandaEspontanea.create({ data: {
      turnoId: turno.id, categoriaId: categoria.id, prioridadSugerida, prioridadConfirmada: prioridad, respuestas: input.respuestas,
      motivoAjuste: input.motivoAjuste ?? null,
    } });
    await tx.eventoNotificable.create({ data: { turnoId: turno.id, tipo: "SOBRETURNO_CREADO", destinatario: destinatarioProfesional(profesional, profesional.id), payload: { turnoId: turno.id } } });
    await registrarAuditoria(tx, { actorId: actor.usuarioId, accion: cantidad >= tope ? "OVERRIDE_SOBRETURNO" : "CREAR_SOBRETURNO", entidad: "turno", entidadId: turno.id, motivo: input.motivoAjuste, despues: { tipo: "SOBRETURNO", prioridad } });
    return { demanda, turno };
  });
}

export async function marcarAusenciaProfesional(db: PrismaClient, actor: ActorOperacion, input: { profesionalId: string; fecha: string; motivo: string }) {
  return db.$transaction(async (tx) => {
    const profesional = await tx.profesional.findUnique({ where: { id: input.profesionalId }, include: { usuario: { select: { email: true } } } });
    if (!profesional) throw new Error("PROFESIONAL_NO_ENCONTRADO");
    const fecha = fechaISOaDateUTC(input.fecha);
    const yaMarcada = await tx.ausenciaProfesionalDia.findUnique({ where: { profesionalId_fecha: { profesionalId: input.profesionalId, fecha } } });
    if (yaMarcada) throw new Error("AUSENCIA_YA_REGISTRADA");
    const ausencia = await tx.ausenciaProfesionalDia.create({ data: { profesionalId: input.profesionalId, fecha, motivo: input.motivo, marcadaPorId: actor.usuarioId } });
    // FR-19: bloquear la agenda de esa fecha para que no entren turnos nuevos.
    await tx.excepcionAgenda.create({ data: { profesionalId: input.profesionalId, fecha, tipo: "BLOQUEO", motivo: input.motivo } });
    await tx.slot.updateMany({ where: { profesionalId: input.profesionalId, fecha, estado: "DISPONIBLE" }, data: { estado: "BLOQUEADO" } });
    const turnos = await tx.turno.findMany({ where: { profesionalId: input.profesionalId, fecha, estado: { in: ESTADOS_ACTIVOS } } });
    for (const turno of turnos) {
      await tx.turno.update({ where: { id: turno.id }, data: { estado: "A_REPROGRAMAR" } });
      await tx.casoReprogramacion.create({ data: { turnoOrigenId: turno.id, motivo: input.motivo } });
      await tx.eventoNotificable.create({ data: { turnoId: turno.id, tipo: "REPROGRAMACION_INICIADA", destinatario: turno.email ?? destinatarioProfesional(profesional, profesional.id), payload: { motivo: input.motivo } } });
      await registrarAuditoria(tx, { actorId: actor.usuarioId, accion: "MARCAR_AUSENCIA_PROFESIONAL", entidad: "turno", entidadId: turno.id, motivo: input.motivo, antes: { estado: turno.estado }, despues: { estado: "A_REPROGRAMAR" } });
    }
    await registrarAuditoria(tx, { actorId: actor.usuarioId, accion: "MARCAR_AUSENCIA_PROFESIONAL", entidad: "ausencia_profesional", entidadId: ausencia.id, motivo: input.motivo, despues: { turnosAReprogramar: turnos.length } });
    return { ausencia, turnosAReprogramar: turnos.length };
  });
}

export async function desplazarTurno(db: PrismaClient, actor: ActorOperacion, turnoId: string, slotDestinoId: string, motivo: string) {
  return db.$transaction(async (tx) => {
    const origen = await tx.turno.findUnique({ where: { id: turnoId } });
    const destino = await tx.slot.findUnique({ where: { id: slotDestinoId } });
    if (!origen || !destino) throw new Error("TURNO_O_SLOT_NO_ENCONTRADO");
    if (origen.estado !== "CONFIRMADO" || origen.tipo === "SOBRETURNO") throw new Error("TURNO_NO_DESPLAZABLE");
    if (origen.presenteAt) throw new Error("TURNO_NO_DESPLAZABLE"); // ya hizo check-in
    if (destino.estado !== "DISPONIBLE" || destino.profesionalId !== origen.profesionalId) throw new Error("SLOT_DESTINO_INVALIDO");
    // La ventana de 24 h protege al paciente de un cambio sin aviso: se mide sobre el
    // horario del turno ORIGEN, no sobre el slot destino (FR-37).
    const inicioOrigen = origen.horaProgramada
      ? fechaHoraARaUTC(origen.fecha.toISOString().slice(0, 10), origen.horaProgramada)
      : origen.fecha;
    const ventanaParam = await tx.parametroSistema.findUnique({ where: { clave: "ventana_desplazamiento_horas" } });
    const ventanaHoras = ventanaParam?.valor ?? 24;
    if (inicioOrigen.getTime() - Date.now() < ventanaHoras * 60 * 60 * 1000) throw new Error("MENOS_DE_24_HORAS");
    const ocupacion = await tx.slot.updateMany({ where: { id: destino.id, estado: "DISPONIBLE" }, data: { estado: "OCUPADO" } });
    if (ocupacion.count !== 1) throw new Error("SLOT_DESTINO_INVALIDO");
    const nuevo = await tx.turno.create({ data: { ...Object.fromEntries(Object.entries(origen).filter(([key]) => !["id", "slotId", "createdAt", "updatedAt", "estado", "horaProgramada", "salaId"].includes(key))), slotId: destino.id, salaId: destino.salaId, fecha: destino.fecha, horaProgramada: destino.horaInicio, estado: "REPROGRAMADO_PENDIENTE_CONFIRMACION" } as never });
    await tx.turno.update({ where: { id: origen.id }, data: { estado: "REPROGRAMADO_PENDIENTE_CONFIRMACION" } });
    const caso = await tx.casoReprogramacion.create({ data: { turnoOrigenId: origen.id, turnoDestinoId: nuevo.id, estado: "PENDIENTE", motivo } });
    await tx.eventoNotificable.create({ data: { turnoId: nuevo.id, tipo: "TURNO_REPROGRAMADO", destinatario: origen.email ?? "responsable-sin-email", payload: { turnoOrigenId: origen.id, motivo } } });
    await registrarAuditoria(tx, { actorId: actor.usuarioId, accion: "REPROGRAMAR_TURNO", entidad: "caso_reprogramacion", entidadId: caso.id, motivo, antes: { turnoId: origen.id }, despues: { turnoId: nuevo.id } });
    return { caso, turno: nuevo };
  });
}

export async function resolverCasoReprogramacion(db: PrismaClient, actor: ActorOperacion, casoId: string, slotDestinoId: string, motivo: string) {
  return db.$transaction(async (tx) => {
    const caso = await tx.casoReprogramacion.findUnique({ where: { id: casoId }, include: { turnoOrigen: true } });
    const destino = await tx.slot.findUnique({ where: { id: slotDestinoId } });
    if (!caso || !destino) throw new Error("CASO_O_SLOT_NO_ENCONTRADO");
    if (caso.estado !== "PENDIENTE" || caso.turnoOrigen.estado !== "A_REPROGRAMAR") throw new Error("CASO_NO_PENDIENTE");
    if (destino.estado !== "DISPONIBLE" || destino.profesionalId !== caso.turnoOrigen.profesionalId || destino.especialidadId !== caso.turnoOrigen.especialidadId) throw new Error("SLOT_DESTINO_INVALIDO");
    const ocupacion = await tx.slot.updateMany({ where: { id: destino.id, estado: "DISPONIBLE" }, data: { estado: "OCUPADO" } });
    if (ocupacion.count !== 1) throw new Error("SLOT_DESTINO_INVALIDO");
    const nuevo = await tx.turno.create({ data: {
      slotId: destino.id, pacienteId: caso.turnoOrigen.pacienteId, profesionalId: destino.profesionalId, especialidadId: destino.especialidadId, salaId: destino.salaId,
      categoriaId: caso.turnoOrigen.categoriaId, fecha: destino.fecha, horaProgramada: destino.horaInicio, tipo: caso.turnoOrigen.tipo,
      prioridad: caso.turnoOrigen.prioridad, estado: "REPROGRAMADO_PENDIENTE_CONFIRMACION", pacienteNombre: caso.turnoOrigen.pacienteNombre,
      pacienteDni: caso.turnoOrigen.pacienteDni, pacienteNacimiento: caso.turnoOrigen.pacienteNacimiento, responsableNombre: caso.turnoOrigen.responsableNombre,
      responsableDni: caso.turnoOrigen.responsableDni, responsableVinculo: caso.turnoOrigen.responsableVinculo, telefono: caso.turnoOrigen.telefono, email: caso.turnoOrigen.email,
    } });
    const resuelto = await tx.casoReprogramacion.update({ where: { id: caso.id }, data: { turnoDestinoId: nuevo.id, estado: "RESUELTO", resueltoPorId: actor.usuarioId, resueltoAt: new Date(), motivo } });
    await tx.eventoNotificable.create({ data: { turnoId: nuevo.id, tipo: "TURNO_REPROGRAMADO", destinatario: nuevo.email ?? "responsable-sin-email", payload: { turnoOrigenId: caso.turnoOrigenId, motivo } } });
    await registrarAuditoria(tx, { actorId: actor.usuarioId, accion: "REPROGRAMAR_TURNO", entidad: "caso_reprogramacion", entidadId: caso.id, motivo, antes: { estado: caso.estado }, despues: { estado: "RESUELTO", turnoDestinoId: nuevo.id } });
    return { caso: resuelto, turno: nuevo };
  });
}

export function traducirErrorOperacion(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (["SLOT_NO_DISPONIBLE", "CATEGORIA_NO_RESERVABLE", "TRANSICION_INVALIDA", "TOPE_SOBRETURNOS_ALCANZADO", "MOTIVO_OVERRIDE_REQUERIDO", "CATEGORIA_NO_ENCONTRADA", "PROFESIONAL_O_ESPECIALIDAD_INVALIDO", "TURNO_NO_DESPLAZABLE", "SLOT_DESTINO_INVALIDO", "MENOS_DE_24_HORAS", "PROFESIONAL_AUSENTE", "AUSENCIA_YA_REGISTRADA"].includes(code)) return { status: 409, code };
  if (["PROFESIONAL_NO_ENCONTRADO", "TURNO_O_SLOT_NO_ENCONTRADO", "CASO_O_SLOT_NO_ENCONTRADO"].includes(code)) return { status: 404, code };
  if (code === "CASO_NO_PENDIENTE") return { status: 409, code };
  if (code === "TURNO_NO_ENCONTRADO") return { status: 404, code };
  if (code === "SIN_PERMISO") return { status: 403, code };
  return null;
}
