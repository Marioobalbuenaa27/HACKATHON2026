"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/http/cliente";
import { puedeVer } from "@/lib/permisos";
import { ETIQUETA_ROL, type Perfil } from "@/lib/http/tipos";
import { NAV } from "./navegacion";
import { cn } from "@/lib/cn";

const GRUPOS = ["General", "Catálogos", "Agendas", "Administración"] as const;

export function AdminShell({
  actor,
  children,
}: {
  actor: Perfil;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [cerrando, setCerrando] = useState(false);

  const visibles = NAV.filter((i) => puedeVer(actor.rol, i.seccion));

  const activo = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const cerrarSesion = async () => {
    setCerrando(true);
    try {
      await api.post("/api/admin/auth/logout");
    } catch {
      /* la cookie igual se limpia server-side; seguimos */
    }
    router.replace("/admin/login");
    router.refresh();
  };

  const nav = (
    <nav className="flex flex-1 flex-col gap-space-md overflow-y-auto p-space-sm">
      {GRUPOS.map((grupo) => {
        const items = visibles.filter((i) => i.grupo === grupo);
        if (items.length === 0) return null;
        return (
          <div key={grupo} className="flex flex-col gap-space-2xs">
            <p className="px-space-sm pt-space-2xs text-label-sm uppercase tracking-wide text-on-surface-variant">
              {grupo}
            </p>
            {items.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                onClick={() => setMenuAbierto(false)}
                aria-current={activo(i.href) ? "page" : undefined}
                className={cn(
                  "flex items-center gap-space-sm rounded-lg px-space-sm py-space-xs text-label-lg transition-colors",
                  activo(i.href)
                    ? "bg-secondary-container text-on-secondary-container"
                    : "text-on-surface hover:bg-surface-container-high",
                )}
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden>
                  {i.icono}
                </span>
                {i.label}
              </Link>
            ))}
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-outline-variant bg-surface-container-low lg:flex">
        <MarcaInstitucional />
        {nav}
      </aside>

      {/* Drawer mobile */}
      {menuAbierto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-inverse-surface/40"
            onClick={() => setMenuAbierto(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col bg-surface-container-low shadow-lg">
            <MarcaInstitucional />
            {nav}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-space-sm border-b border-outline-variant bg-surface/90 px-margin-mobile backdrop-blur-xl">
          <button
            type="button"
            aria-label="Abrir menú"
            onClick={() => setMenuAbierto(true)}
            className="material-symbols-outlined rounded-full p-1 text-on-surface lg:hidden"
          >
            menu
          </button>
          <div className="min-w-0 flex-1 lg:hidden">
            <span className="text-label-sm uppercase text-primary">Hospital Pediátrico Central</span>
          </div>
          <div className="flex items-center gap-space-sm">
            <div className="hidden flex-col items-end sm:flex">
              <span className="text-label-lg text-on-surface">{actor.nombre}</span>
              <span className="text-label-sm text-on-surface-variant">
                {ETIQUETA_ROL[actor.rol]}
              </span>
            </div>
            <button
              type="button"
              onClick={cerrarSesion}
              disabled={cerrando}
              className="inline-flex min-h-11 items-center gap-space-2xs rounded-lg px-space-sm text-label-lg text-on-surface hover:bg-surface-container-high disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden>
                logout
              </span>
              <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-margin-mobile py-space-lg lg:px-margin-desktop">
          {children}
        </main>
      </div>
    </div>
  );
}

function MarcaInstitucional() {
  return (
    <div className="flex flex-col gap-space-2xs border-b border-outline-variant px-space-md py-space-md">
      <span className="text-label-sm uppercase tracking-wide text-primary">
        Hospital Pediátrico Central
      </span>
      <span className="text-headline-sm text-on-surface">Turnero JP</span>
      <span className="text-body-sm text-on-surface-variant">Panel administrativo</span>
    </div>
  );
}
