"use client";

// Edición de los parámetros del sistema (FR-43). Claves fijas; la API valida rangos
// y la relación ventana_generacion_dias >= ventana_reserva_dias.

import { useEffect, useState } from "react";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { api } from "@/lib/http/cliente";
import { useRecurso, useSubmit } from "@/lib/http/hooks";
import { META_PARAMETROS, type ClaveParametro, type Parametros } from "@/lib/http/tipos";

const BASE = "/api/admin/parametros";

export function ParametrosForm({ puedeEditar }: { puedeEditar: boolean }) {
  const { data, isLoading, error } = useRecurso<Parametros>(BASE);
  const [valores, setValores] = useState<Record<string, string>>({});

  useEffect(() => {
    if (data) {
      setValores(
        Object.fromEntries(META_PARAMETROS.map((m) => [m.clave, String(data[m.clave])])),
      );
    }
  }, [data]);

  const submit = useSubmit(
    () => {
      const cambios: Partial<Record<ClaveParametro, number>> = {};
      for (const m of META_PARAMETROS) {
        const n = Number(valores[m.clave]);
        if (data && Number.isFinite(n) && n !== data[m.clave]) cambios[m.clave] = n;
      }
      return api.patch(BASE, cambios);
    },
    { invalida: [BASE], exito: "Parámetros actualizados." },
  );

  if (error) {
    return (
      <EmptyState
        titulo="No se pudieron cargar los parámetros"
        descripcion={error.message}
        icono="error"
      />
    );
  }
  if (isLoading || !data) {
    return <p className="text-body-sm text-on-surface-variant">Cargando…</p>;
  }

  const genVsReserva =
    Number(valores.ventana_generacion_dias) < Number(valores.ventana_reserva_dias)
      ? "La ventana de generación no puede ser menor que la de reserva."
      : undefined;

  const sinCambios = META_PARAMETROS.every(
    (m) => Number(valores[m.clave]) === data[m.clave],
  );

  return (
    <form
      className="flex flex-col gap-space-md"
      onSubmit={async (e) => {
        e.preventDefault();
        await submit.run();
      }}
    >
      <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
        {META_PARAMETROS.map((m) => (
          <TextField
            key={m.clave}
            label={`${m.etiqueta} (${m.unidad})`}
            type="number"
            inputMode="numeric"
            min={m.min}
            max={m.max}
            disabled={!puedeEditar}
            value={valores[m.clave] ?? ""}
            onChange={(e) => setValores((v) => ({ ...v, [m.clave]: e.target.value }))}
            error={
              submit.campo(m.clave) ??
              (m.clave === "ventana_generacion_dias" ? genVsReserva : undefined)
            }
            hint={`${m.descripcion} Entre ${m.min} y ${m.max}.`}
          />
        ))}
      </div>

      {puedeEditar ? (
        <div className="flex items-center gap-space-sm">
          <Button type="submit" cargando={submit.cargando} disabled={sinCambios || !!genVsReserva}>
            Guardar cambios
          </Button>
          {!sinCambios && (
            <Button
              type="button"
              variante="text"
              onClick={() =>
                setValores(
                  Object.fromEntries(
                    META_PARAMETROS.map((m) => [m.clave, String(data[m.clave])]),
                  ),
                )
              }
            >
              Descartar
            </Button>
          )}
        </div>
      ) : (
        <p className="text-body-sm text-on-surface-variant">
          Sólo un usuario con rol Administración puede modificar estos valores.
        </p>
      )}
    </form>
  );
}
