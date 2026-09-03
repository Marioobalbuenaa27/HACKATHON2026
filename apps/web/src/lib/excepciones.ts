// Vista y validación compartida del ABM de excepciones de agenda (FR-29..FR-31).

import { db } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { diaSemanaDeFecha, horaAMinutos } from "@/lib/fechas";
import { rangosHorariosIntersectan } from "@/lib/agenda";

export interface ExcepcionVista {
  id: string;
  profesionalId: string;
  fecha: string;
  tipo: string;
  horaInicio: string | null;
  horaFin: string | null;
  especialidadId: string | null;
  salaId: string | null;
  motivo: string;
}

export function vistaExcepcion(e: {
  id: string;
  profesionalId: string;
  fecha: Date;
  tipo: string;
  horaInicio: string | null;
  horaFin: string | null;
  especialidadId: string | null;
  salaId: string | null;
  motivo: string;
}): ExcepcionVista {
  return {
    id: e.id,
    profesionalId: e.profesionalId,
    fecha: e.fecha.toISOString().slice(0, 10),
    tipo: e.tipo,
    horaInicio: e.horaInicio,
    horaFin: e.horaFin,
    especialidadId: e.especialidadId,
    salaId: e.salaId,
    motivo: e.motivo,
  };
}

export interface DatosExcepcion {
  profesionalId: string;
  fecha: string;
  tipo: "BLOQUEO" | "APERTURA";
  horaInicio: string | null;
  horaFin: string | null;
  especialidadId: string | null;
  salaId: string | null;
}

export async function validarExcepcion(d: DatosExcepcion, exceptoId?: string) {
  const prof = await db.profesional.findUnique({
    where: { id: d.profesionalId },
    include: { especialidades: { select: { especialidadId: true } } },
  });
  if (!prof || !prof.activo) {
    return jsonError(400, "VALIDACION", "Profesional inexistente o inactivo.", { profesionalId: ["Inválido."] });
  }

  if (d.tipo === "BLOQUEO") return null;

  // --- APERTURA ---
  if (!prof.especialidades.some((e) => e.especialidadId === d.especialidadId)) {
    return jsonError(400, "VALIDACION", "La especialidad no corresponde al profesional.", {
      especialidadId: ["Inválido."],
    });
  }
  const esp = await db.especialidad.findUnique({ where: { id: d.especialidadId! } });
  if (!esp || !esp.activa) {
    return jsonError(400, "VALIDACION", "Especialidad inexistente o inactiva.", { especialidadId: ["Inválido."] });
  }
  const sala = await db.sala.findUnique({ where: { id: d.salaId! } });
  if (!sala || !sala.activa) {
    return jsonError(400, "VALIDACION", "Sala inexistente o inactiva.", { salaId: ["Inválido."] });
  }

  // EC-7: duración de la apertura múltiplo de la duración de turno.
  const dur = horaAMinutos(d.horaFin!) - horaAMinutos(d.horaInicio!);
  if (dur % esp.duracionTurnoMin !== 0) {
    return jsonError(400, "VALIDACION", `El rango debe ser múltiplo de ${esp.duracionTurnoMin} minutos.`, {
      horaFin: [`Múltiplo de ${esp.duracionTurnoMin} min.`],
    });
  }

  // FR-31: no solapar con una franja recurrente vigente ese día.
  const dia = diaSemanaDeFecha(d.fecha);
  const franjas = await db.franjaAgenda.findMany({
    where: { profesionalId: d.profesionalId, diaSemana: dia as never, activa: true },
  });
  for (const f of franjas) {
    const desde = f.vigenciaDesde.toISOString().slice(0, 10);
    const hasta = f.vigenciaHasta ? f.vigenciaHasta.toISOString().slice(0, 10) : null;
    if (d.fecha >= desde && (hasta == null || d.fecha <= hasta)) {
      if (rangosHorariosIntersectan(d.horaInicio!, d.horaFin!, f.horaInicio, f.horaFin)) {
        return jsonError(409, "APERTURA_SOLAPADA", "La apertura se solapa con una franja vigente.", { franjaId: f.id });
      }
    }
  }

  // FR-31: ni con otra APERTURA de esa fecha.
  const fechaDate = new Date(`${d.fecha}T00:00:00.000Z`);
  const otras = await db.excepcionAgenda.findMany({
    where: {
      profesionalId: d.profesionalId,
      fecha: fechaDate,
      tipo: "APERTURA",
      ...(exceptoId ? { id: { not: exceptoId } } : {}),
    },
  });
  for (const o of otras) {
    if (o.horaInicio && o.horaFin && rangosHorariosIntersectan(d.horaInicio!, d.horaFin!, o.horaInicio, o.horaFin)) {
      return jsonError(409, "APERTURA_SOLAPADA", "Ya hay otra apertura en ese horario.", { excepcionId: o.id });
    }
  }
  return null;
}
