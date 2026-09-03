import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tono = "neutral" | "exito" | "aviso" | "error" | "info";

const TONOS: Record<Tono, string> = {
  neutral: "bg-surface-container-high text-on-surface-variant",
  exito: "bg-secondary-container text-on-secondary-container",
  aviso: "bg-primary-fixed text-on-primary-fixed",
  error: "bg-error-container text-on-error-container",
  info: "bg-tertiary-fixed text-on-tertiary-fixed",
};

export function Badge({
  tono = "neutral",
  icono,
  children,
  className,
}: {
  tono?: Tono;
  icono?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-label-sm",
        TONOS[tono],
        className,
      )}
    >
      {icono && (
        <span className="material-symbols-outlined text-[13px]" aria-hidden>
          {icono}
        </span>
      )}
      {children}
    </span>
  );
}
