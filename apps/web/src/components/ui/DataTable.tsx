import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { EmptyState } from "./EmptyState";

export interface Columna<T> {
  clave: string;
  encabezado: string;
  celda: (fila: T) => ReactNode;
  /** Alinear a la derecha (números, acciones). */
  finLinea?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  columnas: Columna<T>[];
  filas: T[];
  idDe: (fila: T) => string;
  cargando?: boolean;
  vacio?: { titulo: string; descripcion?: string; icono?: string };
  filaInactiva?: (fila: T) => boolean;
}

export function DataTable<T>({
  columnas,
  filas,
  idDe,
  cargando = false,
  vacio,
  filaInactiva,
}: DataTableProps<T>) {
  if (!cargando && filas.length === 0 && vacio) {
    return <EmptyState {...vacio} />;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest">
      <table className="w-full border-collapse text-left" aria-busy={cargando || undefined}>
        <thead>
          <tr className="border-b border-outline-variant">
            {columnas.map((c) => (
              <th
                key={c.clave}
                scope="col"
                className={cn(
                  "px-space-sm py-space-xs text-label-md text-on-surface-variant",
                  c.finLinea && "text-right",
                )}
              >
                {c.encabezado}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cargando && filas.length === 0 && (
            <tr>
              <td
                colSpan={columnas.length}
                className="px-space-sm py-space-lg text-center text-body-sm text-on-surface-variant"
              >
                Cargando…
              </td>
            </tr>
          )}
          {filas.map((fila) => (
            <tr
              key={idDe(fila)}
              className={cn(
                "border-b border-outline-variant/60 last:border-0 hover:bg-surface-container-low",
                filaInactiva?.(fila) && "opacity-55",
              )}
            >
              {columnas.map((c) => (
                <td
                  key={c.clave}
                  className={cn(
                    "px-space-sm py-space-xs text-body-md text-on-surface align-middle",
                    c.finLinea && "text-right",
                    c.className,
                  )}
                >
                  {c.celda(fila)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
