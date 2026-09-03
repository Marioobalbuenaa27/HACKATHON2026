// Cálculo puro de slots — función testeable sin base de datos.
// Contrato: docs/specs/fase-1-nucleo-administrativo.md (NFR-M2, FR-34, FR-35, AC-44, AC-32, AC-33).
//
// Dado un conjunto de franjas + excepciones + rango de fechas + duración de turno
// por especialidad, devuelve la lista de slots que deberían existir. No toca la DB,
// no conoce estados de slot, no ordena por prioridad: solo geometría de agenda.

import {
  diaSemanaDeFecha,
  horaAMinutos,
  minutosAHora,
  rangoDeFechas,
  type DiaSemanaStr,
} from "@/lib/fechas";

export type OrigenSlot = "FRANJA" | "APERTURA";
export type TipoExcepcion = "BLOQUEO" | "APERTURA";

export interface FranjaCalc {
  id: string;
  profesionalId: string;
  diaSemana: DiaSemanaStr;
  horaInicio: string; // "HH:MM"
  horaFin: string; // "HH:MM"
  especialidadId: string;
  salaId: string;
  vigenciaDesde: string; // "YYYY-MM-DD"
  vigenciaHasta: string | null; // "YYYY-MM-DD" | null
  activa: boolean;
  inconsistente: boolean;
}

export interface ExcepcionCalc {
  id: string;
  profesionalId: string;
  fecha: string; // "YYYY-MM-DD"
  tipo: TipoExcepcion;
  horaInicio: string | null;
  horaFin: string | null;
  especialidadId: string | null;
  salaId: string | null;
}

export interface SlotCalculado {
  profesionalId: string;
  especialidadId: string;
  salaId: string;
  fecha: string; // "YYYY-MM-DD"
  horaInicio: string; // "HH:MM"
  horaFin: string; // "HH:MM"
  origen: OrigenSlot;
  origenId: string;
}

export interface EntradaCalculo {
  profesionalId: string;
  franjas: FranjaCalc[];
  excepciones: ExcepcionCalc[];
  /** especialidadId -> duración de turno en minutos (múltiplo de 5, 5..120). */
  duracionPorEspecialidad: Record<string, number>;
  desde: string; // "YYYY-MM-DD" inclusive
  hasta: string; // "YYYY-MM-DD" inclusive
}

interface Tramo {
  inicio: number; // minutos desde medianoche
  fin: number;
  especialidadId: string;
  salaId: string;
  origen: OrigenSlot;
  origenId: string;
}

/** Resta el intervalo [b0, b1) de un tramo; devuelve 0, 1 o 2 tramos resultantes. */
function restarIntervalo(t: Tramo, b0: number, b1: number): Tramo[] {
  if (b1 <= t.inicio || b0 >= t.fin) return [t]; // sin intersección
  const out: Tramo[] = [];
  if (b0 > t.inicio) out.push({ ...t, fin: b0 });
  if (b1 < t.fin) out.push({ ...t, inicio: b1 });
  return out;
}

export function calcularSlots(entrada: EntradaCalculo): SlotCalculado[] {
  const { profesionalId, franjas, excepciones, duracionPorEspecialidad } = entrada;
  const resultado: SlotCalculado[] = [];

  const franjasValidas = franjas.filter(
    (f) => f.profesionalId === profesionalId && f.activa && !f.inconsistente,
  );
  const excepcionesProf = excepciones.filter((e) => e.profesionalId === profesionalId);

  for (const fecha of rangoDeFechas(entrada.desde, entrada.hasta)) {
    const dia = diaSemanaDeFecha(fecha);
    const excDia = excepcionesProf.filter((e) => e.fecha === fecha);

    const bloqueoTotal = excDia.some(
      (e) => e.tipo === "BLOQUEO" && (e.horaInicio == null || e.horaFin == null),
    );
    if (bloqueoTotal) continue;

    let tramos: Tramo[] = [];

    // Franjas recurrentes vigentes ese día.
    for (const f of franjasValidas) {
      if (f.diaSemana !== dia) continue;
      if (fecha < f.vigenciaDesde) continue;
      if (f.vigenciaHasta != null && fecha > f.vigenciaHasta) continue;
      tramos.push({
        inicio: horaAMinutos(f.horaInicio),
        fin: horaAMinutos(f.horaFin),
        especialidadId: f.especialidadId,
        salaId: f.salaId,
        origen: "FRANJA",
        origenId: f.id,
      });
    }

    // Aperturas de esa fecha.
    for (const e of excDia) {
      if (e.tipo !== "APERTURA") continue;
      if (e.horaInicio == null || e.horaFin == null || e.especialidadId == null || e.salaId == null) {
        continue;
      }
      tramos.push({
        inicio: horaAMinutos(e.horaInicio),
        fin: horaAMinutos(e.horaFin),
        especialidadId: e.especialidadId,
        salaId: e.salaId,
        origen: "APERTURA",
        origenId: e.id,
      });
    }

    // Bloqueos parciales de esa fecha: se restan de todos los tramos.
    for (const e of excDia) {
      if (e.tipo !== "BLOQUEO" || e.horaInicio == null || e.horaFin == null) continue;
      const b0 = horaAMinutos(e.horaInicio);
      const b1 = horaAMinutos(e.horaFin);
      tramos = tramos.flatMap((t) => restarIntervalo(t, b0, b1));
    }

    // Partir en slots; dedupe por hora de inicio (FR-37).
    tramos.sort((a, b) => a.inicio - b.inicio || a.fin - b.fin);
    const usados = new Set<number>();
    for (const t of tramos) {
      const dur = duracionPorEspecialidad[t.especialidadId];
      if (!dur || dur <= 0) continue;
      for (let s = t.inicio; s + dur <= t.fin; s += dur) {
        if (usados.has(s)) continue;
        usados.add(s);
        resultado.push({
          profesionalId,
          especialidadId: t.especialidadId,
          salaId: t.salaId,
          fecha,
          horaInicio: minutosAHora(s),
          horaFin: minutosAHora(s + dur),
          origen: t.origen,
          origenId: t.origenId,
        });
      }
    }
  }

  return resultado;
}
