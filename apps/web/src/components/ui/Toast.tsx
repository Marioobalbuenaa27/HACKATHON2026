"use client";

// Toasts accesibles (`aria-live`). Se monta una vez en el layout del panel.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Tono = "exito" | "error" | "info";

interface Toast {
  id: number;
  tono: Tono;
  texto: string;
}

interface ToastAPI {
  exito: (texto: string) => void;
  error: (texto: string) => void;
  info: (texto: string) => void;
}

const ToastContext = createContext<ToastAPI | null>(null);

const ICONO: Record<Tono, string> = {
  exito: "check_circle",
  error: "error",
  info: "info",
};

const ESTILO: Record<Tono, string> = {
  exito: "bg-secondary-container text-on-secondary-container",
  error: "bg-error-container text-on-error-container",
  info: "bg-surface-container-high text-on-surface",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const quitar = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tono: Tono, texto: string) => {
      const id = ++seq.current;
      setToasts((prev) => [...prev, { id, tono, texto }]);
      window.setTimeout(() => quitar(id), tono === "error" ? 7000 : 4000);
    },
    [quitar],
  );

  const api = useMemo<ToastAPI>(
    () => ({
      exito: (t) => push("exito", t),
      error: (t) => push("error", t),
      info: (t) => push("info", t),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-space-md right-space-md z-[100] flex w-[min(92vw,24rem)] flex-col gap-space-xs"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tono === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex items-start gap-space-xs rounded-xl px-space-sm py-space-xs shadow-md ${ESTILO[t.tono]}`}
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden>
              {ICONO[t.tono]}
            </span>
            <p className="flex-1 text-body-sm">{t.texto}</p>
            <button
              type="button"
              onClick={() => quitar(t.id)}
              aria-label="Cerrar notificación"
              className="material-symbols-outlined text-[18px] opacity-70 hover:opacity-100"
            >
              close
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastAPI {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>.");
  return ctx;
}
