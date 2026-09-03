"use client";

import { useState } from "react";
import { CrudTabla, type RenderFormArgs } from "@/components/admin/CrudTabla";
import { FormDialog } from "@/components/admin/FormDialog";
import { TextField } from "@/components/ui/TextField";
import { api } from "@/lib/http/cliente";
import { useSubmit } from "@/lib/http/hooks";
import type { ObraSocial } from "@/lib/http/tipos";

const BASE = "/api/admin/obras-sociales";

function ObraSocialForm({ fila, onClose }: RenderFormArgs<ObraSocial>) {
  const esEdicion = !!fila;
  const [nombre, setNombre] = useState(fila?.nombre ?? "");

  const submit = useSubmit(
    () =>
      esEdicion
        ? api.patch(`${BASE}/${fila!.id}`, { nombre })
        : api.post(BASE, { nombre }),
    { invalida: [BASE], exito: esEdicion ? "Obra social actualizada." : "Obra social creada." },
  );

  const errorNombre =
    submit.campo("nombre") ??
    (submit.error?.code === "NOMBRE_DUPLICADO" ? submit.error.message : undefined);

  return (
    <FormDialog
      abierto
      onClose={onClose}
      titulo={esEdicion ? "Editar obra social" : "Nueva obra social"}
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
    </FormDialog>
  );
}

export function ObrasSocialesTabla({ puedeEditar }: { puedeEditar: boolean }) {
  return (
    <CrudTabla<ObraSocial>
      basePath={BASE}
      campoActivo="activa"
      paramInactivas="incluirInactivas"
      puedeEditar={puedeEditar}
      entidadSingular="obra social"
      entidadPlural="obras sociales"
      nombreDe={(f) => f.nombre}
      columnas={[
        { clave: "nombre", encabezado: "Nombre", celda: (f) => f.nombre },
      ]}
      renderForm={(args) => <ObraSocialForm {...args} />}
    />
  );
}
