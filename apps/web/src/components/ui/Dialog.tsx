"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface DialogProps {
  abierto: boolean;
  onClose: () => void;
  titulo: string;
  descripcion?: string;
  children: ReactNode;
  /** Pie fijo (botones de acción). */
  acciones?: ReactNode;
  ancho?: "sm" | "md" | "lg";
}

const ANCHOS = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" } as const;

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Dialog({
  abierto,
  onClose,
  titulo,
  descripcion,
  children,
  acciones,
  ancho = "md",
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previoRef = useRef<HTMLElement | null>(null);
  const tituloId = useId();
  const descId = useId();

  useEffect(() => {
    if (!abierto) return;
    previoRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && panel) {
        const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (focusables.length === 0) return;
        const primero = focusables[0];
        const ultimo = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === primero) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primero.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previoRef.current?.focus?.();
    };
  }, [abierto, onClose]);

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-inverse-surface/40 p-0 sm:items-center sm:p-space-md"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={descripcion ? descId : undefined}
        className={cn(
          "flex max-h-[92vh] w-full flex-col rounded-t-xl bg-surface-container-lowest shadow-lg sm:rounded-xl",
          ANCHOS[ancho],
        )}
      >
        <div className="flex items-start justify-between gap-space-sm border-b border-outline-variant p-space-md">
          <div className="flex flex-col gap-space-2xs">
            <h2 id={tituloId} className="text-headline-sm text-on-surface">
              {titulo}
            </h2>
            {descripcion && (
              <p id={descId} className="text-body-sm text-on-surface-variant">
                {descripcion}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="material-symbols-outlined -m-1 rounded-full p-1 text-on-surface-variant hover:bg-surface-container-low"
          >
            close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-space-md">{children}</div>

        {acciones && (
          <div className="flex justify-end gap-space-xs border-t border-outline-variant p-space-md">
            {acciones}
          </div>
        )}
      </div>
    </div>
  );
}
