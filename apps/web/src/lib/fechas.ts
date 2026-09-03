// Utilidades de fecha/hora para el turnero.
// Contrato: docs/specs/fase-1-nucleo-administrativo.md (NFR-R4, EC-13).
//
// Argentina usa UTC-3 todo el año (no aplica horario de verano — EC-13).
// Trabajamos con un offset fijo para no depender de la variable de entorno TZ
// del proceso ni de la base de datos de zonas horarias del runtime.

/** Offset de America/Argentina/Buenos_Aires respecto de UTC, en minutos. */
export const AR_OFFSET_MIN = -180;

export const DIAS_SEMANA = [
  "DOMINGO",
  "LUNES",
  "MARTES",
  "MIERCOLES",
  "JUEVES",
  "VIERNES",
  "SABADO",
] as const;

export type DiaSemanaStr = (typeof DIAS_SEMANA)[number];

const RE_HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** "HH:MM" -> minutos desde la medianoche. Lanza si el formato es inválido. */
export function horaAMinutos(hhmm: string): number {
  const m = RE_HORA.exec(hhmm);
  if (!m) throw new Error(`Hora inválida: ${hhmm}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** minutos desde la medianoche -> "HH:MM" (24h, con ceros). */
export function minutosAHora(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function esHoraValida(hhmm: string): boolean {
  return RE_HORA.test(hhmm);
}

export function esFechaISOValida(s: string): boolean {
  if (!RE_FECHA.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** "YYYY-MM-DD" -> Date a medianoche UTC (para columnas @db.Date). */
export function fechaISOaDateUTC(s: string): Date {
  if (!esFechaISOValida(s)) throw new Error(`Fecha inválida: ${s}`);
  return new Date(`${s}T00:00:00.000Z`);
}

/** Date -> "YYYY-MM-DD" leyendo los componentes UTC (las columnas @db.Date se guardan a medianoche UTC). */
export function dateUTCaFechaISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Día de la semana de una fecha "YYYY-MM-DD" en el calendario local (equivale al UTC porque es una fecha sin hora). */
export function diaSemanaDeFecha(fechaISO: string): DiaSemanaStr {
  const d = fechaISOaDateUTC(fechaISO);
  return DIAS_SEMANA[d.getUTCDay()];
}

/** Suma días a una fecha "YYYY-MM-DD" y devuelve otra "YYYY-MM-DD". */
export function sumarDias(fechaISO: string, dias: number): string {
  const d = fechaISOaDateUTC(fechaISO);
  d.setUTCDate(d.getUTCDate() + dias);
  return dateUTCaFechaISO(d);
}

/** Lista inclusiva de fechas "YYYY-MM-DD" entre desde y hasta. */
export function rangoDeFechas(desdeISO: string, hastaISO: string): string[] {
  const out: string[] = [];
  let cur = desdeISO;
  while (cur <= hastaISO) {
    out.push(cur);
    cur = sumarDias(cur, 1);
  }
  return out;
}

/**
 * Combina una fecha local "YYYY-MM-DD" y una hora local "HH:MM" de Argentina
 * en el instante UTC correspondiente.
 */
export function fechaHoraARaUTC(fechaISO: string, hhmm: string): Date {
  const min = horaAMinutos(hhmm);
  const base = new Date(`${fechaISO}T00:00:00.000Z`).getTime();
  // Hora local AR = UTC + AR_OFFSET_MIN  =>  UTC = local - AR_OFFSET_MIN
  return new Date(base + (min - AR_OFFSET_MIN) * 60_000);
}

/** "YYYY-MM-DD" de hoy en hora de Argentina. */
export function hoyEnAR(ahora: Date = new Date()): string {
  const local = new Date(ahora.getTime() + AR_OFFSET_MIN * 60_000);
  return local.toISOString().slice(0, 10);
}
