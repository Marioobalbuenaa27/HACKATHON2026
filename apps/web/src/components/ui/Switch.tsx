import { useId } from "react";
import { cn } from "@/lib/cn";

interface SwitchProps {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (valor: boolean) => void;
  disabled?: boolean;
}

export function Switch({ label, hint, checked, onChange, disabled }: SwitchProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-space-2xs">
      <div className="flex items-center justify-between gap-space-sm">
        <label htmlFor={id} className="text-label-lg text-on-surface">
          {label}
        </label>
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-describedby={hintId}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50",
            checked ? "bg-primary" : "bg-surface-container-highest",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-surface-container-lowest shadow-sm transition-transform",
              checked ? "translate-x-[22px]" : "translate-x-0.5",
            )}
          />
        </button>
      </div>
      {hint && (
        <p id={hintId} className="text-body-sm text-on-surface-variant">
          {hint}
        </p>
      )}
    </div>
  );
}
