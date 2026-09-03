# Plan de acción — Fase 2: Operación del día

**Estado:** En curso. Base parcial en `main` (Agustina Solis, commits "panel paciente"). Reconciliada con el spec el 2026-09-03 (decisiones D-1..D-10, ver [spec §Decisiones tomadas](specs/fase-2-operacion-del-dia.md)).

## Punto de partida (lo que ya está en `main`)

| Hito original | Estado al merge | Nota de reconciliación |
|---|---|---|
| 1. Modelo y migración | Hecho, con divergencias | Falta `Paciente` (D-1), `canal`/`intentos` en `EventoNotificable` (D-10), parámetros del spec (D-8). |
| 2. Casos de uso transaccionales | Parcial | `crearTurnoInterno`, `cambiarEstadoTurno`, `registrarDemandaEspontanea`, `marcarAusenciaProfesional`, `desplazarTurno`, `resolverCasoReprogramacion` en `operacion.ts`. Sin check-in, sin cancelación, sin confirmación de desplazamiento, sin tests. |
| 3. API de operación | Parcial | 11 rutas admin. Falta filtros/paginación, check-in, cancelar, confirmar/rechazar desplazamiento, huecos, formulario guiado. |
| 4. Pantallas operativas | Mínimo | `AdminConsole.tsx` (cola, admisión, reprogramaciones). Sin reserva manual, sin selección de hueco, `window.prompt`. |
| 5. Reportes y CSV | Placeholder | Un endpoint con CSV crudo. Rehacer según D-4. |
| 6. Hardening | Pendiente | Accesibilidad, PII, concurrencia, tests. |

## Estrategia

Cada mutación se implementa como caso de uso de servidor + prueba de integración; rutas y pantallas solo lo consumen. Slot y turno se modifican en la misma transacción; auditoría y outbox se escriben dentro de esa transacción. La máquina de estados, el orden de la cola y la evaluación de prioridad del formulario guiado se aíslan en funciones puras testeables sin DB (NFR-M2, NFR-M3).

El trabajo de Fase 3 ya adelantado (`ReservaTemporal`, `ciudadano.ts`, `notificaciones.ts`, `/turnos`, crons) **se deja en `main`** y se formaliza en el spec de Fase 3 (D-5). No es parte de este plan.

## Secuencia de trabajo

Cada bloque debería ser uno o dos PRs con sus tests.

### Bloque A — cimientos y bugs (P0)

1. **A1 · Bug orden de cola.** Peso numérico de `PrioridadOperativa` (URGENTE > PRIORITARIO > PREFERENCIAL > NORMAL); orden cola = prioridad desc → `horaProgramada` → `horaLlegada`/check-in → `createdAt`. Función pura `ordenarCola(turnos)` + test. (FR-14)
2. **A2 · Bug regla 24 h.** En `desplazarTurno`, comparar el horario del **turno origen** (`fecha` + `horaProgramada` en zona AR) contra `now`, no `slotDestino.inicioUtc`. Usar el parámetro `ventana_desplazamiento_horas` (ver A4). (FR-37)
3. **A3 · Entidad `Paciente` (D-1).** Modelo `Paciente` (`dni` único, `nombre`, `fechaNacimiento`, `obraSocialId?`/`obraSocialOtra?`, `contadorAusencias`). Migración: crear pacientes a partir de los `Turno` existentes (dedupe por `pacienteDni`), agregar `Turno.pacienteId`, backfill, dejar los campos `paciente*` embebidos como snapshot o quitarlos (decidir en el PR). `cambiarEstadoTurno` a `AUSENTE` incrementa `contadorAusencias`; job/función de reconciliación (NFR-R5). (FR-1, FR-5)
4. **A4 · Parámetros del spec (D-8).** Renombrar `tope_sobreturnos_por_profesional_dia` → `tope_sobreturnos_dia` (default 3, 0..20). Agregar `ventana_desplazamiento_horas` (24, 0..168) y `limite_turnos_activos_por_especialidad` (1, 1..10). Migración de datos + seed idempotente + validación de rango + solo ADMIN. (FR-45)
5. **A5 · `EventoNotificable` completo (D-10).** Agregar `canal` (`EMAIL`|`WHATSAPP`, derivado del contacto disponible) e `intentos` (int, default 0). Ajustar los `create` en `operacion.ts`. (FR-49)
6. **A6 · Tests de `operacion.ts`.** Concurrencia de slot (NFR-R1), transiciones inválidas, tope + override, ausencia → casos + BLOQUEO, desplazamiento. Aislar funciones puras.

### Bloque B — flujos operativos faltantes (P1)

7. **B1 · Check-in (D-2).** Reconciliar `PRESENTE` → `EN_ESPERA`; `checkInAt` idempotente; `POST /api/admin/turnos/[id]/check-in` (RECEPCION/COORD/ADMIN); solo fecha actual (EC-5); marca que bloquea el desplazamiento. Máquina: `CONFIRMADO→{EN_ESPERA, AUSENTE}`, `EN_ESPERA→{ATENDIDO, AUSENTE}`. (FR-15, FR-16)
8. **B2 · Ciclo de desplazamiento (D-6).** Turno nuevo en `PENDIENTE_CONFIRMACION` (nuevo estado o reusar `REPROGRAMADO_PENDIENTE_CONFIRMACION`); el origen conserva su slot. `GET /api/admin/turnos/[id]/huecos` (mismo profesional, próximo hueco primero). `POST /api/admin/desplazamientos/[id]/confirmar` y `/rechazar` (RECEPCION/COORD/ADMIN). Al confirmar: origen → `REPROGRAMADO`, slot liberado/bloqueado según FR-40; al rechazar: turno nuevo `CANCELADO`, hueco liberado. Persistir el registro consultable (reusar `CasoReprogramacion` o entidad `Desplazamiento`; decidir en el PR). (FR-35, FR-36, FR-38, FR-39, NFR-R2)
9. **B3 · BLOQUEO en ausencia de profesional (D-7).** `marcarAusenciaProfesional` crea `ExcepcionAgenda` tipo `BLOQUEO` para la fecha y pasa los slots `DISPONIBLE` del profesional/fecha a `BLOQUEADO`, en la misma transacción. Traducir la 2ª marca a 409 `AUSENCIA_YA_REGISTRADA`. (FR-18, FR-19)
10. **B4 · Formulario de admisión guiado (D-3).** Catálogo de preguntas cerradas (¿modelo nuevo o config estática? decidir). Función pura `evaluarPrioridad(respuestas): 1|2|3|4` (NFR-M3). `GET /api/admin/demanda-espontanea/preguntas`, `POST /api/admin/demanda-espontanea/evaluar`. `registrarDemandaEspontanea` guarda `nivelSugerido` + `nivelAsignado`. (FR-23, FR-24, FR-27)
11. **B5 · Canal de contacto obligatorio (D-9).** `crearTurnoSchema` y `crearDemandaSchema`: exigir `email` o (`telefono` + `telefonoEsWhatsapp`); 400 `VALIDACION`. Constraint en DB. (FR-2)
12. **B6 · Cancelación de turno.** `POST /api/admin/turnos/[id]/cancelar` (`{motivo}`); `CANCELADO` + `cancelacionTardia`; slot → `DISPONIBLE` o `BLOQUEADO` según ventana; evento `CANCELACION_HOSPITAL`; auditoría `CANCELAR`. (FR-40, FR-41)
13. **B7 · Edición de turno.** `PATCH /api/admin/turnos/[id]` — contacto del responsable y detalle del motivo, turno no finalizado. (FR-11)
14. **B8 · Búsqueda de turnos.** `GET /api/admin/turnos` con `dni`, `profesionalId`, `especialidadId`, `estado`, `desde`/`hasta`, paginación 25. Índices ya existen. (FR-6)
15. **B9 · Reglas de reserva manual.** Antelación mínima (`antelacion_minima_horas`) + `forzar` (FR-10); límite de turnos activos por especialidad (`limite_turnos_activos_por_especialidad`) + `forzar` con auditoría (FR-9).
16. **B10 · Sobreturno: guardas faltantes.** Rechazo si el profesional está ausente esa fecha → 409 `PROFESIONAL_AUSENTE` (FR-33); evento/indicador a Coordinación (FR-32).
17. **B11 · Integridad de catálogos.** Bloquear baja de profesional/especialidad/sala con turnos activos futuros; error con la lista de turnos bloqueantes. (FR-51)
18. **B12 · Códigos de error + auditoría.** Traducir constraints a códigos del spec; sumar `CHECK_IN` y `CANCELAR` a la auditoría; snapshot antes/después. (FR-46, divergencia 10)

### Bloque C — reportes (P1-final, D-4)

19. **C1 · `turnos-por-dia`** con % de ausentismo + **`ocupacion-profesional`**. JSON + CSV (UTF-8 con BOM, `;`/`,` según convención de Fase 1, encabezados en español), `?formato=csv`, `Content-Disposition` con fechas, 400 `RANGO_INVALIDO` (> 366 días o `hasta` < `desde`). (FR-42a/d, FR-43, FR-44)
20. **C2 · (cierre)** Los otros tres reportes de FR-42: demanda por especialidad+categoría, sobreturnos+desplazamientos, demanda espontánea por franja horaria.

### Bloque D — UI

21. **D1 · Reserva manual sobre slot** en la consola (buscar slot disponible → cargar paciente + responsable + categoría → confirmar).
22. **D2 · Formulario de admisión guiado** (preguntas → nivel sugerido → ajuste con motivo → registra demanda/sobreturno).
23. **D3 · Selección de hueco** al desplazar y al resolver reprogramación (hoy toma el primero).
24. **D4 · Accesibilidad:** reemplazar `window.prompt` por diálogos con foco, labels y `aria-live` (NFR-A1, A2); estado y prioridad por texto/ícono además de color (NFR-A3).
25. **D5 · Alinear con `mockups-html/`.**

## Criterio de cierre de la Fase 2

- Bloques A y B completos con tests verdes; C1 completo.
- Los AC del Apéndice A del spec (reconciliados con los nombres de estado actuales) pasan como suite de integración.
- Sin reglas hardcodeadas (ventana de desplazamiento, tope de sobreturnos).
- `pnpm test` en verde incluyendo los 65 de Fase 1.
- C2, y el trabajo de Fase 3 adelantado, quedan fuera y se planifican aparte.
