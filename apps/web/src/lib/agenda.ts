// Helpers de agenda: validación de franjas/excepciones, detección de solapamiento
// y disparo de la regeneración incremental de slots (FR-25..FR-32, FR-39).

import { db } from "@/lib/db";
import {
  DIAS_SEMANA,
  diaSemanaDeFecha,
  hoyEnAR,
  horaAMinutos,
  rangoDeFechas,
  sumarDias,
  type DiaSemanaStr,
} from "@/lib/fechas";
import { PARAMETROS_DEFAULT } from "@/lib/parametros";
import { generarSlots } from "@/lib/slots/generar";

export function rangosHorariosIntersectan(aIni: string, aFin: string, bIni: string, bFin: string): boolean {
  return horaAMinutos(aIni) < horaAMinutos(bFin) && horaAMinutos(bIni) < horaAMinutos(aFin);
}

/** Intersección de dos períodos de vigencia [desde, hasta] con `hasta` opcional (= infinito). */
export function vigenciasIntersectan(
  aDesde: string,
  aHasta: string | null,
  bDesde: string,
  bHasta: string | null,
): boolean {
  const aFin = aHasta ?? "9999-12-31";
  const bFin = bHasta ?? "9999-12-31";
  return aDesde <= bFin && bDesde <= aFin;
}

export async function ventanaGeneracionDias(): Promise<number> {
  const p = await db.parametroSistema.findUnique({ where: { clave: "ventana_generacion_dias" } });
  return p?.valor ?? PARAMETROS_DEFAULT.ventana_generacion_dias;
}

/** Fechas dentro de [hoy, hoy+ventana] que caen en `diaSemana` y dentro de la vigencia. */
export async function fechasDeFranjaEnVentana(franja: {
  diaSemana: DiaSemanaStr | string;
  vigenciaDesde: Date;
  vigenciaHasta: Date | null;
}): Promise<string[]> {
  const hoy = hoyEnAR();
  const fin = sumarDias(hoy, await ventanaGeneracionDias());
  const desde = franja.vigenciaDesde.toISOString().slice(0, 10);
  const hasta = franja.vigenciaHasta ? franja.vigenciaHasta.toISOString().slice(0, 10) : null;
  return rangoDeFechas(hoy, fin).filter(
    (f) => diaSemanaDeFecha(f) === franja.diaSemana && f >= desde && (hasta == null || f <= hasta),
  );
}

export function nombreDiaSemana(d: number): DiaSemanaStr {
  return DIAS_SEMANA[d];
}

/** Dispara la regeneración incremental de un profesional para un conjunto de fechas. */
export async function regenerarIncremental(profesionalId: string, fechas: string[]): Promise<void> {
  if (fechas.length === 0) return;
  await generarSlots({
    profesionalId,
    disparador: "INCREMENTAL",
    fechasAfectadas: [...new Set(fechas)].sort(),
  });
}
