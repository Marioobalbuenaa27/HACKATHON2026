import type { Seccion } from "@/lib/permisos";

export interface ItemNav {
  seccion: Seccion;
  href: string;
  label: string;
  icono: string;
  /** Grupo para agrupar en la barra lateral. */
  grupo: "General" | "Catálogos" | "Administración";
}

export const NAV: ItemNav[] = [
  { seccion: "dashboard", href: "/admin", label: "Inicio", icono: "dashboard", grupo: "General" },
  {
    seccion: "especialidades",
    href: "/admin/especialidades",
    label: "Especialidades",
    icono: "cardiology",
    grupo: "Catálogos",
  },
  {
    seccion: "profesionales",
    href: "/admin/profesionales",
    label: "Profesionales",
    icono: "stethoscope",
    grupo: "Catálogos",
  },
  {
    seccion: "categorias",
    href: "/admin/categorias",
    label: "Categorías de problema",
    icono: "format_list_bulleted",
    grupo: "Catálogos",
  },
  {
    seccion: "salas",
    href: "/admin/salas",
    label: "Salas / consultorios",
    icono: "meeting_room",
    grupo: "Catálogos",
  },
  {
    seccion: "obras-sociales",
    href: "/admin/obras-sociales",
    label: "Obras sociales",
    icono: "shield_with_heart",
    grupo: "Catálogos",
  },
  {
    seccion: "usuarios",
    href: "/admin/usuarios",
    label: "Usuarios del panel",
    icono: "group",
    grupo: "Administración",
  },
];
