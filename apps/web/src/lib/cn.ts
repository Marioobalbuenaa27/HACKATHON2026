// Une clases condicionales. Sin dependencias: no resuelve conflictos de Tailwind,
// sólo filtra falsy y junta con espacios.
export function cn(...partes: Array<string | false | null | undefined>): string {
  return partes.filter(Boolean).join(" ");
}
