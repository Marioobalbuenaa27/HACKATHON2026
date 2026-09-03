import type { ReactNode } from "react";

export function PageHeader({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-space-sm">
      <div className="flex flex-col gap-space-2xs">
        <h1 className="text-headline-lg text-on-surface">{titulo}</h1>
        {descripcion && (
          <p className="text-body-md text-on-surface-variant">{descripcion}</p>
        )}
      </div>
      {accion}
    </div>
  );
}
