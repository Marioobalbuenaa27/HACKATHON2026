import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variante = "filled" | "tonal" | "text" | "danger" | "outline";

const VARIANTES: Record<Variante, string> = {
  filled: "bg-primary text-on-primary hover:opacity-95 disabled:opacity-50",
  tonal:
    "bg-secondary-container text-on-secondary-container hover:opacity-90 disabled:opacity-50",
  outline:
    "border border-outline-variant text-on-surface hover:bg-surface-container-low disabled:opacity-50",
  text: "text-primary hover:bg-surface-container-low disabled:opacity-50",
  danger: "bg-error text-on-error hover:opacity-95 disabled:opacity-50",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  cargando?: boolean;
  icono?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variante = "filled", cargando = false, icono, className, children, disabled, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-space-2xs rounded-lg px-space-md text-label-lg",
        "transition-[opacity,background-color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "disabled:cursor-not-allowed",
        VARIANTES[variante],
        className,
      )}
      {...rest}
    >
      <span
        className={cn(
          "material-symbols-outlined text-[18px]",
          cargando ? "animate-spin" : !icono && "hidden",
        )}
        aria-hidden
      >
        {cargando ? "progress_activity" : icono}
      </span>
      {children}
    </button>
  );
});
