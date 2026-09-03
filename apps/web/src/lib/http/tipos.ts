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
