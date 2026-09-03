import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  requerido?: boolean;
  /** Recibe los ids a cablear en el control: `id`, `aria-describedby`, `aria-invalid`. */
  children: (props: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": boolean | undefined;
  }) => ReactNode;
  className?: string;
}

/** Envoltorio label + hint + error accesible (WCAG 1.3.1, 3.3.1). */
export function Field({ label, hint, error, requerido, children, className }: FieldProps) {
  const base = useId();
  const id = `${base}-control`;
  const hintId = hint ? `${base}-hint` : undefined;
  const errorId = error ? `${base}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-space-2xs", className)}>
      <label htmlFor={id} className="text-label-lg text-on-surface">
        {label}
        {requerido && (
          <span className="text-error" aria-hidden>
            {" *"}
          </span>
        )}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint && !error && (
        <p id={hintId} className="text-body-sm text-on-surface-variant">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="flex items-center gap-space-2xs text-body-sm text-error" role="alert">
          <span className="material-symbols-outlined text-[14px]" aria-hidden>
            error
          </span>
          {error}
        </p>
      )}
    </div>
  );
}

export const inputBase =
  "w-full min-h-11 rounded-lg bg-surface-container-low px-space-sm text-body-md text-on-surface " +
  "placeholder:text-outline focus:bg-surface-container-lowest focus:outline-2 focus:outline-primary " +
  "aria-[invalid=true]:outline-2 aria-[invalid=true]:outline-error transition-colors";
