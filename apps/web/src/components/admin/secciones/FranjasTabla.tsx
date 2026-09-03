"use client";

// ABM de franjas de agenda (FR-25..FR-28). El alta/edición dispara regeneración
// incremental de slots en la API; acá sólo mostramos un aviso de solape como pista
// (la validación real la hace el servidor: 409 FRANJA_SOLAPADA).

import { useMemo, useState } from "react";
import { DataTable, type Columna } from "@/components/ui/DataTable";
import { FormDialog } from "@/components/admin/FormDialog";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { api } from "@/lib/http/cliente";
import { useLista, useMutacion, useSubmit } from "@/lib/http/hooks";
import {
  DIAS_SEMANA,
  ETIQUETA_DIA,
  type DiaSemana,
  type Especialidad,
  type FranjaAgenda,
} from "@/lib/http/tipos";
import { useEspecialidades, useProfesionales, useSalas } from "./lookups";

const BASE = "/api/admin/franjas";

function rangosSeSolapan(aIni: string, aFin: string, bIni: string, bFin: string) {
  return aIni < bFin && bIni < aFin;
}

function vigenciasSeSolapan(
  aDesde: string,
  aHasta: string | null,
  bDesde: string,
  bHasta: string | null,
) {
  const finA = aHasta ?? "9999-12-31";
  const finB = bHasta ?? "9999-12-31";
  return aDesde <= finB && bDesde <= finA;
}

interface FranjaFormProps {
  fila: FranjaAgenda | null;
  onClose: () => void;
  profesionalIdInicial: string;
  franjasExistentes: FranjaAgenda[];
}

function FranjaForm({ fila, onClose, profesionalIdInicial, franjasExistentes }: FranjaFormProps) {
  const esEdicion = !!fila;
  const { profesionales } = useProfesionales();
  const { especialidades } = useEspecialidades();
  const { salas } = useSalas();

  const [profesionalId, setProfesionalId] = useState(fila?.profesionalId ?? profesionalIdInicial);
  const [diaSemana, setDiaSemana] = useState<DiaSemana>(fila?.diaSemana ?? "LUNES");
  const [horaInicio, setHoraInicio] = useState(fila?.horaInicio ?? "08:00");
  const [horaFin, setHoraFin] = useState(fila?.horaFin ?? "12:00");
  const [especialidadId, setEspecialidadId] = useState(fila?.especialidadId ?? "");
  const [salaId, setSalaId] = useState(fila?.salaId ?? "");
  const [vigenciaDesde, setVigenciaDesde] = useState(
    fila?.vigenciaDesde ?? new Date().toISOString().slice(0, 10),
  );
  const [vigenciaHasta, setVigenciaHasta] = useState(fila?.vigenciaHasta ?? "");

  const prof = profesionales.find((p) => p.id === profesionalId);
  const espDelProf: Especialidad[] = especialidades.filter(
    (e) => !prof || prof.especialidadIds.includes(e.id),
  );

  const avisoSolape = useMemo(() => {
    if (!profesionalId || horaFin <= horaInicio) return null;
    const choca = franjasExistentes.find(
      (f) =>
        f.id !== fila?.id &&
        f.activa &&
        f.profesionalId === profesionalId &&
        f.diaSemana === diaSemana &&
        rangosSeSolapan(horaInicio, horaFin, f.horaInicio, f.horaFin) &&
        vigenciasSeSolapan(
          vigenciaDesde,
          vigenciaHasta || null,
          f.vigenciaDesde,
          f.vigenciaHasta,
        ),
    );
    return choca
      ? `Parece solaparse con la franja de ${ETIQUETA_DIA[choca.diaSemana]} ${choca.horaInicio}–${choca.horaFin}. El servidor la va a rechazar.`
      : null;
  }, [
    franjasExistentes,
    fila?.id,
    profesionalId,
    diaSemana,
    horaInicio,
    horaFin,
    vigenciaDesde,
    vigenciaHasta,
  ]);

  const submit = useSubmit(
    () => {
      const body = {
        profesionalId,
        diaSemana,
        horaInicio,
        horaFin,
        especialidadId,
        salaId,
        vigenciaDesde,
        vigenciaHasta: vigenciaHasta || null,
      };
      return esEdicion ? api.patch(`${BASE}/${fila!.id}`, body) : api.post(BASE, body);
    },
    {
      invalida: [BASE, "/api/admin/slots"],
      exito: esEdicion ? "Franja actualizada. Slots regenerados." : "Franja creada. Slots generados.",
    },
  );

  const errorSolape =
    submit.error?.code === "FRANJA_SOLAPADA" ? submit.error.message : undefined;

  return (
    <FormDialog
      abierto
      onClose={onClose}
      titulo={esEdicion ? "Editar franja" : "Nueva franja de agenda"}
      descripcion="Bloque semanal recurrente. Al guardar se regeneran los slots del profesional."
      onSubmit={submit.run}
      cargando={submit.cargando}
      errorGeneral={errorSolape}
    >
      <Select
        label="Profesional"
        requerido
        placeholder="Elegí un profesional"
        opciones={profesionales.map((p) => ({
          value: p.id,
          label: `${p.apellido}, ${p.nombre}`,
        }))}
        value={profesionalId}
        onChange={(e) => {
          setProfesionalId(e.target.value);
          setEspecialidadId("");
        }}
        error={submit.campo("profesionalId")}
      />
      <div className="grid grid-cols-1 gap-space-md sm:grid-cols-3">
        <Select
          label="Día"
          requerido
          opciones={DIAS_SEMANA.map((d) => ({ value: d, label: ETIQUETA_DIA[d] }))}
          value={diaSemana}
          onChange={(e) => setDiaSemana(e.target.value as DiaSemana)}
          error={submit.campo("diaSemana")}
        />
        <TextField
          label="Hora de inicio"
          requerido
          type="time"
          value={horaInicio}
          onChange={(e) => setHoraInicio(e.target.value)}
          error={submit.campo("horaInicio")}
        />
        <TextField
          label="Hora de fin"
          requerido
          type="time"
          value={horaFin}
          onChange={(e) => setHoraFin(e.target.value)}
          error={submit.campo("horaFin")}
          hint="Debe ser múltiplo de la duración del turno."
        />
      </div>
      <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
        <Select
          label="Especialidad"
          requerido
          placeholder="Elegí una especialidad"
          opciones={espDelProf.map((e) => ({ value: e.id, label: e.nombre }))}
          value={especialidadId}
          onChange={(e) => setEspecialidadId(e.target.value)}
          error={submit.campo("especialidadId")}
          hint={prof ? "Sólo las especialidades del profesional." : undefined}
        />
        <Select
          label="Sala / consultorio"
          requerido
          placeholder="Elegí una sala"
          opciones={salas.map((s) => ({ value: s.id, label: s.identificador }))}
          value={salaId}
          onChange={(e) => setSalaId(e.target.value)}
          error={submit.campo("salaId")}
        />
      </div>
      <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
        <TextField
          label="Vigencia desde"
          requerido
          type="date"
          value={vigenciaDesde}
          onChange={(e) => setVigenciaDesde(e.target.value)}
          error={submit.campo("vigenciaDesde")}
        />
        <TextField
          label="Vigencia hasta"
          type="date"
          value={vigenciaHasta}
          onChange={(e) => setVigenciaHasta(e.target.value)}
          error={submit.campo("vigenciaHasta")}
          hint="Opcional. Vacío = sin fecha de corte."
        />
      </div>
      {avisoSolape && !errorSolape && (
        <p
          className="flex items-center gap-space-2xs rounded-lg bg-primary-fixed px-space-sm py-space-xs text-body-sm text-on-primary-fixed"
          role="status"
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden>
            warning
          </span>
          {avisoSolape}
        </p>
      )}
    </FormDialog>
  );
}

export function FranjasTabla({ puedeEditar }: { puedeEditar: boolean }) {
  const { profesionales, nombreProfesional } = useProfesionales(true);
  const { nombreEspecialidad } = useEspecialidades();
  const { nombreSala } = useSalas();

  const [profesionalId, setProfesionalId] = useState("");
  const [incluirInactivas, setIncluirInactivas] = useState(false);
  const [formAbierto, setFormAbierto] = useState(false);
  const [enEdicion, setEnEdicion] = useState<FranjaAgenda | null>(null);
  const [aEliminar, setAEliminar] = useState<FranjaAgenda | null>(null);
  const [aToggle, setAToggle] = useState<FranjaAgenda | null>(null);

  const key = useMemo(() => {
    const sp = new URLSearchParams();
    if (profesionalId) sp.set("profesionalId", profesionalId);
    if (incluirInactivas) sp.set("incluirInactivas", "true");
    const qs = sp.toString();
    return `${BASE}${qs ? `?${qs}` : ""}`;
  }, [profesionalId, incluirInactivas]);

  const { items, isLoading } = useLista<FranjaAgenda>(key);

  const eliminarMut = useMutacion((f: FranjaAgenda) => api.del(`${BASE}/${f.id}`), {
    invalida: [BASE, "/api/admin/slots"],
    exito: "Franja eliminada. Slots regenerados.",
  });
  const toggleMut = useMutacion(
    (f: FranjaAgenda) => api.patch(`${BASE}/${f.id}`, { activa: !f.activa }),
    {
      invalida: [BASE, "/api/admin/slots"],
      exito: (_r, f) => `Franja ${f.activa ? "desactivada" : "activada"}.`,
    },
  );

  const columnas: Columna<FranjaAgenda>[] = [
    ...(profesionalId
      ? []
      : [
          {
            clave: "prof",
            encabezado: "Profesional",
            celda: (f: FranjaAgenda) => nombreProfesional[f.profesionalId] ?? "…",
          },
        ]),
    { clave: "dia", encabezado: "Día", celda: (f) => ETIQUETA_DIA[f.diaSemana] },
    {
      clave: "horario",
      encabezado: "Horario",
      celda: (f) => `${f.horaInicio} – ${f.horaFin}`,
    },
    {
      clave: "esp",
      encabezado: "Especialidad",
      celda: (f) => nombreEspecialidad[f.especialidadId] ?? "…",
    },
    { clave: "sala", encabezado: "Sala", celda: (f) => nombreSala[f.salaId] ?? "…" },
    {
      clave: "vig",
      encabezado: "Vigencia",
      celda: (f) => (f.vigenciaHasta ? `${f.vigenciaDesde} → ${f.vigenciaHasta}` : `desde ${f.vigenciaDesde}`),
    },
    {
      clave: "estado",
      encabezado: "Estado",
      celda: (f) =>
        f.inconsistente ? (
          <Badge tono="error" icono="error">
            Inconsistente
          </Badge>
        ) : f.activa ? (
          <Badge tono="exito">Activa</Badge>
        ) : (
          <Badge tono="neutral">Inactiva</Badge>
        ),
    },
    ...(puedeEditar
      ? [
          {
            clave: "_acciones",
            encabezado: "Acciones",
            finLinea: true,
            celda: (f: FranjaAgenda) => (
              <div className="flex justify-end gap-space-2xs">
                <Button
                  variante="text"
                  icono="edit"
                  className="px-space-xs"
                  onClick={() => {
                    setEnEdicion(f);
                    setFormAbierto(true);
                  }}
                  aria-label="Editar franja"
                >
                  Editar
                </Button>
                <Button
                  variante="text"
                  icono={f.activa ? "block" : "check_circle"}
                  className="px-space-xs"
                  onClick={() => setAToggle(f)}
                  aria-label={f.activa ? "Desactivar franja" : "Activar franja"}
                >
                  {f.activa ? "Desactivar" : "Activar"}
                </Button>
                <Button
                  variante="text"
                  icono="delete"
                  className="px-space-xs text-error"
                  onClick={() => setAEliminar(f)}
                  aria-label="Eliminar franja"
                >
                  Eliminar
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-space-sm">
      <div className="flex flex-wrap items-end justify-between gap-space-sm">
        <div className="flex flex-wrap items-end gap-space-sm">
          <div className="w-64">
            <Select
              label="Profesional"
              placeholder="Todos los profesionales"
              opciones={profesionales.map((p) => ({
                value: p.id,
                label: `${p.apellido}, ${p.nombre}`,
              }))}
              value={profesionalId}
              onChange={(e) => setProfesionalId(e.target.value)}
            />
          </div>
          <Checkbox
            label="Incluir inactivas"
            checked={incluirInactivas}
            onChange={(e) => setIncluirInactivas(e.currentTarget.checked)}
          />
        </div>
        {puedeEditar && (
          <Button
            icono="add"
            onClick={() => {
              setEnEdicion(null);
              setFormAbierto(true);
            }}
          >
            Nueva franja
          </Button>
        )}
      </div>

      <DataTable
        columnas={columnas}
        filas={items}
        idDe={(f) => f.id}
        cargando={isLoading}
        filaInactiva={(f) => !f.activa}
        vacio={{
          titulo: "Sin franjas",
          descripcion: profesionalId
            ? "Este profesional todavía no tiene franjas de agenda."
            : "Todavía no se cargaron franjas de agenda.",
          icono: "calendar_month",
        }}
      />

      {formAbierto && (
        <FranjaForm
          fila={enEdicion}
          profesionalIdInicial={profesionalId}
          franjasExistentes={items}
          onClose={() => setFormAbierto(false)}
        />
      )}

      {aToggle && (
        <ConfirmDialog
          abierto
          onClose={() => setAToggle(null)}
          titulo={aToggle.activa ? "Desactivar franja" : "Activar franja"}
          mensaje={
            aToggle.activa
              ? "La franja dejará de generar slots. Los slots disponibles futuros se eliminan."
              : "La franja vuelve a generar slots en la próxima regeneración."
          }
          peligroso={aToggle.activa}
          textoConfirmar={aToggle.activa ? "Desactivar" : "Activar"}
          onConfirmar={() => toggleMut.ejecutar(aToggle)}
        />
      )}

      {aEliminar && (
        <ConfirmDialog
          abierto
          onClose={() => setAEliminar(null)}
          titulo="Eliminar franja"
          mensaje="Se elimina la franja y sus slots disponibles futuros. Los slots ocupados quedan marcados como huérfanos para revisión."
          peligroso
          textoConfirmar="Eliminar"
          onConfirmar={() => eliminarMut.ejecutar(aEliminar)}
        />
      )}
    </div>
  );
}
