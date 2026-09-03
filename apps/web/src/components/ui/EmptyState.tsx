import type { ReactNode } from "react";

export function EmptyState({
  titulo,
  descripcion,
  icono = "inbox",
  accion,
}: {
  titulo: string;
  descripcion?: string;
  icono?: string;
  accion?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-space-xs rounded-xl border border-dashed border-outline-variant bg-surface-container-low px-space-md py-space-2xl text-center">
      <span className="material-symbols-outlined text-[32px] text-on-surface-variant" aria-hidden>
        {icono}
      </span>
      <p className="text-headline-sm text-on-surface">{titulo}</p>
      {descripcion && <p className="max-w-sm text-body-sm text-on-surface-variant">{descripcion}</p>}
      {accion && <div className="mt-space-xs">{accion}</div>}
    </div>
  );
}
