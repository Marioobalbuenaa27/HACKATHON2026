"use client";

import { useMemo, useState } from "react";
import { CrudTabla, type RenderFormArgs } from "@/components/admin/CrudTabla";
import { FormDialog } from "@/components/admin/FormDialog";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/http/cliente";
import { useLista, useSubmit } from "@/lib/http/hooks";
import type { Especialidad, Profesional, UsuarioListItem } from "@/lib/http/tipos";

const BASE = "/api/admin/profesionales";
const ESP = "/api/admin/especialidades";
const USUARIOS = "/api/admin/usuarios";

function useEspecialidades() {
  const { items } = useLista<Especialidad>(`${ESP}?pageSize=100`);
  const mapa = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of items) m[e.id] = e.nombre;
    return m;
  }, [items]);
  return { especialidades: items, mapa };
}

function ProfesionalForm({
  fila,
  onClose,
  especialidades,
}: RenderFormArgs<Profesional> & { especialidades: Especialidad[] }) {
  const esEdicion = !!fila;
  const [nombre, setNombre] = useState(fila?.nombre ?? "");
  const [apellido, setApellido] = useState(fila?.apellido ?? "");
  const [matricula, setMatricula] = useState(fila?.matricula ?? "");
  const [especialidadIds, setEspecialidadIds] = useState<string[]>(fila?.especialidadIds ?? []);
  const [usuarioId, setUsuarioId] = useState(fila?.usuarioId ?? "");

  // La lista de usuarios sólo es visible para ADMIN; si falla (403) ocultamos el campo.
  const { items: usuarios, error: errorUsuarios } = useLista<UsuarioListItem>(
    `${USUARIOS}?pageSize=100`,
  );
  const usuariosVinculables = usuarios.filter(
    (u) => u.rol === "PROFESIONAL" && (u.profesionalId === null || u.id === fila?.usuarioId),
  );

  const submit = useSubmit(
    () => {
      const body = {
        nombre,
        apellido,
        matricula,
        especialidadIds,
        usuarioId: usuarioId || null,
      };
      return esEdicion ? api.patch(`${BASE}/${fila!.id}`, body) : api.post(BASE, body);
    },
    { invalida: [BASE], exito: esEdicion ? "Profesional actualizado." : "Profesional creado." },
  );

  const errorMatricula =
    submit.campo("matricula") ??
    (submit.error?.code === "MATRICULA_DUPLICADA" ? submit.error.message : undefined);
  const errorUsuario =
    submit.campo("usuarioId") ??
    (submit.error?.code === "USUARIO_YA_VINCULADO" ? submit.error.message : undefined);

  return (
    <FormDialog
      abierto
      onClose={onClose}
      titulo={esEdicion ? "Editar profesional" : "Nuevo profesional"}
      onSubmit={submit.run}
      cargando={submit.cargando}
    >
      <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
        <TextField
          label="Nombre"
          requerido
          autoFocus
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          error={submit.campo("nombre")}
          maxLength={120}
        />
        <TextField
          label="Apellido"
          requerido
          value={apellido}
          onChange={(e) => setApellido(e.target.value)}
          error={submit.campo("apellido")}
          maxLength={120}
        />
      </div>
      <TextField
        label="Matrícula"
        requerido
        value={matricula}
        onChange={(e) => setMatricula(e.target.value)}
        error={errorMatricula}
        maxLength={60}
      />
      <MultiSelect
        label="Especialidades"
        requerido
        hint="Al menos una. Determina qué agendas puede tener."
        opciones={especialidades.map((e) => ({ value: e.id, label: e.nombre }))}
        seleccionados={especialidadIds}
        onChange={setEspecialidadIds}
        error={submit.campo("especialidadIds")}
      />
      {!errorUsuarios && (
        <Select
          label="Usuario del panel vinculado"
          placeholder="Sin vincular"
          hint="Sólo usuarios con rol Profesional que no estén ya vinculados."
          opciones={usuariosVinculables.map((u) => ({
            value: u.id,
            label: `${u.nombre} · ${u.email}`,
          }))}
          value={usuarioId}
          onChange={(e) => setUsuarioId(e.target.value)}
          error={errorUsuario}
        />
      )}
    </FormDialog>
  );
}

export function ProfesionalesTabla({ puedeEditar }: { puedeEditar: boolean }) {
  const { especialidades, mapa } = useEspecialidades();

  return (
    <CrudTabla<Profesional>
      basePath={BASE}
      campoActivo="activo"
      paramInactivas="incluirInactivos"
      puedeEditar={puedeEditar}
      entidadSingular="profesional"
      entidadPlural="profesionales"
      entidadFemenina={false}
      nombreDe={(f) => `${f.apellido}, ${f.nombre}`}
      columnas={[
        {
          clave: "nombre",
          encabezado: "Profesional",
          celda: (f) => (
            <span className="flex flex-col">
              <span className="text-on-surface">
                {f.apellido}, {f.nombre}
              </span>
              <span className="text-body-sm text-on-surface-variant">Mat. {f.matricula}</span>
            </span>
          ),
        },
        {
          clave: "esp",
          encabezado: "Especialidades",
          celda: (f) => (
            <span className="flex flex-wrap gap-space-2xs">
              {f.especialidadIds.map((id) => (
                <Badge key={id}>{mapa[id] ?? "…"}</Badge>
              ))}
            </span>
          ),
        },
        {
          clave: "usuario",
          encabezado: "Acceso",
          celda: (f) =>
            f.usuarioId ? (
              <Badge tono="info" icono="link">
                Vinculado
              </Badge>
            ) : (
              "—"
            ),
        },
      ]}
      renderForm={(args) => <ProfesionalForm {...args} especialidades={especialidades} />}
    />
  );
}
