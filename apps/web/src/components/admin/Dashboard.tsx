"use client";

import Link from "next/link";
import { useLista } from "@/lib/http/hooks";
import { puedeVer } from "@/lib/permisos";
import { ETIQUETA_ROL, type Perfil } from "@/lib/http/tipos";
import { NAV } from "./navegacion";
import { PageHeader } from "@/components/ui/PageHeader";

function Tarjeta({ href, label, icono }: { href: string; label: string; icono: string }) {
  const { total, isLoading } = useLista<unknown>(`${href.replace("/admin", "/api/admin")}?pageSize=1`);
  return (
    <Link
      href={href}
      className="flex flex-col gap-space-xs rounded-xl bg-surface-container-lowest p-space-md shadow-sm transition-colors hover:bg-surface-container-low"
    >
      <span className="flex items-center gap-space-xs text-on-surface-variant">
        <span className="material-symbols-outlined text-[22px] text-primary" aria-hidden>
          {icono}
        </span>
        <span className="text-label-lg text-on-surface">{label}</span>
      </span>
      <span className="text-display-lg-mobile text-on-surface">
        {isLoading ? "—" : total}
      </span>
      <span className="text-body-sm text-on-surface-variant">registros activos</span>
    </Link>
  );
}

export function Dashboard({ actor }: { actor: Perfil }) {
  const tarjetas = NAV.filter(
    (i) => i.seccion !== "dashboard" && puedeVer(actor.rol, i.seccion),
  );

  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        titulo={`Hola, ${actor.nombre.split(" ")[0] || actor.nombre}`}
        descripcion={`Sesión iniciada como ${ETIQUETA_ROL[actor.rol]}.`}
      />

      <section className="grid grid-cols-1 gap-space-sm sm:grid-cols-2 lg:grid-cols-3">
        {tarjetas.map((t) => (
          <Tarjeta key={t.href} href={t.href} label={t.label} icono={t.icono} />
        ))}
      </section>

      <p className="text-body-sm text-on-surface-variant">
        Las agendas (franjas y excepciones), la generación de slots, los parámetros del
        sistema y la auditoría se incorporan en la próxima entrega.
      </p>
    </div>
  );
}
