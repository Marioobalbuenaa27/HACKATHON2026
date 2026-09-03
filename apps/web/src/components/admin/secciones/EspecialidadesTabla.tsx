"use client";

import { useState } from "react";
import { CrudTabla, type RenderFormArgs } from "@/components/admin/CrudTabla";
import { FormDialog } from "@/components/admin/FormDialog";
import { TextField } from "@/components/ui/TextField";
import { api } from "@/lib/http/cliente";
import { useSubmit } from "@/lib/http/hooks";
import type { Especialidad } from "@/lib/http/tipos";

const BASE = "/api/admin/especialidades";

function EspecialidadForm({ fila, onClose }: RenderFormArgs<Especialidad>) {
  const esEdicion = !!fila;
  const [nombre, setNombre] = useState(fila?.nombre ?? "");
  const [duracion, setDuracion] = useState(String(fila?.duracionTurnoMin ?? 15));

  const submit = useSubmit(
    () => {
      const body = { nombre, duracionTurnoMin: Number(duracion) };
      return esEdicion ? api.patch(`${BASE}/${fila!.id}`, body) : api.post(BASE, body);
    },
    { invalida: [BASE], exito: esEdicion ? "Especialidad actualizada." : "Especialidad creada." },
  );

  const errorNombre =
    submit.campo("nombre") ??
    (submit.error?.code === "NOMBRE_DUPLICADO" ? submit.error.message : undefined);

  return (
    <FormDialog
      abierto
      onClose={onClose}
      titulo={esEdicion ? "Editar especialidad" : "Nueva especialidad"}
      onSubmit={submit.run}
      cargando={submit.cargando}
      ancho="sm"
    >
      <TextField
        label="Nombre"
        requerido
        autoFocus
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        error={errorNombre}
        maxLength={120}
      />
      <TextField
        label="Duración del turno (minutos)"
        requerido
        type="number"
        min={5}
        max={120}
        step={5}
        inputMode="numeric"
        value={duracion}
        onChange={(e) => setDuracion(e.target.value)}
        error={submit.campo("duracionTurnoMin")}
        hint="Entre 5 y 120, múltiplo de 5."
      />
    </FormDialog>
  );
}

export function EspecialidadesTabla({ puedeEditar }: { puedeEditar: boolean }) {
  return (
    <CrudTabla<Especialidad>
      basePath={BASE}
      campoActivo="activa"
      paramInactivas="incluirInactivas"
      puedeEditar={puedeEditar}
      entidadSingular="especialidad"
      entidadPlural="especialidades"
      nombreDe={(f) => f.nombre}
      columnas={[
        { clave: "nombre", encabezado: "Nombre", celda: (f) => f.nombre },
        {
          clave: "duracion",
          encabezado: "Duración",
          celda: (f) => `${f.duracionTurnoMin} min`,
        },
      ]}
      renderForm={(args) => <EspecialidadForm {...args} />}
    />
  );
}
