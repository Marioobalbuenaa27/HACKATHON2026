import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Field, inputBase } from "./Field";

export interface OpcionSelect {
  value: string;
  label: string;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "children"> {
  label: string;
  hint?: string;
  error?: string;
  requerido?: boolean;
  opciones: OpcionSelect[];
  placeholder?: string;
}

export function Select({
  label,
  hint,
  error,
  requerido,
  opciones,
  placeholder,
  className,
  ...sel
}: SelectProps) {
  return (
    <Field label={label} hint={hint} error={error} requerido={requerido}>
      {(a11y) => (
        <select {...a11y} {...sel} className={cn(inputBase, "pr-8", className)}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {opciones.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}
