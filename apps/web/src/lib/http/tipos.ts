// Tipos del contrato de la API `/api/admin/**`, copiados de
// docs/specs/fase-1-nucleo-administrativo.md (§ API Contracts).
// Fuente única para toda la UI del panel.

export type Rol = "ADMIN" | "COORDINACION" | "RECEPCION" | "PROFESIONAL";
export type PrioridadBase = "NORMAL" | "PREFERENCIAL" | "PRIORITARIO";

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ApiErrorBody {
  error: string;
  message: string;
  details?: Record<string, string | string[]>;
}

export interface Perfil {
  usuarioId: string;
  nombre: string;
  email: string;
  rol: Rol;
  profesionalId: string | null;
}

// --- Catálogos ---

export interface Especialidad {
  id: string;
  nombre: string;
  duracionTurnoMin: number;
  activa: boolean;
}

export interface Profesional {
  id: string;
  nombre: string;
  apellido: string;
  matricula: string;
  especialidadIds: string[];
  usuarioId: string | null;
  activo: boolean;
}

export interface MapeoEspecialidad {
  especialidadId: string;
  nota: string | null;
}

export interface Categoria {
  id: string;
  nombre: string;
  ayuda: string | null;
  prioridadBase: PrioridadBase;
  derivarAGuardia: boolean;
  orden: number;
  activa: boolean;
  especialidades: MapeoEspecialidad[];
}

export interface Sala {
  id: string;
  identificador: string;
  ubicacion: string | null;
  activa: boolean;
}

export interface ObraSocial {
  id: string;
  nombre: string;
  activa: boolean;
}

export interface UsuarioListItem {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  profesionalId: string | null;
}

export interface CrearUsuarioResponse {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: true;
  passwordTemporal: string;
}

export interface ResetPasswordResponse {
  passwordTemporal: string;
}

export const ROLES: Rol[] = ["ADMIN", "COORDINACION", "RECEPCION", "PROFESIONAL"];

export const ETIQUETA_ROL: Record<Rol, string> = {
  ADMIN: "Administración / TI",
  COORDINACION: "Coordinación",
  RECEPCION: "Recepción / Admisión",
  PROFESIONAL: "Profesional",
};

export const ETIQUETA_PRIORIDAD: Record<PrioridadBase, string> = {
  NORMAL: "Normal (nivel 1)",
  PREFERENCIAL: "Preferencial (nivel 2)",
  PRIORITARIO: "Prioritario (nivel 3)",
};

// --- Agendas: franjas y excepciones ---

export type DiaSemana =
  | "LUNES"
  | "MARTES"
  | "MIERCOLES"
  | "JUEVES"
  | "VIERNES"
  | "SABADO"
  | "DOMINGO";

export const DIAS_SEMANA: DiaSemana[] = [
  "LUNES",
  "MARTES",
  "MIERCOLES",
  "JUEVES",
  "VIERNES",
  "SABADO",
  "DOMINGO",
];

export const ETIQUETA_DIA: Record<DiaSemana, string> = {
  LUNES: "Lunes",
  MARTES: "Martes",
  MIERCOLES: "Miércoles",
  JUEVES: "Jueves",
  VIERNES: "Viernes",
  SABADO: "Sábado",
  DOMINGO: "Domingo",
};

export interface FranjaAgenda {
  id: string;
  profesionalId: string;
  diaSemana: DiaSemana;
  horaInicio: string;
  horaFin: string;
  especialidadId: string;
  salaId: string;
  vigenciaDesde: string;
  vigenciaHasta: string | null;
  activa: boolean;
  inconsistente: boolean;
}

export type TipoExcepcion = "BLOQUEO" | "APERTURA";

export const ETIQUETA_TIPO_EXCEPCION: Record<TipoExcepcion, string> = {
  BLOQUEO: "Bloqueo",
  APERTURA: "Apertura",
};

export interface ExcepcionAgenda {
  id: string;
  profesionalId: string;
  fecha: string;
  tipo: TipoExcepcion;
  horaInicio: string | null;
  horaFin: string | null;
  especialidadId: string | null;
  salaId: string | null;
  motivo: string;
}

// --- Slots ---

export type EstadoSlot = "DISPONIBLE" | "BLOQUEADO";

export interface Slot {
  id: string;
  profesionalId: string;
  especialidadId: string;
  salaId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  inicioUtc: string;
  finUtc: string;
  estado: EstadoSlot;
  origen: "FRANJA" | "APERTURA";
  origenId: string;
  huerfano: boolean;
}

export interface GenerarSlotsResultado {
  profesionales: number;
  creados: number;
  eliminados: number;
  sinCambios: number;
  franjasInconsistentesOmitidas: string[];
  corridaId: string;
}

// --- Parámetros del sistema ---

export type ClaveParametro =
  | "ventana_reserva_dias"
  | "antelacion_minima_horas"
  | "reserva_temporal_minutos"
  | "ventana_generacion_dias"
  | "retencion_datos_meses";

export type Parametros = Record<ClaveParametro, number>;

export interface MetaParametro {
  clave: ClaveParametro;
  etiqueta: string;
  descripcion: string;
  unidad: string;
  min: number;
  max: number;
}

export const META_PARAMETROS: MetaParametro[] = [
  {
    clave: "ventana_reserva_dias",
    etiqueta: "Ventana de reserva",
    descripcion: "Con cuántos días de anticipación puede el ciudadano sacar un turno.",
    unidad: "días",
    min: 1,
    max: 90,
  },
  {
    clave: "antelacion_minima_horas",
    etiqueta: "Antelación mínima",
    descripcion: "Horas mínimas antes del turno para poder reservarlo online.",
    unidad: "horas",
    min: 0,
    max: 72,
  },
  {
    clave: "reserva_temporal_minutos",
    etiqueta: "Reserva temporal",
    descripcion: "Cuánto se retiene un slot mientras se completan los datos del turno.",
    unidad: "minutos",
    min: 1,
    max: 30,
  },
  {
    clave: "ventana_generacion_dias",
    etiqueta: "Ventana de generación",
    descripcion: "Cuántos días hacia adelante se generan slots. Debe ser ≥ la ventana de reserva.",
    unidad: "días",
    min: 7,
    max: 120,
  },
  {
    clave: "retencion_datos_meses",
    etiqueta: "Retención de datos",
    descripcion: "Meses que se conservan los datos personales de un turno antes de anonimizar.",
    unidad: "meses",
    min: 1,
    max: 120,
  },
];

// --- Auditoría ---

export interface RegistroAuditoria {
  id: string;
  actorId: string;
  actorNombre: string;
  accion: string;
  entidad: string;
  entidadId: string;
  motivo: string | null;
  antes: unknown;
  despues: unknown;
  timestamp: string;
}

export const ENTIDADES_AUDITABLES = [
  "usuario",
  "franja",
  "excepcion",
  "parametros",
] as const;
