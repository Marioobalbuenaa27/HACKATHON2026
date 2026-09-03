import { useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type"> {
  label: string;
  hint?: string;
}

export function Checkbox({ label, hint, className, ...input }: CheckboxProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-space-2xs">
      <label htmlFor={id} className="flex cursor-pointer items-center gap-space-xs select-none">
        <input
          id={id}
          type="checkbox"
          aria-describedby={hintId}
          className={cn(
            "h-4 w-4 cursor-pointer accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            className,
          )}
          {...input}
        />
        <span className="text-body-md text-on-surface">{label}</span>
      </label>
      {hint && (
        <p id={hintId} className="pl-6 text-body-sm text-on-surface-variant">
          {hint}
        </p>
      )}
    </div>
  );
}
