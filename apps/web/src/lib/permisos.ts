// Matriz rol → sección del panel, derivada de la spec (§ API Contracts → "Matriz de
// autorización"). Es SOLO para ocultar/mostrar UI; la autorización real la impone la
// API en cada endpoint (NFR-S7).

import type { Rol } from "@/lib/http/tipos";

export type Seccion =
  | "dashboard"
  | "usuarios"
  | "especialidades"
  | "profesionales"
  | "categorias"
  | "salas"
  | "obras-sociales"
  | "franjas"
  | "excepciones"
  | "slots"
  | "parametros"
  | "auditoria";

const TODOS: Rol[] = ["ADMIN", "COORDINACION", "RECEPCION", "PROFESIONAL"];

interface ReglaSeccion {
  ver: Rol[];
  editar: Rol[];
}

const REGLAS: Record<Seccion, ReglaSeccion> = {
  dashboard: { ver: TODOS, editar: [] },
  usuarios: { ver: ["ADMIN"], editar: ["ADMIN"] },
  especialidades: { ver: TODOS, editar: ["ADMIN"] },
  profesionales: { ver: TODOS, editar: ["ADMIN", "COORDINACION"] },
  categorias: { ver: TODOS, editar: ["ADMIN"] },
  salas: { ver: TODOS, editar: ["ADMIN", "COORDINACION"] },
  "obras-sociales": { ver: TODOS, editar: ["ADMIN"] },
  franjas: { ver: TODOS, editar: ["ADMIN", "COORDINACION"] },
  excepciones: { ver: TODOS, editar: ["ADMIN", "COORDINACION"] },
  slots: { ver: TODOS, editar: ["ADMIN", "COORDINACION"] },
  parametros: { ver: ["ADMIN", "COORDINACION"], editar: ["ADMIN"] },
  auditoria: { ver: ["ADMIN", "COORDINACION"], editar: [] },
};

export function puedeVer(rol: Rol, seccion: Seccion): boolean {
  return REGLAS[seccion].ver.includes(rol);
}

export function puedeEditar(rol: Rol, seccion: Seccion): boolean {
  return REGLAS[seccion].editar.includes(rol);
}
