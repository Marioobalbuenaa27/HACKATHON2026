// Vista y validación compartida del ABM de franjas de agenda (FR-25..FR-27).

import { db } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { horaAMinutos } from "@/lib/fechas";
import { rangosHorariosIntersectan, vigenciasIntersectan } from "@/lib/agenda";

export interface FranjaVista {
  id: string;
  profesionalId: string;
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
  especialidadId: string;
  salaId: string;
  vigenciaDesde: string;
  vigenciaHasta: string | null;
  activa: boolean;
  inconsistente: boolean;
}

export function vistaFranja(f: {
  id: string;
  profesionalId: string;
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
  especialidadId: string;
  salaId: string;
  vigenciaDesde: Date;
  vigenciaHasta: Date | null;
  activa: boolean;
  inconsistente: boolean;
}): FranjaVista {
  return {
    id: f.id,
    profesionalId: f.profesionalId,
    diaSemana: f.diaSemana,
    horaInicio: f.horaInicio,
    horaFin: f.horaFin,
    especialidadId: f.especialidadId,
    salaId: f.salaId,
    vigenciaDesde: f.vigenciaDesde.toISOString().slice(0, 10),
    vigenciaHasta: f.vigenciaHasta ? f.vigenciaHasta.toISOString().slice(0, 10) : null,
    activa: f.activa,
    inconsistente: f.inconsistente,
  };
}

export interface DatosFranja {
  profesionalId: string;
  especialidadId: string;
  salaId: string;
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
  vigenciaDesde: string;
  vigenciaHasta: string | null;
}

export async function validarFranja(d: DatosFranja, exceptoId?: string) {
  const prof = await db.profesional.findUnique({
    where: { id: d.profesionalId },
    include: { especialidades: { select: { especialidadId: true } } },
  });
  if (!prof || !prof.activo) {
    return jsonError(400, "VALIDACION", "Profesional inexistente o inactivo.", { profesionalId: ["Inválido."] });
  }
  if (!prof.especialidades.some((e) => e.especialidadId === d.especialidadId)) {
    return jsonError(400, "VALIDACION", "La especialidad no corresponde al profesional.", {
      especialidadId: ["No es una especialidad del profesional."],
    });
  }
  const esp = await db.especialidad.findUnique({ where: { id: d.especialidadId } });
  if (!esp || !esp.activa) {
    return jsonError(400, "VALIDACION", "Especialidad inexistente o inactiva.", { especialidadId: ["Inválido."] });
  }
  const sala = await db.sala.findUnique({ where: { id: d.salaId } });
  if (!sala || !sala.activa) {
    return jsonError(400, "VALIDACION", "Sala inexistente o inactiva.", { salaId: ["Inválido."] });
  }

  const dur = horaAMinutos(d.horaFin) - horaAMinutos(d.horaInicio);
  if (dur % esp.duracionTurnoMin !== 0) {
    return jsonError(400, "VALIDACION", `El rango debe ser múltiplo de ${esp.duracionTurnoMin} minutos.`, {
      horaFin: [`Múltiplo de ${esp.duracionTurnoMin} min.`],
    });
  }

  // FR-27: solapamiento con otra franja activa del mismo profesional.
  const candidatas = await db.franjaAgenda.findMany({
    where: {
      profesionalId: d.profesionalId,
      diaSemana: d.diaSemana as never,
      activa: true,
      ...(exceptoId ? { id: { not: exceptoId } } : {}),
    },
  });
  for (const c of candidatas) {
    const cDesde = c.vigenciaDesde.toISOString().slice(0, 10);
    const cHasta = c.vigenciaHasta ? c.vigenciaHasta.toISOString().slice(0, 10) : null;
    if (
      rangosHorariosIntersectan(d.horaInicio, d.horaFin, c.horaInicio, c.horaFin) &&
      vigenciasIntersectan(d.vigenciaDesde, d.vigenciaHasta, cDesde, cHasta)
    ) {
      return jsonError(409, "FRANJA_SOLAPADA", "Se solapa con otra franja del profesional.", { franjaId: c.id });
    }
  }
  return null;
}
