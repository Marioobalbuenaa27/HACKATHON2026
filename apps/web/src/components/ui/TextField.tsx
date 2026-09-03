import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Field, inputBase } from "./Field";

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  hint?: string;
  error?: string;
  requerido?: boolean;
  icono?: string;
}

export function TextField({
  label,
  hint,
  error,
  requerido,
  icono,
  className,
  ...input
}: TextFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} requerido={requerido}>
      {(a11y) => (
        <div className="relative flex items-center">
          {icono && (
            <span
              className="material-symbols-outlined pointer-events-none absolute left-3 text-[20px] text-outline"
              aria-hidden
            >
              {icono}
            </span>
          )}
          <input
            {...a11y}
            {...input}
            className={cn(inputBase, icono && "pl-10", className)}
          />
        </div>
      )}
    </Field>
  );
}
