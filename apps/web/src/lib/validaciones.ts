// Schemas Zod de los Route Handlers de /api/admin.
// Contrato: docs/specs/fase-1-nucleo-administrativo.md (sección API Contracts).

import { z } from "zod";

const RE_HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export const zHora = z.string().regex(RE_HORA, "Debe tener formato HH:MM (24 h).");
export const zFecha = z
  .string()
  .regex(RE_FECHA, "Debe tener formato YYYY-MM-DD.")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "No es una fecha válida.");

export const zRol = z.enum(["ADMIN", "COORDINACION", "RECEPCION", "PROFESIONAL"]);
export const zPrioridadBase = z.enum(["NORMAL", "PREFERENCIAL", "PRIORITARIO"]);
export const zDiaSemana = z.enum([
  "LUNES",
  "MARTES",
  "MIERCOLES",
  "JUEVES",
  "VIERNES",
  "SABADO",
  "DOMINGO",
]);
export const zTipoExcepcion = z.enum(["BLOQUEO", "APERTURA"]);

// --- Auth ---
export const loginSchema = z.object({
  email: z.string().email("Email inválido."),
  password: z.string().min(1).max(128),
});

// --- Usuarios ---
export const crearUsuarioSchema = z.object({
  nombre: z.string().trim().min(1).max(120),
  email: z.string().email("Email inválido."),
  rol: zRol,
});
export const editarUsuarioSchema = z
  .object({
    nombre: z.string().trim().min(1).max(120),
    rol: zRol,
    activo: z.boolean(),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, "Nada para actualizar.");

// --- Especialidades ---
const duracionTurno = z
  .number()
  .int()
  .min(5, "Mínimo 5 minutos.")
  .max(120, "Máximo 120 minutos.")
  .refine((n) => n % 5 === 0, "Debe ser múltiplo de 5.");

export const crearEspecialidadSchema = z.object({
  nombre: z.string().trim().min(1).max(120),
  duracionTurnoMin: duracionTurno,
});
export const editarEspecialidadSchema = z
  .object({
    nombre: z.string().trim().min(1).max(120),
    duracionTurnoMin: duracionTurno,
    activa: z.boolean(),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, "Nada para actualizar.");

// --- Profesionales ---
export const crearProfesionalSchema = z.object({
  nombre: z.string().trim().min(1).max(120),
  apellido: z.string().trim().min(1).max(120),
  matricula: z.string().trim().min(1).max(60),
  especialidadIds: z.array(z.string().min(1)).min(1, "Se requiere al menos una especialidad."),
  usuarioId: z.string().min(1).nullish(),
});
export const editarProfesionalSchema = z
  .object({
    nombre: z.string().trim().min(1).max(120),
    apellido: z.string().trim().min(1).max(120),
    matricula: z.string().trim().min(1).max(60),
    especialidadIds: z.array(z.string().min(1)).min(1, "Se requiere al menos una especialidad."),
    usuarioId: z.string().min(1).nullable(),
    activo: z.boolean(),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, "Nada para actualizar.");

// --- Categorías ---
export const crearCategoriaSchema = z.object({
  nombre: z.string().trim().min(1).max(120),
  ayuda: z.string().trim().max(2000).nullish(),
  prioridadBase: zPrioridadBase,
  derivarAGuardia: z.boolean(),
  orden: z.number().int().optional(),
});
export const editarCategoriaSchema = z
  .object({
    nombre: z.string().trim().min(1).max(120),
    ayuda: z.string().trim().max(2000).nullable(),
    prioridadBase: zPrioridadBase,
    derivarAGuardia: z.boolean(),
    orden: z.number().int(),
    activa: z.boolean(),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, "Nada para actualizar.");

export const mapeoCategoriaSchema = z.array(
  z.object({
    especialidadId: z.string().min(1),
    nota: z.string().trim().max(280).nullish(),
  }),
);

// --- Salas ---
export const crearSalaSchema = z.object({
  identificador: z.string().trim().min(1).max(80),
  ubicacion: z.string().trim().max(200).nullish(),
});
export const editarSalaSchema = z
  .object({
    identificador: z.string().trim().min(1).max(80),
    ubicacion: z.string().trim().max(200).nullable(),
    activa: z.boolean(),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, "Nada para actualizar.");

// --- Obras sociales ---
export const crearObraSocialSchema = z.object({
  nombre: z.string().trim().min(1).max(120),
});
export const editarObraSocialSchema = z
  .object({
    nombre: z.string().trim().min(1).max(120),
    activa: z.boolean(),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, "Nada para actualizar.");

// --- Franjas ---
const franjaBase = z.object({
  profesionalId: z.string().min(1),
  diaSemana: zDiaSemana,
  horaInicio: zHora,
  horaFin: zHora,
  especialidadId: z.string().min(1),
  salaId: z.string().min(1),
  vigenciaDesde: zFecha,
  vigenciaHasta: zFecha.nullish(),
});
export const crearFranjaSchema = franjaBase.superRefine((f, ctx) => {
  if (f.horaFin <= f.horaInicio) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["horaFin"], message: "Debe ser posterior a la hora de inicio." });
  }
  if (f.horaInicio >= "24:00" || f.horaFin > "24:00") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["horaFin"], message: "La franja no puede cruzar la medianoche." });
  }
  if (f.vigenciaHasta && f.vigenciaHasta < f.vigenciaDesde) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["vigenciaHasta"], message: "No puede ser anterior a la vigencia desde." });
  }
});
export const editarFranjaSchema = franjaBase
  .partial()
  .extend({ activa: z.boolean().optional() })
  .refine((o) => Object.keys(o).length > 0, "Nada para actualizar.");

// --- Excepciones ---
export const crearExcepcionSchema = z
  .object({
    profesionalId: z.string().min(1),
    fecha: zFecha,
    tipo: zTipoExcepcion,
    horaInicio: zHora.nullish(),
    horaFin: zHora.nullish(),
    especialidadId: z.string().min(1).nullish(),
    salaId: z.string().min(1).nullish(),
    motivo: z.string().trim().min(1).max(280),
  })
  .superRefine((e, ctx) => {
    if (e.tipo === "APERTURA") {
      for (const campo of ["horaInicio", "horaFin", "especialidadId", "salaId"] as const) {
        if (e[campo] == null) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [campo], message: "Obligatorio en una apertura." });
        }
      }
    }
    if (e.tipo === "BLOQUEO" && (e.horaInicio == null) !== (e.horaFin == null)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["horaFin"], message: "Indicá inicio y fin, o ninguno (bloqueo total)." });
    }
    if (e.horaInicio != null && e.horaFin != null && e.horaFin <= e.horaInicio) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["horaFin"], message: "Debe ser posterior a la hora de inicio." });
    }
  });

// --- Slots ---
export const generarSlotsSchema = z.object({ profesionalId: z.string().min(1).optional() });

// --- Operación del día (Fase 2) ---
const personaSchema = z.object({
  nombre: z.string().trim().min(1).max(160), dni: z.string().regex(/^\d{7,9}$/),
});
export const crearTurnoSchema = z.object({
  slotId: z.string().min(1), categoriaId: z.string().min(1),
  paciente: personaSchema.extend({ fechaNacimiento: zFecha }),
  responsable: personaSchema.extend({ vinculo: z.string().trim().min(1).max(80), telefono: z.string().trim().max(32).optional(), email: z.string().email().optional() }),
});
export const cambiarEstadoTurnoSchema = z.object({ estado: z.enum(["PRESENTE", "AUSENTE", "ATENDIDO"]) });
export const crearDemandaSchema = z.object({
  categoriaId: z.string().min(1),
  profesionalId: z.string().min(1),
  especialidadId: z.string().min(1),
  salaId: z.string().min(1).optional(),
  prioridadConfirmada: z.enum(["NORMAL", "PREFERENCIAL", "PRIORITARIO", "URGENTE"]).optional(),
  motivoAjuste: z.string().trim().max(280).optional(),
  respuestas: z.record(z.string(), z.string().trim().min(1).max(500)),
  paciente: personaSchema.extend({ fechaNacimiento: zFecha }),
  responsable: personaSchema.extend({ vinculo: z.string().trim().min(1).max(80), telefono: z.string().trim().max(32).optional(), email: z.string().email().optional() }),
});
export const crearAusenciaSchema = z.object({ profesionalId: z.string().min(1), fecha: zFecha, motivo: z.string().trim().min(1).max(280) });
export const desplazarTurnoSchema = z.object({ slotDestinoId: z.string().min(1), motivo: z.string().trim().min(1).max(280) });
export const resolverCasoSchema = z.object({ slotDestinoId: z.string().min(1), motivo: z.string().trim().min(1).max(280) });

// --- Canal ciudadano (Fase 3) ---
export const reservarSlotSchema = z.object({
  slotId: z.string().min(1),
  categoriaId: z.string().min(1),
  paciente: personaSchema.extend({ fechaNacimiento: zFecha }),
  responsable: z.object({
    nombre: z.string().trim().min(1).max(160),
    dni: z.string().regex(/^\d{7,9}$/),
    vinculo: z.string().trim().min(1).max(80),
    telefono: z.string().trim().max(32).optional(),
    email: z.string().email().optional(),
  }),
  consentimientoVersion: z.string().trim().min(1).max(40),
});
export const confirmarReservaSchema = z.object({ token: z.string().min(20).max(200) });
export const consultarTurnoSchema = z.object({ dni: z.string().regex(/^\d{7,9}$/), fechaNacimiento: zFecha });

// --- Parámetros ---
export const PARAMETRO_RANGOS = {
  ventana_reserva_dias: [1, 90],
  antelacion_minima_horas: [0, 72],
  reserva_temporal_minutos: [1, 30],
  ventana_generacion_dias: [7, 120],
  retencion_datos_meses: [1, 120],
  tope_sobreturnos_por_profesional_dia: [0, 10],
} as const;

export const editarParametrosSchema = z
  .object(
    Object.fromEntries(
      Object.entries(PARAMETRO_RANGOS).map(([clave, [min, max]]) => [
        clave,
        z.number().int().min(min).max(max).optional(),
      ]),
    ) as Record<keyof typeof PARAMETRO_RANGOS, z.ZodOptional<z.ZodNumber>>,
  )
  .refine((o) => Object.values(o).some((v) => v !== undefined), "Nada para actualizar.");
