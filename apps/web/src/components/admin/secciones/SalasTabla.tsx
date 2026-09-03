"use client";

import { useState } from "react";
import { CrudTabla, type RenderFormArgs } from "@/components/admin/CrudTabla";
import { FormDialog } from "@/components/admin/FormDialog";
import { TextField } from "@/components/ui/TextField";
import { api } from "@/lib/http/cliente";
import { useSubmit } from "@/lib/http/hooks";
import type { Sala } from "@/lib/http/tipos";

const BASE = "/api/admin/salas";

function SalaForm({ fila, onClose }: RenderFormArgs<Sala>) {
  const esEdicion = !!fila;
  const [identificador, setIdentificador] = useState(fila?.identificador ?? "");
  const [ubicacion, setUbicacion] = useState(fila?.ubicacion ?? "");

  const submit = useSubmit(
    () => {
      const body = { identificador, ubicacion: ubicacion.trim() || null };
      return esEdicion ? api.patch(`${BASE}/${fila!.id}`, body) : api.post(BASE, body);
    },
    { invalida: [BASE], exito: esEdicion ? "Sala actualizada." : "Sala creada." },
  );

  const errorIdent =
    submit.campo("identificador") ??
    (submit.error?.code === "IDENTIFICADOR_DUPLICADO" || submit.error?.code === "NOMBRE_DUPLICADO"
      ? submit.error.message
      : undefined);

  return (
    <FormDialog
      abierto
      onClose={onClose}
      titulo={esEdicion ? "Editar sala" : "Nueva sala"}
      onSubmit={submit.run}
      cargando={submit.cargando}
      ancho="sm"
    >
      <TextField
        label="Identificador"
        requerido
        autoFocus
        placeholder="Consultorio 4"
        value={identificador}
        onChange={(e) => setIdentificador(e.target.value)}
        error={errorIdent}
        maxLength={80}
      />
      <TextField
        label="Ubicación"
        placeholder="PB, ala este"
        value={ubicacion}
        onChange={(e) => setUbicacion(e.target.value)}
        error={submit.campo("ubicacion")}
        maxLength={200}
      />
    </FormDialog>
  );
}

export function SalasTabla({ puedeEditar }: { puedeEditar: boolean }) {
  return (
    <CrudTabla<Sala>
      basePath={BASE}
      campoActivo="activa"
      paramInactivas="incluirInactivas"
      puedeEditar={puedeEditar}
      entidadSingular="sala"
      nombreDe={(f) => f.identificador}
      columnas={[
        { clave: "id", encabezado: "Identificador", celda: (f) => f.identificador },
        {
          clave: "ubicacion",
          encabezado: "Ubicación",
          celda: (f) => f.ubicacion || "—",
        },
      ]}
      renderForm={(args) => <SalaForm {...args} />}
    />
  );
}
