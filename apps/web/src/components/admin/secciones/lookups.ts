"use client";

// Lookups compartidos por las secciones de agendas: catálogos base cacheados por
// SWR y mapas id → etiqueta para renderizar los listados de franjas/excepciones/slots.

import { useMemo } from "react";
import { useLista } from "@/lib/http/hooks";
import type { Especialidad, Profesional, Sala } from "@/lib/http/tipos";

function mapa<T extends { id: string }>(items: T[], etiqueta: (item: T) => string) {
  const m: Record<string, string> = {};
  for (const it of items) m[it.id] = etiqueta(it);
  return m;
}

export function useProfesionales(incluirInactivos = false) {
  const q = incluirInactivos ? "&incluirInactivos=true" : "";
  const { items } = useLista<Profesional>(`/api/admin/profesionales?pageSize=100${q}`);
  const nombre = useMemo(
    () => mapa(items, (p) => `${p.apellido}, ${p.nombre}`),
    [items],
  );
  return { profesionales: items, nombreProfesional: nombre };
}

export function useEspecialidades() {
  const { items } = useLista<Especialidad>("/api/admin/especialidades?pageSize=100");
  const nombre = useMemo(() => mapa(items, (e) => e.nombre), [items]);
  return { especialidades: items, nombreEspecialidad: nombre };
}

export function useSalas() {
  const { items } = useLista<Sala>("/api/admin/salas?pageSize=100");
  const nombre = useMemo(() => mapa(items, (s) => s.identificador), [items]);
  return { salas: items, nombreSala: nombre };
}
