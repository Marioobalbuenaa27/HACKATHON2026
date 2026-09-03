"use client";

// ABM de excepciones de agenda (FR-29..FR-32). BLOQUEO oculta tramos de una fecha;
// APERTURA agrega atención puntual fuera de las franjas. Sólo alta y baja: no hay
// edición (se elimina y se vuelve a crear). Cada cambio regenera slots en la API.

import { useMemo, useState } from "react";
import { DataTable, type Columna } from "@/components/ui/DataTable";
import { FormDialog } from "@/components/admin/FormDialog";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { api } from "@/lib/http/cliente";
import { useLista, useMutacion, useSubmit } from "@/lib/http/hooks";
import {
  ETIQUETA_TIPO_EXCEPCION,
  type Especialidad,
  type ExcepcionAgenda,
  type TipoExcepcion,
} from "@/lib/http/tipos";
import { useEspecialidades, useProfesionales, useSalas } from "./lookups";

const BASE = "/api/admin/excepciones";
const TIPOS: TipoExcepcion[] = ["BLOQUEO", "APERTURA"];

function ExcepcionForm({
  onClose,
  profesionalIdInicial,
}: {
  onClose: () => void;
  profesionalIdInicial: string;
}) {
  const { profesionales } = useProfesionales();
  const { especialidades } = useEspecialidades();
  const { salas } = useSalas();

  const [profesionalId, setProfesionalId] = useState(profesionalIdInicial);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [tipo, setTipo] = useState<TipoExcepcion>("BLOQUEO");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");
  const [especialidadId, setEspecialidadId] = useState("");
  const [salaId, setSalaId] = useState("");
  const [motivo, setMotivo] = useState("");

  const esApertura = tipo === "APERTURA";
  const prof = profesionales.find((p) => p.id === profesionalId);
  const espDelProf: Especialidad[] = especialidades.filter(
    (e) => !prof || prof.especialidadIds.includes(e.id),
  );

  const submit = useSubmit(
    () => {
      const body = {
        profesionalId,
        fecha,
        tipo,
        motivo,
        horaInicio: horaInicio || null,
        horaFin: horaFin || null,
        especialidadId: esApertura ? especialidadId || null : null,
        salaId: esApertura ? salaId || null : null,
      };
      return api.post(BASE, body);
    },
    { invalida: [BASE, "/api/admin/slots"], exito: "Excepción registrada. Slots regenerados." },
  );

  const errorSolape =
    submit.error?.code === "APERTURA_SOLAPADA" ? submit.error.message : undefined;

  return (
    <FormDialog
      abierto
      onClose={onClose}
      titulo="Nueva excepción de agenda"
      descripcion="Se aplica a una única fecha y regenera los slots del profesional."
      onSubmit={submit.run}
      cargando={submit.cargando}
      errorGeneral={errorSolape}
    >
      <Select
        label="Profesional"
        requerido
        placeholder="Elegí un profesional"
        opciones={profesionales.map((p) => ({ value: p.id, label: `${p.apellido}, ${p.nombre}` }))}
        value={profesionalId}
        onChange={(e) => {
          setProfesionalId(e.target.value);
          setEspecialidadId("");
        }}
        error={submit.campo("profesionalId")}
      />
      <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
        <TextField
          label="Fecha"
          requerido
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          error={submit.campo("fecha")}
        />
        <Select
          label="Tipo"
          requerido
          opciones={TIPOS.map((t) => ({ value: t, label: ETIQUETA_TIPO_EXCEPCION[t] }))}
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoExcepcion)}
          error={submit.campo("tipo")}
          hint={esApertura ? "Atiende fuera de sus franjas habituales." : "No atiende ese día (total o por tramo)."}
        />
      </div>
      <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
        <TextField
          label="Hora de inicio"
          requerido={esApertura}
          type="time"
          value={horaInicio}
          onChange={(e) => setHoraInicio(e.target.value)}
          error={submit.campo("horaInicio")}
          hint={esApertura ? undefined : "Vacío = bloquea todo el día."}
        />
        <TextField
          label="Hora de fin"
          requerido={esApertura}
          type="time"
          value={horaFin}
          onChange={(e) => setHoraFin(e.target.value)}
          error={submit.campo("horaFin")}
        />
      </div>
      {esApertura && (
        <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
          <Select
            label="Especialidad"
            requerido
            placeholder="Elegí una especialidad"
            opciones={espDelProf.map((e) => ({ value: e.id, label: e.nombre }))}
            value={especialidadId}
            onChange={(e) => setEspecialidadId(e.target.value)}
            error={submit.campo("especialidadId")}
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
      )}
      <Textarea
        label="Motivo"
        requerido
        placeholder="Ej. licencia, congreso, refuerzo de agenda…"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        error={submit.campo("motivo")}
        maxLength={280}
      />
    </FormDialog>
  );
}

export function ExcepcionesTabla({ puedeEditar }: { puedeEditar: boolean }) {
  const { profesionales, nombreProfesional } = useProfesionales(true);
  const { nombreEspecialidad } = useEspecialidades();
  const { nombreSala } = useSalas();

  const [profesionalId, setProfesionalId] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [formAbierto, setFormAbierto] = useState(false);
  const [aEliminar, setAEliminar] = useState<ExcepcionAgenda | null>(null);

  const key = useMemo(() => {
    const sp = new URLSearchParams();
    if (profesionalId) sp.set("profesionalId", profesionalId);
    if (desde) sp.set("desde", desde);
    if (hasta) sp.set("hasta", hasta);
    const qs = sp.toString();
    return `${BASE}${qs ? `?${qs}` : ""}`;
  }, [profesionalId, desde, hasta]);

  const { items, isLoading } = useLista<ExcepcionAgenda>(key);

  const eliminarMut = useMutacion((e: ExcepcionAgenda) => api.del(`${BASE}/${e.id}`), {
    invalida: [BASE, "/api/admin/slots"],
    exito: "Excepción eliminada. Slots regenerados.",
  });

  const columnas: Columna<ExcepcionAgenda>[] = [
    ...(profesionalId
      ? []
      : [
          {
            clave: "prof",
            encabezado: "Profesional",
            celda: (e: ExcepcionAgenda) => nombreProfesional[e.profesionalId] ?? "…",
          },
        ]),
    { clave: "fecha", encabezado: "Fecha", celda: (e) => e.fecha },
    {
      clave: "tipo",
      encabezado: "Tipo",
      celda: (e) => (
        <Badge tono={e.tipo === "APERTURA" ? "info" : "aviso"} icono={e.tipo === "APERTURA" ? "event_available" : "event_busy"}>
          {ETIQUETA_TIPO_EXCEPCION[e.tipo]}
        </Badge>
      ),
    },
    {
      clave: "horario",
      encabezado: "Horario",
      celda: (e) => (e.horaInicio && e.horaFin ? `${e.horaInicio} – ${e.horaFin}` : "Todo el día"),
    },
    {
      clave: "esp",
      encabezado: "Especialidad / sala",
      celda: (e) =>
        e.tipo === "APERTURA"
          ? `${nombreEspecialidad[e.especialidadId ?? ""] ?? "…"} · ${nombreSala[e.salaId ?? ""] ?? "…"}`
          : "—",
    },
    {
      clave: "motivo",
      encabezado: "Motivo",
      celda: (e) => <span className="line-clamp-2 max-w-xs">{e.motivo}</span>,
    },
    ...(puedeEditar
      ? [
          {
            clave: "_acciones",
            encabezado: "Acciones",
            finLinea: true,
            celda: (e: ExcepcionAgenda) => (
              <Button
                variante="text"
                icono="delete"
                className="px-space-xs text-error"
                onClick={() => setAEliminar(e)}
                aria-label="Eliminar excepción"
              >
                Eliminar
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-space-sm">
      <div className="flex flex-wrap items-end justify-between gap-space-sm">
        <div className="flex flex-wrap items-end gap-space-sm">
          <div className="w-56">
            <Select
              label="Profesional"
              placeholder="Todos"
              opciones={profesionales.map((p) => ({ value: p.id, label: `${p.apellido}, ${p.nombre}` }))}
              value={profesionalId}
              onChange={(e) => setProfesionalId(e.target.value)}
            />
          </div>
          <TextField label="Desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          <TextField label="Hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        {puedeEditar && (
          <Button icono="add" onClick={() => setFormAbierto(true)}>
            Nueva excepción
          </Button>
        )}
      </div>

      <DataTable
        columnas={columnas}
        filas={items}
        idDe={(e) => e.id}
        cargando={isLoading}
        vacio={{
          titulo: "Sin excepciones",
          descripcion: "No hay bloqueos ni aperturas registrados para este filtro.",
          icono: "event_busy",
        }}
      />

      {formAbierto && (
        <ExcepcionForm profesionalIdInicial={profesionalId} onClose={() => setFormAbierto(false)} />
      )}

      {aEliminar && (
        <ConfirmDialog
          abierto
          onClose={() => setAEliminar(null)}
          titulo="Eliminar excepción"
          mensaje={
            aEliminar.tipo === "APERTURA"
              ? "Se elimina la apertura y sus slots disponibles. Los ocupados quedan huérfanos."
              : "Se elimina el bloqueo; los slots de la franja se regeneran para esa fecha."
          }
          peligroso
          textoConfirmar="Eliminar"
          onConfirmar={() => eliminarMut.ejecutar(aEliminar)}
        />
      )}
    </div>
  );
}
