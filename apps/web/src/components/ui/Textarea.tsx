import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Field, inputBase } from "./Field";

interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  label: string;
  hint?: string;
  error?: string;
  requerido?: boolean;
}

export function Textarea({ label, hint, error, requerido, className, ...ta }: TextareaProps) {
  return (
    <Field label={label} hint={hint} error={error} requerido={requerido}>
      {(a11y) => (
        <textarea
          {...a11y}
          {...ta}
          className={cn(inputBase, "min-h-24 resize-y py-space-xs", className)}
        />
      )}
    </Field>
  );
}
