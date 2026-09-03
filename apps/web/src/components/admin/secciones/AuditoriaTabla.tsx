"use client";

// Visor de la auditoría (FR-45). Sólo lectura: la API no expone escritura ni borrado
// (FR-46). Registra escrituras sobre usuarios, franjas, excepciones y parámetros.

import { useMemo, useState } from "react";
import { DataTable, type Columna } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { Badge } from "@/components/ui/Badge";
import { Dialog } from "@/components/ui/Dialog";
import { useLista } from "@/lib/http/hooks";
import { ENTIDADES_AUDITABLES, type RegistroAuditoria } from "@/lib/http/tipos";

const BASE = "/api/admin/auditoria";

const ETIQUETA_ENTIDAD: Record<string, string> = {
  usuario: "Usuario",
  franja: "Franja",
  excepcion: "Excepción",
  parametros: "Parámetros",
};

const TONO_ACCION: Record<string, "exito" | "info" | "error" | "neutral"> = {
  CREAR: "exito",
  EDITAR: "info",
  ELIMINAR: "error",
  DESACTIVAR: "neutral",
  ACTIVAR: "exito",
  RESET_PASSWORD: "neutral",
};

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AuditoriaTabla() {
  const [entidad, setEntidad] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [page, setPage] = useState(1);
  const [detalle, setDetalle] = useState<RegistroAuditoria | null>(null);

  const key = useMemo(() => {
    const sp = new URLSearchParams({ page: String(page), pageSize: "25" });
    if (entidad) sp.set("entidad", entidad);
    if (desde) sp.set("desde", desde);
    if (hasta) sp.set("hasta", hasta);
    return `${BASE}?${sp.toString()}`;
  }, [entidad, desde, hasta, page]);

  const { items, total, pageSize, isLoading } = useLista<RegistroAuditoria>(key);

  const columnas: Columna<RegistroAuditoria>[] = [
    { clave: "ts", encabezado: "Fecha y hora", celda: (r) => fmtFecha(r.timestamp) },
    { clave: "actor", encabezado: "Actor", celda: (r) => r.actorNombre },
    {
      clave: "accion",
      encabezado: "Acción",
      celda: (r) => <Badge tono={TONO_ACCION[r.accion] ?? "neutral"}>{r.accion}</Badge>,
    },
    {
      clave: "entidad",
      encabezado: "Entidad",
      celda: (r) => (
        <span className="flex flex-col">
          <span>{ETIQUETA_ENTIDAD[r.entidad] ?? r.entidad}</span>
          <span className="text-body-sm text-on-surface-variant">{r.entidadId}</span>
        </span>
      ),
    },
    {
      clave: "motivo",
      encabezado: "Motivo",
      celda: (r) => r.motivo ?? "—",
    },
    {
      clave: "_acc",
      encabezado: "",
      finLinea: true,
      celda: (r) => (
        <Button variante="text" icono="visibility" className="px-space-xs" onClick={() => setDetalle(r)}>
          Ver detalle
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-space-sm">
      <div className="flex flex-wrap items-end gap-space-sm">
        <div className="w-48">
          <Select
            label="Entidad"
            placeholder="Todas"
            opciones={ENTIDADES_AUDITABLES.map((e) => ({
              value: e,
              label: ETIQUETA_ENTIDAD[e] ?? e,
            }))}
            value={entidad}
            onChange={(e) => {
              setEntidad(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <TextField
          label="Desde"
          type="date"
          value={desde}
          onChange={(e) => {
            setDesde(e.target.value);
            setPage(1);
          }}
        />
        <TextField
          label="Hasta"
          type="date"
          value={hasta}
          onChange={(e) => {
            setHasta(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <DataTable
        columnas={columnas}
        filas={items}
        idDe={(r) => r.id}
        cargando={isLoading}
        vacio={{
          titulo: "Sin registros",
          descripcion: "No hay operaciones auditadas para este filtro.",
          icono: "history",
        }}
      />
      <Pagination page={page} pageSize={pageSize} total={total} onPage={setPage} />

      {detalle && (
        <Dialog
          abierto
          onClose={() => setDetalle(null)}
          titulo={`${detalle.accion} · ${ETIQUETA_ENTIDAD[detalle.entidad] ?? detalle.entidad}`}
          descripcion={`${fmtFecha(detalle.timestamp)} · ${detalle.actorNombre}`}
          ancho="lg"
        >
          <div className="flex flex-col gap-space-md">
            <dl className="grid grid-cols-[auto_1fr] gap-x-space-md gap-y-space-2xs text-body-sm">
              <dt className="text-on-surface-variant">Identificador</dt>
              <dd className="text-on-surface">{detalle.entidadId}</dd>
              {detalle.motivo && (
                <>
                  <dt className="text-on-surface-variant">Motivo</dt>
                  <dd className="text-on-surface">{detalle.motivo}</dd>
                </>
              )}
            </dl>
            <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-2">
              <SnapshotBloque titulo="Antes" valor={detalle.antes} />
              <SnapshotBloque titulo="Después" valor={detalle.despues} />
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function SnapshotBloque({ titulo, valor }: { titulo: string; valor: unknown }) {
  return (
    <div className="flex flex-col gap-space-2xs">
      <span className="text-label-md text-on-surface-variant">{titulo}</span>
      <pre className="max-h-72 overflow-auto rounded-lg bg-surface-container-low p-space-sm text-body-sm text-on-surface">
        {valor == null ? "—" : JSON.stringify(valor, null, 2)}
      </pre>
    </div>
  );
}
