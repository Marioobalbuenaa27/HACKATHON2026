"use client";

import { useMemo, useState } from "react";
import { CrudTabla, type RenderFormArgs } from "@/components/admin/CrudTabla";
import { FormDialog } from "@/components/admin/FormDialog";
import { TextField } from "@/components/ui/TextField";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/http/cliente";
import { useLista, useSubmit } from "@/lib/http/hooks";
import {
  ETIQUETA_PRIORIDAD,
  type Categoria,
  type Especialidad,
  type PrioridadBase,
} from "@/lib/http/tipos";

const BASE = "/api/admin/categorias";
const ESP = "/api/admin/especialidades";

const PRIORIDADES: PrioridadBase[] = ["NORMAL", "PREFERENCIAL", "PRIORITARIO"];

function CategoriaForm({
  fila,
  onClose,
  especialidades,
}: RenderFormArgs<Categoria> & { especialidades: Especialidad[] }) {
  const esEdicion = !!fila;
  const [nombre, setNombre] = useState(fila?.nombre ?? "");
  const [ayuda, setAyuda] = useState(fila?.ayuda ?? "");
  const [prioridadBase, setPrioridadBase] = useState<PrioridadBase>(
    fila?.prioridadBase ?? "NORMAL",
  );
  const [derivarAGuardia, setDerivarAGuardia] = useState(fila?.derivarAGuardia ?? false);
  const [orden, setOrden] = useState(String(fila?.orden ?? 0));
  const [especialidadIds, setEspecialidadIds] = useState<string[]>(
    fila?.especialidades.map((e) => e.especialidadId) ?? [],
  );
  const [notas, setNotas] = useState<Record<string, string>>(() => {
    const n: Record<string, string> = {};
    for (const e of fila?.especialidades ?? []) if (e.nota) n[e.especialidadId] = e.nota;
    return n;
  });

  const submit = useSubmit(
    async () => {
      const catBody = {
        nombre,
        ayuda: ayuda.trim() || null,
        prioridadBase,
        derivarAGuardia,
        orden: Number(orden) || 0,
      };
      const mapeo = especialidadIds.map((id) => ({
        especialidadId: id,
        nota: notas[id]?.trim() || null,
      }));

      if (esEdicion) {
        // Si pasa a derivar a guardia y tenía mapeos, hay que limpiarlos antes del PATCH.
        if (derivarAGuardia && fila!.especialidades.length > 0) {
          await api.put(`${BASE}/${fila!.id}/especialidades`, []);
        }
        await api.patch(`${BASE}/${fila!.id}`, catBody);
        if (!derivarAGuardia) await api.put(`${BASE}/${fila!.id}/especialidades`, mapeo);
      } else {
        const creada = await api.post<Categoria>(BASE, catBody);
        if (!derivarAGuardia && mapeo.length > 0) {
          await api.put(`${BASE}/${creada.id}/especialidades`, mapeo);
        }
      }
    },
    { invalida: [BASE], exito: esEdicion ? "Categoría actualizada." : "Categoría creada." },
  );

  const errorNombre =
    submit.campo("nombre") ??
    (submit.error?.code === "NOMBRE_DUPLICADO" ? submit.error.message : undefined);

  return (
    <FormDialog
      abierto
      onClose={onClose}
      titulo={esEdicion ? "Editar categoría" : "Nueva categoría"}
      descripcion="Nombre en lenguaje común: es lo que ve el ciudadano al pedir turno."
      onSubmit={submit.run}
      cargando={submit.cargando}
    >
      <TextField
        label="Nombre"
        requerido
        autoFocus
        placeholder="Tos y mocos hace varios días"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        error={errorNombre}
        maxLength={120}
      />
      <Textarea
        label="Texto de ayuda"
        placeholder="Aclaración opcional para el ciudadano."
        value={ayuda}
        onChange={(e) => setAyuda(e.target.value)}
        error={submit.campo("ayuda")}
        maxLength={2000}
      />
      <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
        <Select
          label="Prioridad base"
          opciones={PRIORIDADES.map((p) => ({ value: p, label: ETIQUETA_PRIORIDAD[p] }))}
          value={prioridadBase}
          onChange={(e) => setPrioridadBase(e.target.value as PrioridadBase)}
          error={submit.campo("prioridadBase")}
        />
        <TextField
          label="Orden en el listado"
          type="number"
          inputMode="numeric"
          value={orden}
          onChange={(e) => setOrden(e.target.value)}
          error={submit.campo("orden")}
          hint="Menor número aparece primero."
        />
      </div>
      <Switch
        label="Derivar a guardia"
        hint="Si está activo, la categoría no resuelve a una especialidad: se deriva a guardia."
        checked={derivarAGuardia}
        onChange={setDerivarAGuardia}
      />

      {!derivarAGuardia && (
        <div className="flex flex-col gap-space-sm rounded-lg bg-surface-container-low p-space-sm">
          <MultiSelect
            label="Especialidades que resuelven esta categoría"
            opciones={especialidades.map((e) => ({ value: e.id, label: e.nombre }))}
            seleccionados={especialidadIds}
            onChange={setEspecialidadIds}
          />
          {especialidadIds.length > 1 &&
            especialidadIds.map((id) => {
              const esp = especialidades.find((e) => e.id === id);
              return (
                <TextField
                  key={id}
                  label={`Nota para ${esp?.nombre ?? "especialidad"}`}
                  placeholder="Ej. Si además hay fiebre"
                  value={notas[id] ?? ""}
                  onChange={(e) => setNotas((n) => ({ ...n, [id]: e.target.value }))}
                  maxLength={280}
                />
              );
            })}
        </div>
      )}
      {derivarAGuardia && (
        <p className="text-body-sm text-on-surface-variant">
          El mapeo de especialidades se deshabilita mientras la categoría derive a guardia.
        </p>
      )}
    </FormDialog>
  );
}

export function CategoriasTabla({ puedeEditar }: { puedeEditar: boolean }) {
  const { items: especialidades } = useLista<Especialidad>(`${ESP}?pageSize=100`);
  const mapaEsp = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of especialidades) m[e.id] = e.nombre;
    return m;
  }, [especialidades]);

  return (
    <CrudTabla<Categoria>
      basePath={BASE}
      campoActivo="activa"
      paramInactivas="incluirInactivas"
      puedeEditar={puedeEditar}
      entidadSingular="categoría"
      entidadPlural="categorías"
      nombreDe={(f) => f.nombre}
      columnas={[
        {
          clave: "nombre",
          encabezado: "Categoría",
          celda: (f) => (
            <span className="flex flex-col">
              <span className="text-on-surface">{f.nombre}</span>
              {f.ayuda && (
                <span className="text-body-sm text-on-surface-variant line-clamp-1">
                  {f.ayuda}
                </span>
              )}
            </span>
          ),
        },
        {
          clave: "prioridad",
          encabezado: "Prioridad",
          celda: (f) => ETIQUETA_PRIORIDAD[f.prioridadBase],
        },
        {
          clave: "resuelve",
          encabezado: "Resuelve a",
          celda: (f) =>
            f.derivarAGuardia ? (
              <Badge tono="aviso" icono="emergency">
                Guardia
              </Badge>
            ) : f.especialidades.length ? (
              <span className="flex flex-wrap gap-space-2xs">
                {f.especialidades.map((e) => (
                  <Badge key={e.especialidadId}>{mapaEsp[e.especialidadId] ?? "…"}</Badge>
                ))}
              </span>
            ) : (
              <span className="text-on-surface-variant">Sin mapear</span>
            ),
        },
        { clave: "orden", encabezado: "Orden", celda: (f) => f.orden },
      ]}
      renderForm={(args) => <CategoriaForm {...args} especialidades={especialidades} />}
    />
  );
}
