"use client";

// Tabla ABM genérica: listado paginado + filtro de inactivas + alta/edición vía
// Dialog (render-prop) + activar/desactivar con confirmación. La instancian las 6
// secciones de catálogo.

import { useMemo, useState, type ReactNode } from "react";
import { DataTable, type Columna } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge } from "@/components/ui/Badge";
import { useLista, useMutacion } from "@/lib/http/hooks";
import { api } from "@/lib/http/cliente";

export interface FilaCrud {
  id: string;
}

export interface RenderFormArgs<T> {
  fila: T | null;
  onClose: () => void;
}

interface CrudTablaProps<T extends FilaCrud> {
  basePath: string;
  /** Nombre del campo booleano de estado en la entidad. */
  campoActivo: "activa" | "activo";
  /** Nombre del query param para incluir inactivas. */
  paramInactivas: "incluirInactivas" | "incluirInactivos";
  columnas: Columna<T>[];
  puedeEditar: boolean;
  entidadSingular: string;
  entidadPlural?: string;
  entidadFemenina?: boolean;
  nombreDe: (fila: T) => string;
  renderForm: (args: RenderFormArgs<T>) => ReactNode;
  /** Acciones extra por fila (ej. "Restablecer contraseña"). */
  accionesExtra?: (fila: T) => ReactNode;
  /** Query string extra ya formateada, sin `?` ni `&` inicial. */
  queryExtra?: string;
  /** Oculta el interruptor de activar/desactivar (ej. usuarios lo hacen desde el form). */
  sinToggleActivo?: boolean;
  vacioDescripcion?: string;
}

export function CrudTabla<T extends FilaCrud>({
  basePath,
  campoActivo,
  paramInactivas,
  columnas,
  puedeEditar,
  entidadSingular,
  entidadPlural,
  entidadFemenina = true,
  nombreDe,
  renderForm,
  accionesExtra,
  queryExtra,
  sinToggleActivo = false,
  vacioDescripcion,
}: CrudTablaProps<T>) {
  const [page, setPage] = useState(1);
  const [incluirInactivas, setIncluirInactivas] = useState(false);
  const [formAbierto, setFormAbierto] = useState(false);
  const [filaEnEdicion, setFilaEnEdicion] = useState<T | null>(null);
  const [filaToggle, setFilaToggle] = useState<T | null>(null);

  const key = useMemo(() => {
    const sp = new URLSearchParams({ page: String(page), pageSize: "25" });
    if (incluirInactivas) sp.set(paramInactivas, "true");
    if (queryExtra) for (const [k, v] of new URLSearchParams(queryExtra)) sp.set(k, v);
    return `${basePath}?${sp.toString()}`;
  }, [basePath, page, incluirInactivas, paramInactivas, queryExtra]);

  const { items, total, pageSize, isLoading } = useLista<T>(key);

  const toggleMut = useMutacion(
    (fila: T, activar: boolean) =>
      api.patch(`${basePath}/${fila.id}`, { [campoActivo]: activar }),
    {
      invalida: [basePath],
      exito: (_r, fila, activar) =>
        `«${nombreDe(fila)}» ${activar ? (entidadFemenina ? "activada" : "activado") : entidadFemenina ? "desactivada" : "desactivado"}.`,
    },
  );

  const activoDe = (fila: T) => (fila as Record<string, unknown>)[campoActivo] === true;
  const plural = entidadPlural ?? `${entidadSingular}s`;

  const abrirAlta = () => {
    setFilaEnEdicion(null);
    setFormAbierto(true);
  };
  const abrirEdicion = (fila: T) => {
    setFilaEnEdicion(fila);
    setFormAbierto(true);
  };
  const cerrarForm = () => setFormAbierto(false);

  const columnasConAcciones: Columna<T>[] = [
    ...columnas,
    {
      clave: "_estado",
      encabezado: "Estado",
      celda: (f) =>
        activoDe(f) ? (
          <Badge tono="exito">Activa</Badge>
        ) : (
          <Badge tono="neutral">Inactiva</Badge>
        ),
    },
    {
      clave: "_acciones",
      encabezado: "Acciones",
      finLinea: true,
      celda: (f) => (
        <div className="flex justify-end gap-space-2xs">
          {accionesExtra?.(f)}
          {puedeEditar && (
            <>
              <Button
                variante="text"
                icono="edit"
                className="px-space-xs"
                onClick={() => abrirEdicion(f)}
                aria-label={`Editar ${nombreDe(f)}`}
              >
                Editar
              </Button>
              {!sinToggleActivo && (
                <Button
                  variante="text"
                  className="px-space-xs"
                  icono={activoDe(f) ? "block" : "check_circle"}
                  onClick={() => setFilaToggle(f)}
                  aria-label={`${activoDe(f) ? "Desactivar" : "Activar"} ${nombreDe(f)}`}
                >
                  {activoDe(f) ? "Desactivar" : "Activar"}
                </Button>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-space-sm">
      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <Checkbox
          label="Incluir inactivas"
          checked={incluirInactivas}
          onChange={(e) => {
            setIncluirInactivas(e.currentTarget.checked);
            setPage(1);
          }}
        />
        {puedeEditar && (
          <Button icono="add" onClick={abrirAlta}>
            {entidadFemenina ? "Nueva" : "Nuevo"} {entidadSingular}
          </Button>
        )}
      </div>

      <DataTable
        columnas={columnasConAcciones}
        filas={items}
        idDe={(f) => f.id}
        cargando={isLoading}
        filaInactiva={(f) => !activoDe(f)}
        vacio={{
          titulo: `Sin ${plural}`,
          descripcion:
            vacioDescripcion ??
            (puedeEditar
              ? `Todavía no cargaste ${entidadFemenina ? "ninguna" : "ningún"} ${entidadSingular}.`
              : `No hay ${plural} para mostrar.`),
          icono: "folder_open",
        }}
      />

      <Pagination page={page} pageSize={pageSize} total={total} onPage={setPage} />

      {formAbierto && renderForm({ fila: filaEnEdicion, onClose: cerrarForm })}

      {filaToggle && (
        <ConfirmDialog
          abierto
          onClose={() => setFilaToggle(null)}
          titulo={`${activoDe(filaToggle) ? "Desactivar" : "Activar"} ${entidadSingular}`}
          mensaje={
            activoDe(filaToggle)
              ? `"${nombreDe(filaToggle)}" dejará de aparecer en los listados y no podrá usarse en nuevas agendas. Podés reactivarla después.`
              : `"${nombreDe(filaToggle)}" volverá a estar disponible.`
          }
          peligroso={activoDe(filaToggle)}
          textoConfirmar={activoDe(filaToggle) ? "Desactivar" : "Activar"}
          onConfirmar={() => toggleMut.ejecutar(filaToggle, !activoDe(filaToggle))}
        />
      )}
    </div>
  );
}
