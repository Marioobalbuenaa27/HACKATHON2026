"use client";

import { useState } from "react";
import { Dialog } from "./Dialog";
import { Button } from "./Button";

interface ConfirmDialogProps {
  abierto: boolean;
  onClose: () => void;
  onConfirmar: () => Promise<unknown> | void;
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  peligroso?: boolean;
}

export function ConfirmDialog({
  abierto,
  onClose,
  onConfirmar,
  titulo,
  mensaje,
  textoConfirmar = "Confirmar",
  peligroso = false,
}: ConfirmDialogProps) {
  const [cargando, setCargando] = useState(false);

  const confirmar = async () => {
    setCargando(true);
    try {
      await onConfirmar();
      onClose();
    } finally {
      setCargando(false);
    }
  };

  return (
    <Dialog
      abierto={abierto}
      onClose={onClose}
      titulo={titulo}
      ancho="sm"
      acciones={
        <>
          <Button variante="text" onClick={onClose} disabled={cargando}>
            Cancelar
          </Button>
          <Button
            variante={peligroso ? "danger" : "filled"}
            onClick={confirmar}
            cargando={cargando}
          >
            {textoConfirmar}
          </Button>
        </>
      }
    >
      <p className="text-body-md text-on-surface-variant">{mensaje}</p>
    </Dialog>
  );
}
