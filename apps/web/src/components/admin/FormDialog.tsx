"use client";

import type { FormEvent, ReactNode } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

interface FormDialogProps {
  abierto: boolean;
  onClose: () => void;
  titulo: string;
  descripcion?: string;
  /** Devolver `true` para cerrar el diálogo (éxito). */
  onSubmit: () => Promise<boolean> | boolean;
  cargando?: boolean;
  children: ReactNode;
  textoGuardar?: string;
  ancho?: "sm" | "md" | "lg";
  /** Error general no asociado a un campo. */
  errorGeneral?: string;
}

export function FormDialog({
  abierto,
  onClose,
  titulo,
  descripcion,
  onSubmit,
  cargando = false,
  children,
  textoGuardar = "Guardar",
  ancho = "md",
  errorGeneral,
}: FormDialogProps) {
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await onSubmit();
    if (ok) onClose();
  };

  return (
    <Dialog
      abierto={abierto}
      onClose={onClose}
      titulo={titulo}
      descripcion={descripcion}
      ancho={ancho}
      acciones={
        <>
          <Button variante="text" onClick={onClose} disabled={cargando}>
            Cancelar
          </Button>
          <Button type="submit" form="form-dialog" cargando={cargando}>
            {textoGuardar}
          </Button>
        </>
      }
    >
      <form id="form-dialog" onSubmit={submit} className="flex flex-col gap-space-md">
        {errorGeneral && (
          <p
            role="alert"
            className="flex items-center gap-space-xs rounded-lg bg-error-container px-space-sm py-space-xs text-body-sm text-on-error-container"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              error
            </span>
            {errorGeneral}
          </p>
        )}
        {children}
      </form>
    </Dialog>
  );
}
