// Parámetros del sistema — claves fijas y valores por defecto.
// Contrato: docs/specs/fase-1-nucleo-administrativo.md (FR-43).

export const PARAMETROS_DEFAULT = {
  ventana_reserva_dias: 30,
  antelacion_minima_horas: 2,
  reserva_temporal_minutos: 7,
  ventana_generacion_dias: 45,
  retencion_datos_meses: 12,
  tope_sobreturnos_por_profesional_dia: 2,
  ventana_desplazamiento_horas: 24,
} as const;

export type ClaveParametro = keyof typeof PARAMETROS_DEFAULT;

// Rangos válidos (FR-43 / AC-39). ventana_generacion_dias >= ventana_reserva_dias
// se valida aparte en la capa de aplicación.
export const PARAMETROS_RANGO: Record<ClaveParametro, { min: number; max: number }> = {
  ventana_reserva_dias: { min: 1, max: 90 },
  antelacion_minima_horas: { min: 0, max: 72 },
  reserva_temporal_minutos: { min: 1, max: 30 },
  ventana_generacion_dias: { min: 7, max: 120 },
  retencion_datos_meses: { min: 1, max: 120 },
  tope_sobreturnos_por_profesional_dia: { min: 0, max: 10 },
  ventana_desplazamiento_horas: { min: 0, max: 168 },
};
