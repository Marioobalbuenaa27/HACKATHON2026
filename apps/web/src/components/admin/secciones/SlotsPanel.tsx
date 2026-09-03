"use client";

// Visor de slots generados + acción manual "Generar slots" (FR-40).
// La generación es idempotente en la API: crea los que faltan, borra los que ya no
// corresponden y deja intactos los que siguen válidos.

import { useMemo, useState } from "react";
import { DataTable, type Columna } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { Dialog } from "@/components/ui/Dialog";
import { api } from "@/lib/http/cliente";
import { useLista, useMutacion } from "@/lib/http/hooks";
import type { GenerarSlotsResultado, Slot } from "@/lib/http/tipos";
import { useEspecialidades, useProfesionales, useSalas } from "./lookups";

const BASE = "/api/admin/slots";
const PAGE_SIZE = 50;

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}
function enDiasISO(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function SlotsPanel({ puedeEditar }: { puedeEditar: boolean }) {
  const { profesionales, nombreProfesional } = useProfesionales(true);
  const { nombreEspecialidad } = useEspecialidades();
  const { nombreSala } = useSalas();

  const [profesionalId, setProfesionalId] = useState("");
  const [desde, setDesde] = useState(hoyISO());
  const [hasta, setHasta] = useState(enDiasISO(14));
  const [estado, setEstado] = useState("");
  const [page, setPage] = useState(1);

  const [dialogGenerar, setDialogGenerar] = useState(false);
  const [resultado, setResultado] = useState<GenerarSlotsResultado | null>(null);

  const key = useMemo(() => {
    const sp = new URLSearchParams();
    if (profesionalId) sp.set("profesionalId", profesionalId);
    if (desde) sp.set("desde", desde);
    if (hasta) sp.set("hasta", hasta);
    if (estado) sp.set("estado", estado);
    const qs = sp.toString();
    return `${BASE}${qs ? `?${qs}` : ""}`;
  }, [profesionalId, desde, hasta, estado]);

  const { items, isLoading, refrescar } = useLista<Slot>(key);

  const totalPaginas = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pageActual = Math.min(page, totalPaginas);
  const pagina = items.slice((pageActual - 1) * PAGE_SIZE, pageActual * PAGE_SIZE);

  const generarMut = useMutacion(
    (alcanceProfesionalId: string | null) =>
      api.post<GenerarSlotsResultado>(
        `${BASE}/generar`,
        alcanceProfesionalId ? { profesionalId: alcanceProfesionalId } : {},
      ),
    {
      invalida: [BASE],
      exito: (r) =>
        `Generación lista: ${r.creados} creados, ${r.eliminados} eliminados, ${r.sinCambios} sin cambios (${r.profesionales} profesionales).`,
      onSuccess: (r) => {
        setResultado(r);
        refrescar();
      },
    },
  );

  const columnas: Columna<Slot>[] = [
    { clave: "fecha", encabezado: "Fecha", celda: (s) => s.fecha },
    { clave: "horario", encabezado: "Horario", celda: (s) => `${s.horaInicio} – ${s.horaFin}` },
    ...(profesionalId
      ? []
      : [
          {
            clave: "prof",
            encabezado: "Profesional",
            celda: (s: Slot) => nombreProfesional[s.profesionalId] ?? "…",
          },
        ]),
    {
      clave: "esp",
      encabezado: "Especialidad",
      celda: (s) => nombreEspecialidad[s.especialidadId] ?? "…",
    },
    { clave: "sala", encabezado: "Sala", celda: (s) => nombreSala[s.salaId] ?? "…" },
    {
      clave: "origen",
      encabezado: "Origen",
      celda: (s) => <Badge tono="neutral">{s.origen === "APERTURA" ? "Apertura" : "Franja"}</Badge>,
    },
    {
      clave: "estado",
      encabezado: "Estado",
      celda: (s) => (
        <span className="flex items-center gap-space-2xs">
          <Badge tono={s.estado === "DISPONIBLE" ? "exito" : "neutral"}>
            {s.estado === "DISPONIBLE" ? "Disponible" : "Bloqueado"}
          </Badge>
          {s.huerfano && (
            <Badge tono="error" icono="warning">
              Huérfano
            </Badge>
          )}
        </span>
      ),
    },
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
          <div className="w-40">
            <Select
              label="Estado"
              placeholder="Todos"
              opciones={[
                { value: "DISPONIBLE", label: "Disponible" },
                { value: "BLOQUEADO", label: "Bloqueado" },
              ]}
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
            />
          </div>
        </div>
        {puedeEditar && (
          <Button icono="bolt" onClick={() => setDialogGenerar(true)} cargando={generarMut.cargando}>
            Generar slots
          </Button>
        )}
      </div>

      {resultado && (
        <div className="grid grid-cols-2 gap-space-xs rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md sm:grid-cols-4">
          {[
            ["Profesionales", resultado.profesionales],
            ["Creados", resultado.creados],
            ["Eliminados", resultado.eliminados],
            ["Sin cambios", resultado.sinCambios],
          ].map(([label, valor]) => (
            <div key={label} className="flex flex-col">
              <span className="text-headline-md text-on-surface">{valor}</span>
              <span className="text-body-sm text-on-surface-variant">{label}</span>
            </div>
          ))}
          {resultado.franjasInconsistentesOmitidas.length > 0 && (
            <p className="col-span-full text-body-sm text-error">
              {resultado.franjasInconsistentesOmitidas.length} franja(s) inconsistente(s) fueron
              omitidas. Revisalas en la sección Franjas.
            </p>
          )}
        </div>
      )}

      <p className="text-body-sm text-on-surface-variant">
        {isLoading ? "Cargando…" : `${items.length} slot(s) en el rango seleccionado.`}
      </p>

      <DataTable
        columnas={columnas}
        filas={pagina}
        idDe={(s) => s.id}
        cargando={isLoading}
        vacio={{
          titulo: "Sin slots",
          descripcion:
            "No hay slots generados para este rango. Cargá franjas de agenda y usá «Generar slots».",
          icono: "grid_view",
        }}
      />
      <Pagination page={pageActual} pageSize={PAGE_SIZE} total={items.length} onPage={setPage} />

      {dialogGenerar && (
        <Dialog
          abierto
          onClose={() => setDialogGenerar(false)}
          titulo="Generar slots"
          descripcion="Recalcula los slots a partir de las franjas y excepciones vigentes."
          ancho="sm"
          acciones={
            <>
              <Button variante="text" onClick={() => setDialogGenerar(false)}>
                Cancelar
              </Button>
              {profesionalId && (
                <Button
                  variante="tonal"
                  cargando={generarMut.cargando}
                  onClick={async () => {
                    await generarMut.ejecutar(profesionalId);
                    setDialogGenerar(false);
                  }}
                >
                  Sólo este profesional
                </Button>
              )}
              <Button
                cargando={generarMut.cargando}
                onClick={async () => {
                  await generarMut.ejecutar(null);
                  setDialogGenerar(false);
                }}
              >
                Todos los profesionales
              </Button>
            </>
          }
        >
          <p className="text-body-md text-on-surface-variant">
            {profesionalId
              ? "Podés generar sólo para el profesional filtrado o para todos."
              : "Se generarán los slots de todos los profesionales activos dentro de la ventana de generación."}
          </p>
        </Dialog>
      )}
    </div>
  );
}
