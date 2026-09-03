"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

export interface OpcionMulti {
  value: string;
  label: string;
}

interface MultiSelectProps {
  label: string;
  hint?: string;
  error?: string;
  requerido?: boolean;
  opciones: OpcionMulti[];
  seleccionados: string[];
  onChange: (ids: string[]) => void;
}

/** Selección múltiple con chips toggle. Accesible por teclado (botones). */
export function MultiSelect({
  label,
  hint,
  error,
  requerido,
  opciones,
  seleccionados,
  onChange,
}: MultiSelectProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  const toggle = (value: string) => {
    onChange(
      seleccionados.includes(value)
        ? seleccionados.filter((v) => v !== value)
        : [...seleccionados, value],
    );
  };

  return (
    <div className="flex flex-col gap-space-2xs">
      <span className="text-label-lg text-on-surface">
        {label}
        {requerido && (
          <span className="text-error" aria-hidden>
            {" *"}
          </span>
        )}
      </span>
      <div
        role="group"
        aria-label={label}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        className="flex flex-wrap gap-space-2xs rounded-lg bg-surface-container-low p-space-xs"
      >
        {opciones.length === 0 && (
          <span className="px-space-2xs py-space-2xs text-body-sm text-on-surface-variant">
            No hay opciones disponibles.
          </span>
        )}
        {opciones.map((o) => {
          const activo = seleccionados.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={activo}
              onClick={() => toggle(o.value)}
              className={cn(
                "inline-flex items-center gap-space-2xs rounded-full px-space-sm py-space-2xs text-label-md transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                activo
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest",
              )}
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden>
                {activo ? "check" : "add"}
              </span>
              {o.label}
            </button>
          );
        })}
      </div>
      {hint && !error && (
        <p id={hintId} className="text-body-sm text-on-surface-variant">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-body-sm text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
