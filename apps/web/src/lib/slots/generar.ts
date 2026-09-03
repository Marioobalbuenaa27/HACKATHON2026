// Generación de slots contra la base de datos.
// Contrato: docs/specs/fase-1-nucleo-administrativo.md
//   FR-33..FR-42, NFR-R1, NFR-R3, AC-32..AC-37, AC-43, EC-6, EC-12, EC-14, EC-20.
//
// - Idempotente: los slots DISPONIBLE que siguen siendo válidos no se tocan.
// - Transaccional por profesional (NFR-R1 / AC-43): si falla uno, su estado queda intacto
//   y los demás siguen.
// - Lock lógico (NFR-R3 / EC-14): un índice único parcial permite una sola corrida
//   con `finalizadaAt IS NULL`. Una segunda corrida concurrente choca -> SALTADA.

import {
  Prisma,
  type DisparadorCorrida,
  type PrismaClient,
} from "@prisma/client";
import { db } from "@/lib/db";
import { PARAMETROS_DEFAULT } from "@/lib/parametros";
import { fechaHoraARaUTC, fechaISOaDateUTC, hoyEnAR, sumarDias, type DiaSemanaStr } from "@/lib/fechas";
import {
  calcularSlots,
  type ExcepcionCalc,
  type FranjaCalc,
} from "@/lib/slots/calcular";

export interface GenerarSlotsOpts {
  profesionalId?: string | null;
  disparador: DisparadorCorrida;
  actorId?: string | null;
  /** Fechas afectadas para regeneración incremental (acota la ventana a ese sub-rango). */
  fechasAfectadas?: string[];
  ahora?: Date;
}

export interface GenerarSlotsResultado {
  profesionales: number;
  creados: number;
  eliminados: number;
  sinCambios: number;
  franjasInconsistentesOmitidas: string[];
  corridaId: string;
  estado: "OK" | "SALTADA" | "ERROR";
}

const LOCK_STALE_MS = 30 * 60 * 1000;

export async function generarSlots(opts: GenerarSlotsOpts): Promise<GenerarSlotsResultado> {
  const ahora = opts.ahora ?? new Date();

  // Recuperación de lock colgado (proceso muerto que dejó finalizadaAt = null).
  const colgada = await db.corridaGeneracion.findFirst({
    where: { finalizadaAt: null, iniciadaAt: { lt: new Date(ahora.getTime() - LOCK_STALE_MS) } },
  });
  if (colgada) {
    await db.corridaGeneracion.update({
      where: { id: colgada.id },
      data: { finalizadaAt: ahora, estado: "ERROR", detalle: "Corrida colgada, cerrada por timeout." },
    });
  }

  // Adquirir el lock creando la fila de corrida (finalizadaAt = null).
  let corrida;
  try {
    corrida = await db.corridaGeneracion.create({
      data: {
        disparador: opts.disparador,
        actorId: opts.actorId ?? null,
        profesionalId: opts.profesionalId ?? null,
        estado: "OK",
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const saltada = await db.corridaGeneracion.create({
        data: {
          disparador: opts.disparador,
          actorId: opts.actorId ?? null,
          profesionalId: opts.profesionalId ?? null,
          estado: "SALTADA",
          detalle: "Saltada por solapamiento con otra corrida en curso.",
          finalizadaAt: ahora,
        },
      });
      return {
        profesionales: 0,
        creados: 0,
        eliminados: 0,
        sinCambios: 0,
        franjasInconsistentesOmitidas: [],
        corridaId: saltada.id,
        estado: "SALTADA",
      };
    }
    throw e;
  }

  try {
    const resultado = await ejecutarGeneracion(db, opts, ahora);
    await db.corridaGeneracion.update({
      where: { id: corrida.id },
      data: {
        creados: resultado.creados,
        eliminados: resultado.eliminados,
        sinCambios: resultado.sinCambios,
        estado: resultado.estado,
        detalle: resultado.detalle,
        finalizadaAt: new Date(),
      },
    });
    return {
      profesionales: resultado.profesionales,
      creados: resultado.creados,
      eliminados: resultado.eliminados,
      sinCambios: resultado.sinCambios,
      franjasInconsistentesOmitidas: resultado.franjasInconsistentesOmitidas,
      corridaId: corrida.id,
      estado: resultado.estado,
    };
  } catch (e) {
    await db.corridaGeneracion.update({
      where: { id: corrida.id },
      data: { estado: "ERROR", detalle: mensajeError(e), finalizadaAt: new Date() },
    });
    throw e;
  }
}

interface EjecucionResultado {
  profesionales: number;
  creados: number;
  eliminados: number;
  sinCambios: number;
  franjasInconsistentesOmitidas: string[];
  estado: "OK" | "ERROR";
  detalle: string | null;
}

async function ejecutarGeneracion(
  client: PrismaClient,
  opts: GenerarSlotsOpts,
  ahora: Date,
): Promise<EjecucionResultado> {
  const ventanaParam = await client.parametroSistema.findUnique({
    where: { clave: "ventana_generacion_dias" },
  });
  const ventana = ventanaParam?.valor ?? PARAMETROS_DEFAULT.ventana_generacion_dias;

  const hoy = hoyEnAR(ahora);
  const finVentana = sumarDias(hoy, ventana);

  const profesionales = await client.profesional.findMany({
    where: {
      activo: true,
      ...(opts.profesionalId ? { id: opts.profesionalId } : {}),
    },
    select: { id: true },
  });

  let creados = 0;
  let eliminados = 0;
  let sinCambios = 0;
  const inconsistentes = new Set<string>();
  const fallos: string[] = [];

  for (const { id: profesionalId } of profesionales) {
    try {
      const r = await generarUnProfesional(client, profesionalId, hoy, finVentana, opts.fechasAfectadas);
      creados += r.creados;
      eliminados += r.eliminados;
      sinCambios += r.sinCambios;
      r.inconsistentes.forEach((f) => inconsistentes.add(f));
    } catch (e) {
      fallos.push(`${profesionalId}: ${mensajeError(e)}`);
    }
  }

  return {
    profesionales: profesionales.length,
    creados,
    eliminados,
    sinCambios,
    franjasInconsistentesOmitidas: [...inconsistentes],
    estado: fallos.length ? "ERROR" : "OK",
    detalle: fallos.length ? `Fallaron ${fallos.length} profesionales: ${fallos.join("; ")}` : null,
  };
}

interface ProfResultado {
  creados: number;
  eliminados: number;
  sinCambios: number;
  inconsistentes: string[];
}

async function generarUnProfesional(
  client: PrismaClient,
  profesionalId: string,
  desde: string,
  hasta: string,
  fechasAfectadas?: string[],
): Promise<ProfResultado> {
  const franjasDB = await client.franjaAgenda.findMany({
    where: { profesionalId, activa: true },
    include: { especialidad: { select: { id: true, activa: true, duracionTurnoMin: true } } },
  });
  const excepcionesDB = await client.excepcionAgenda.findMany({
    where: {
      profesionalId,
      fecha: { gte: fechaISOaDateUTC(desde), lte: fechaISOaDateUTC(hasta) },
    },
    include: { especialidad: { select: { id: true, activa: true, duracionTurnoMin: true } } },
  });

  const duracionPorEspecialidad: Record<string, number> = {};
  const inconsistentes: string[] = [];

  const franjas: FranjaCalc[] = [];
  for (const f of franjasDB) {
    if (f.inconsistente) {
      inconsistentes.push(f.id);
      continue;
    }
    if (!f.especialidad.activa) continue; // FR-41
    duracionPorEspecialidad[f.especialidadId] = f.especialidad.duracionTurnoMin;
    franjas.push({
      id: f.id,
      profesionalId: f.profesionalId,
      diaSemana: f.diaSemana as DiaSemanaStr,
      horaInicio: f.horaInicio,
      horaFin: f.horaFin,
      especialidadId: f.especialidadId,
      salaId: f.salaId,
      vigenciaDesde: f.vigenciaDesde.toISOString().slice(0, 10),
      vigenciaHasta: f.vigenciaHasta ? f.vigenciaHasta.toISOString().slice(0, 10) : null,
      activa: f.activa,
      inconsistente: f.inconsistente,
    });
  }

  const excepciones: ExcepcionCalc[] = [];
  for (const e of excepcionesDB) {
    if (e.tipo === "APERTURA") {
      if (!e.especialidad?.activa) continue;
      if (e.especialidadId) duracionPorEspecialidad[e.especialidadId] = e.especialidad!.duracionTurnoMin;
    }
    excepciones.push({
      id: e.id,
      profesionalId: e.profesionalId,
      fecha: e.fecha.toISOString().slice(0, 10),
      tipo: e.tipo,
      horaInicio: e.horaInicio,
      horaFin: e.horaFin,
      especialidadId: e.especialidadId,
      salaId: e.salaId,
    });
  }

  const deseadosArr = calcularSlots({
    profesionalId,
    franjas,
    excepciones,
    duracionPorEspecialidad,
    desde,
    hasta,
  }).filter((s) => (fechasAfectadas ? fechasAfectadas.includes(s.fecha) : true));

  return client.$transaction(async (tx) => {
    // Ventana efectiva para el borrado: incremental acota a las fechas afectadas.
    const fechaFiltro = fechasAfectadas?.length
      ? { in: fechasAfectadas.map(fechaISOaDateUTC) }
      : undefined;

    const existentes = await tx.slot.findMany({
      where: {
        profesionalId,
        ...(fechaFiltro ? { fecha: fechaFiltro } : {}),
      },
    });

    const clave = (fecha: string, hora: string) => `${fecha}|${hora}`;
    const deseados = new Map(deseadosArr.map((s) => [clave(s.fecha, s.horaInicio), s]));

    let creados = 0;
    let eliminados = 0;
    let sinCambios = 0;
    const aEliminar: string[] = [];
    const aHuerfano: string[] = [];
    const quitarHuerfano: string[] = [];

    for (const slot of existentes) {
      const fechaISO = slot.fecha.toISOString().slice(0, 10);
      const enVentana = fechaISO >= desde && fechaISO <= hasta;
      const k = clave(fechaISO, slot.horaInicio);
      const esperado = deseados.get(k);

      if (slot.estado === "DISPONIBLE") {
        if (esperado && enVentana) {
          deseados.delete(k);
          sinCambios += 1;
        } else {
          aEliminar.push(slot.id); // ya no corresponde, o quedó fuera de ventana (EC-12) / en el pasado (FR-41)
        }
      } else {
        // Slot ocupado/bloqueado (Fase 2/3): nunca se borra.
        if (esperado) {
          deseados.delete(k);
          sinCambios += 1;
          if (slot.huerfano) quitarHuerfano.push(slot.id);
        } else if (!slot.huerfano) {
          aHuerfano.push(slot.id); // FR-28 / AC-29
        }
      }
    }

    if (aEliminar.length) {
      const del = await tx.slot.deleteMany({ where: { id: { in: aEliminar }, estado: "DISPONIBLE" } });
      eliminados += del.count;
    }
    if (aHuerfano.length) {
      await tx.slot.updateMany({ where: { id: { in: aHuerfano } }, data: { huerfano: true } });
    }
    if (quitarHuerfano.length) {
      await tx.slot.updateMany({ where: { id: { in: quitarHuerfano } }, data: { huerfano: false } });
    }

    const nuevos = [...deseados.values()].filter((s) => s.fecha >= desde && s.fecha <= hasta);
    if (nuevos.length) {
      const res = await tx.slot.createMany({
        data: nuevos.map((s) => ({
          profesionalId: s.profesionalId,
          especialidadId: s.especialidadId,
          salaId: s.salaId,
          fecha: fechaISOaDateUTC(s.fecha),
          horaInicio: s.horaInicio,
          horaFin: s.horaFin,
          inicioUtc: fechaHoraARaUTC(s.fecha, s.horaInicio),
          finUtc: fechaHoraARaUTC(s.fecha, s.horaFin),
          estado: "DISPONIBLE" as const,
          origen: s.origen,
          origenId: s.origenId,
        })),
        skipDuplicates: true, // AC-35: colisión de unicidad = "sin cambios", no error
      });
      creados += res.count;
      sinCambios += nuevos.length - res.count;
    }

    return { creados, eliminados, sinCambios, inconsistentes };
  });
}

function mensajeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
