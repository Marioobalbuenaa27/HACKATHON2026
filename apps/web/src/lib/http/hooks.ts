"use client";

// Capa de datos sobre SWR para los listados de `/api/admin` y un helper de mutación.

import { useCallback, useState } from "react";
import useSWR, { mutate as mutateGlobal, type SWRConfiguration } from "swr";
import { api, ApiError } from "./cliente";
import type { Paginated } from "./tipos";
import { useToast } from "@/components/ui/Toast";

const fetcher = <T>(path: string) => api.get<T>(path);

export interface UseListaResultado<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  isLoading: boolean;
  error: ApiError | undefined;
  refrescar: () => void;
}

/** Listado paginado. `path` es la key de SWR: al cambiar los filtros/página, revalida. */
export function useLista<T>(path: string | null, config?: SWRConfiguration): UseListaResultado<T> {
  const { data, error, isLoading, mutate } = useSWR<Paginated<T>>(path, fetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
    ...config,
  });

  return {
    items: data?.items ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    pageSize: data?.pageSize ?? 25,
    isLoading,
    error: error as ApiError | undefined,
    refrescar: () => void mutate(),
  };
}

/** Recurso simple (objeto, no lista): parámetros, perfil, etc. */
export function useRecurso<T>(path: string | null, config?: SWRConfiguration) {
  const { data, error, isLoading, mutate } = useSWR<T>(path, fetcher, {
    revalidateOnFocus: false,
    ...config,
  });
  return {
    data,
    error: error as ApiError | undefined,
    isLoading,
    refrescar: () => void mutate(),
  };
}

interface OpcionesMutacion<TArgs extends unknown[], TRes> {
  /** Prefijos de key SWR a revalidar tras el éxito (ej. "/api/admin/especialidades"). */
  invalida?: string[];
  /** Mensaje de toast de éxito, o función que lo deriva del resultado. */
  exito?: string | ((res: TRes, ...args: TArgs) => string);
  onSuccess?: (res: TRes, ...args: TArgs) => void;
}

export interface UseMutacionResultado<TArgs extends unknown[], TRes> {
  ejecutar: (...args: TArgs) => Promise<TRes | undefined>;
  cargando: boolean;
  error: ApiError | undefined;
  limpiarError: () => void;
}

/**
 * Envuelve una llamada de escritura: expone estado de carga/error, revalida las
 * keys afectadas y dispara toasts. El error de campo (400 VALIDACION) queda en
 * `error.details` para que el formulario lo mapee; el resto se muestra como toast.
 */
export function useMutacion<TArgs extends unknown[], TRes>(
  fn: (...args: TArgs) => Promise<TRes>,
  opciones: OpcionesMutacion<TArgs, TRes> = {},
): UseMutacionResultado<TArgs, TRes> {
  const toast = useToast();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<ApiError | undefined>();

  const ejecutar = useCallback(
    async (...args: TArgs) => {
      setCargando(true);
      setError(undefined);
      try {
        const res = await fn(...args);
        for (const prefijo of opciones.invalida ?? []) {
          void mutateGlobal(
            (key) => typeof key === "string" && key.startsWith(prefijo),
            undefined,
            { revalidate: true },
          );
        }
        if (opciones.exito) {
          toast.exito(
            typeof opciones.exito === "function" ? opciones.exito(res, ...args) : opciones.exito,
          );
        }
        opciones.onSuccess?.(res, ...args);
        return res;
      } catch (e) {
        const apiErr =
          e instanceof ApiError
            ? e
            : new ApiError(0, { error: "ERROR", message: "Ocurrió un error inesperado." });
        setError(apiErr);
        // Los errores de validación por campo los pinta el formulario; el resto, toast.
        if (apiErr.status !== 400 || !apiErr.details) {
          toast.error(apiErr.message);
        }
        return undefined;
      } finally {
        setCargando(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fn, toast, JSON.stringify(opciones.invalida)],
  );

  return { ejecutar, cargando, error, limpiarError: () => setError(undefined) };
}

interface OpcionesSubmit<T> {
  invalida?: string[];
  exito?: string;
  onOk?: (res: T) => void;
}

export interface UseSubmitResultado {
  run: () => Promise<boolean>;
  cargando: boolean;
  error: ApiError | undefined;
  /** Mensaje de error de un campo concreto (400 VALIDACION), si lo hay. */
  campo: (nombre: string) => string | undefined;
  limpiarError: () => void;
}

/**
 * Helper para el submit de un formulario de alta/edición. `fn` se re-evalúa en cada
 * llamada, así que puede cerrar sobre el estado actual de los campos sin memoizar.
 * Devuelve `true` si la operación fue exitosa (para cerrar el diálogo).
 */
export function useSubmit<T>(fn: () => Promise<T>, opciones: OpcionesSubmit<T> = {}): UseSubmitResultado {
  const toast = useToast();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<ApiError | undefined>();

  const run = async () => {
    setCargando(true);
    setError(undefined);
    try {
      const res = await fn();
      for (const prefijo of opciones.invalida ?? []) {
        void mutateGlobal(
          (key) => typeof key === "string" && key.startsWith(prefijo),
          undefined,
          { revalidate: true },
        );
      }
      if (opciones.exito) toast.exito(opciones.exito);
      opciones.onOk?.(res);
      return true;
    } catch (e) {
      const apiErr =
        e instanceof ApiError
          ? e
          : new ApiError(0, { error: "ERROR", message: "Ocurrió un error inesperado." });
      setError(apiErr);
      if (apiErr.status !== 400 || !apiErr.details) toast.error(apiErr.message);
      return false;
    } finally {
      setCargando(false);
    }
  };

  const tieneDetallesDeCampo = error?.status === 400 && !!error.details;

  return {
    run,
    cargando,
    error,
    campo: (nombre) => (tieneDetallesDeCampo ? error!.detalleDe(nombre) : undefined),
    limpiarError: () => setError(undefined),
  };
}
