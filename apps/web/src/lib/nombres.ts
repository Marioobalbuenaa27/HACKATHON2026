// Normalización de nombres para unicidad case-insensitive (FR-24).
// La spec (Data Models) decide normalizar en la capa de aplicación en vez de usar
// la extensión citext de Postgres. Guardamos el valor tal como lo escribe el
// usuario y comparamos siempre sobre la forma normalizada.

// Marcas diacríticas combinantes U+0300..U+036F.
const RE_DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");

/** Forma canónica para comparar: minúsculas, sin acentos, espacios colapsados. */
export function normalizarNombre(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(RE_DIACRITICOS, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function nombresEquivalentes(a: string, b: string): boolean {
  return normalizarNombre(a) === normalizarNombre(b);
}
