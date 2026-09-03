# Spec: Fase 2 — Operación del día (Turnero JP)

**Author:** Lautaro Mateo (lautaromateol@gmail.com)
**Date:** 2026-09-03 · **Actualizado:** 2026-09-03 (sincronizado con `main` + 10 decisiones de reconciliación confirmadas)
**Status:** In Progress — base parcial en `main` (commits `1a3054a`, `0b32be0`, `606846c`, autoría de Agustina Solis); decisiones D-1..D-10 tomadas; plan de cierre en `docs/plan-accion-fase-2-operacion-del-dia.md`
**Reviewers:** Lautaro Mateo — pendiente
**Related specs:** [Fase 1 — Núcleo administrativo](fase-1-nucleo-administrativo.md) (Approved), Fase 3 — Canal ciudadano web (parcialmente adelantada en el mismo lote de commits), [Fase 4 — Preparación bot WhatsApp](fase-4-preparacion-bot-whatsapp.md) (Approved)
**Documentos base:** [vision-producto.md](../vision-producto.md), [decisiones-mvp.md](../decisiones-mvp.md) §1–§4, [stack-y-fases.md](../stack-y-fases.md), [plan-accion-fase-2-operacion-del-dia.md](../plan-accion-fase-2-operacion-del-dia.md)

---

## Nota de sincronización (2026-09-03)

Este spec fue escrito como diseño previo (100/100, "In Review", sin implementar). Entre tanto, Agustina Solis subió a `main` una **implementación parcial** de la Fase 2 —y adelantó parte de la Fase 3— en tres commits ("panel paciente"). Este documento se reescribió para reflejar **lo que hay en el código hoy**, sin descartar su trabajo:

- La sección **Estado de implementación** mapea cada capacidad del spec a los archivos reales y su grado de avance.
- La sección **Divergencias** lista las decisiones de diseño donde el código se apartó del spec original y que hay que ratificar o corregir antes de seguir.
- Las secciones **Modelo de datos implementado** y **API implementada** describen el estado real del repositorio.
- **Trabajo pendiente** es la lista de tareas para cerrar la Fase 2 sobre esta base.
- El diseño original (FR/AC/modelos/contratos completos) se conserva íntegro en el **Apéndice A** como referencia de intención; sus IDs (FR-n, AC-n) se siguen usando en las tablas de estado.

---

## Decisiones tomadas (2026-09-03)

Confirmadas con el usuario tras revisar la implementación. Resuelven la sección **Divergencias** y fijan el alcance del cierre de Fase 2. No se descarta el código de Agustina: se completa y corrige sobre esa base.

| # | Tema | Decisión |
|---|---|---|
| D-1 | Entidad `Paciente` | **Se introduce ahora.** Tabla `Paciente` (DNI único, nombre, fecha de nacimiento, obra social opcional, `contadorAusencias`), migración de los datos hoy embebidos en `Turno`, `Turno.pacienteId` como FK. Recupera FR-1, FR-5, FR-9. |
| D-2 | Check-in y estados de asistencia | **Se recupera el check-in con `EN_ESPERA`** (`checkInAt` idempotente, FR-15). El check-in ordena la cola de sobreturnos por hora de llegada y **bloquea el desplazamiento** (FR-37). **No** se agrega `ATENDIENDO`: el flujo de sala queda `CONFIRMADO → EN_ESPERA → ATENDIDO` (+ `AUSENTE`). El estado `PRESENTE` actual se renombra/reconcilia a `EN_ESPERA`. |
| D-3 | Formulario de admisión guiado | **Se construye.** Motor de preguntas cerradas → nivel sugerido 1–4 como **función pura testeable** (NFR-M3), con endpoints `/api/admin/demanda-espontanea/preguntas` y `/evaluar`. Recepción confirma o ajusta el nivel antes de registrar (FR-23, FR-24). |
| D-4 | Reportes | **Mínimo viable primero:** cerrar bien (a) *turnos por día con % de ausentismo* y (d) *ocupación por profesional* (JSON + CSV con BOM, `?formato=`, validación `RANGO_INVALIDO`). Los otros tres reportes de FR-42 quedan para el final de la fase. |
| D-5 | Fase 3 adelantada | **Se formaliza en el spec de Fase 3.** El código de `ReservaTemporal`, `ciudadano.ts`, `notificaciones.ts` (envío por Resend), `/turnos`, `/privacidad` y los crons **se deja en `main`**, se escribe/retoma el spec de Fase 3 y ese trabajo se contabiliza allí. Fase 2 se cierra sin ese alcance (OS-1, OS-2 siguen vigentes para Fase 2). No se revierte nada. |
| D-6 | Desplazamiento de turno | **Ciclo completo del spec.** Turno nuevo en `PENDIENTE_CONFIRMACION`; el original conserva su slot hasta que Recepción **confirme** (endpoints confirmar/rechazar, FR-38); al confirmar se libera/bloquea el slot origen según FR-40. El sistema **propone el próximo hueco** del mismo profesional (FR-35) y permite elegir otro. Se corrige la regla de 24 h para evaluar el horario del **turno origen** (FR-37) y el bloqueo por check-in. |
| D-7 | Profesional ausente | **Se crea la excepción `BLOQUEO` de agenda** para la fecha al marcar la ausencia; los slots `DISPONIBLE` restantes del profesional/fecha pasan a `BLOQUEADO` (FR-19). |
| D-8 | Parámetros del sistema | **Alinear al spec.** Renombrar `tope_sobreturnos_por_profesional_dia` → `tope_sobreturnos_dia` (**default 3**, rango 0..20); agregar `ventana_desplazamiento_horas` (default 24, rango 0..168) y `limite_turnos_activos_por_especialidad` (default 1, rango 1..10). Todos editables solo por ADMIN (FR-45). Sacar el `24 h` hardcodeado. |
| D-9 | Canal de contacto obligatorio | **Se exige** email O (teléfono + `telefonoEsWhatsapp`) en la carga de todo turno; sin eso, 400 `VALIDACION` (FR-2). |
| D-10 | Modelo de notificaciones | **Se ajusta ahora.** `EventoNotificable` gana `canal` (`EMAIL` \| `WHATSAPP`) e `intentos` (int, default 0), para que Fase 2 escriba filas completas y Fase 3 solo sume el worker. |

Pendiente de confirmar con el usuario más adelante: reordenar/renombrar el enum `EstadoTurno` completo hacia los nombres del diseño original (`AGENDADO` en vez de `CONFIRMADO`, etc.) o mantener los nombres actuales de Agustina. Por ahora se mantienen los nombres actuales salvo `PRESENTE`→`EN_ESPERA` (D-2).

---

## Context

La Fase 1 dejó cargado el núcleo administrativo del Turnero JP: catálogos, agendas como franjas recurrentes con excepciones, y un motor que genera **slots** disponibles para las próximas semanas. La Fase 2 construye la **operación del día** para el personal del panel: reserva manual de turnos por Recepción, registro y priorización de demanda espontánea, sobreturnos, gestión de asistencia en sala, desplazamiento manual de turnos, flujo "profesional caído" y los reportes operativos con export CSV.

El problema de diseño central del producto —absorber la demanda espontánea prioritaria sin que nadie pierda su turno— se resuelve con la mecánica de [decisiones-mvp.md](../decisiones-mvp.md) §2: escala de 4 niveles de prioridad asignada por Recepción, **sobreturno por defecto**, y **desplazamiento de turno confirmado solo manual** por Coordinación, nunca automático.

**Lo que ya construyó Agustina** (rama `main`): el modelo `Turno` (con datos de paciente/responsable desnormalizados, sin entidad `Paciente`), `DemandaEspontanea`, `AusenciaProfesionalDia`, `CasoReprogramacion` y `EventoNotificable` (outbox); los casos de uso transaccionales en [operacion.ts](../../apps/web/src/lib/operacion.ts); las rutas admin de turnos, estados, demanda, ausencias, médicos de turno, reprogramaciones y un reporte CSV; y una consola operativa mínima en [AdminConsole.tsx](../../apps/web/src/app/admin/AdminConsole.tsx). Además adelantó de Fase 3: `ReservaTemporal`, `ciudadano.ts`, `notificaciones.ts` (envío real por Resend), el portal `/turnos` y tres crons.

Restricciones heredadas: Next.js App Router + TypeScript + PostgreSQL (Supabase) + Prisma; panel desktop-first, responsive básico; español de Argentina sin i18n; WCAG 2.1 AA razonable; Ley 25.326 — auditoría inmutable de acciones, sin logging de datos de pacientes; timestamps en UTC, presentación en `America/Argentina/Buenos_Aires`.

---

## Estado de implementación

Leyenda: ✅ implementado y alineado con el spec · 🟡 implementado con divergencias o parcial · ❌ no implementado.

### Modelo de datos

| Capacidad (spec) | Estado | Realidad en `main` |
|---|---|---|
| Entidad `Paciente` con DNI único, obra social, `contadorAusencias` (FR-1, FR-5) | ❌ | No existe. Los datos del paciente y del responsable están **desnormalizados dentro de `Turno`** (`pacienteNombre/Dni/Nacimiento`, `responsableNombre/Dni/Vinculo`, `telefono`, `email`). Sin obra social, sin contador de ausencias. |
| Entidad `Turno` (FR-3) | 🟡 | `model Turno` existe con casi todos los campos, pero: prioridad usa el enum nuevo `PrioridadOperativa` (no `PrioridadBase`); no hay `origen` (PANEL/ESPONTANEA), se infiere por `tipo` y por la relación `demanda`; no hay `detalleMotivo`; no hay `checkInAt` ni `cancelacionMotivo/Tardia`; no hay `reprogramadoDesdeId` (se modela con `CasoReprogramacion`). Campos extra de Fase 3: `consentimientoAceptadoAt/Version`. |
| Máquina de estados del turno (FR-4) | 🟡 | Estados: `CONFIRMADO`, `PRESENTE`, `AUSENTE`, `ATENDIDO`, `CANCELADO`, `A_REPROGRAMAR`, `REPROGRAMADO_PENDIENTE_CONFIRMACION`. **No hay** `EN_ESPERA` (check-in) ni `ATENDIENDO`. Transiciones (en `operacion.ts`): `CONFIRMADO→{PRESENTE,AUSENTE}`, `PRESENTE→{ATENDIDO,AUSENTE}`; el resto son terminales. Nada setea `CANCELADO`. |
| `DemandaEspontanea` (FR-27) | 🟡 | Existe. `respuestas` es `Json` libre (no hay motor de preguntas). Campos: `prioridadSugerida`, `prioridadConfirmada`, `motivoAjuste`, `derivadaAGuardia`, `horaLlegada`. Sin `pacienteId` (no hay Paciente), sin `registradoPorId` (queda solo en auditoría). |
| `Desplazamiento` como entidad con estados `PROPUESTO/CONFIRMADO/RECHAZADO` (FR-39) | ❌ | No existe. Desplazamiento y "profesional caído" comparten `CasoReprogramacion` (`turnoOrigenId`, `turnoDestinoId`, `estado` PENDIENTE/RESUELTO, `motivo`, `resueltoPorId`). Sin hueco propuesto, sin paso de confirmación/rechazo. |
| `AusenciaProfesional` + `ItemReprogramacion` (FR-18, FR-19) | 🟡 | `AusenciaProfesionalDia` (`profesionalId`+`fecha` único, `motivo`, `marcadaPorId`). La "lista de trabajo" son los `CasoReprogramacion` con `estado=PENDIENTE`. **No crea** una excepción `BLOQUEO` de agenda: los slots libres del profesional ausente siguen `DISPONIBLE`. |
| `Notificacion` cola persistente, canal EMAIL/WHATSAPP, `intentos` (FR-49) | 🟡 | `EventoNotificable` (`turnoId` NOT NULL, `tipo`, `destinatario`, `payload` Json, `estado` PENDIENTE/ENTREGADO/FALLIDO, `procesadoAt`). Sin `canal`, sin `intentos`. Tipos: `REPROGRAMACION_INICIADA`, `TURNO_REPROGRAMADO`, `SOBRETURNO_CREADO`, `CAMBIO_ESTADO_TURNO`. |
| `Slot.estado = OCUPADO` (FR-8) | ✅ | Agregado. `crearTurnoInterno` hace `DISPONIBLE→OCUPADO` con `updateMany` condicional (toma atómica). |
| `Profesional.topeSobreturnosDia` | ❌ | No existe; el tope es solo global. |
| Parámetro de tope de sobreturnos (FR-45) | 🟡 | Se llama **`tope_sobreturnos_por_profesional_dia`** (no `tope_sobreturnos_dia`), default **2** (no 3), rango 0–10 (no 0–20). No se agregaron `ventana_desplazamiento_horas` ni `limite_turnos_activos_por_especialidad` (la ventana de 24 h está hardcodeada). |
| Migraciones Prisma versionadas (NFR-M1) | ✅ | `20260904150000_fase_2_operacion_del_dia`, `20260904170000_evento_cambio_estado`, `20260905090000_fase_3_canal_ciudadano`. |

### Casos de uso y API

| Capacidad (spec) | Estado | Realidad en `main` |
|---|---|---|
| Reserva manual: `POST /api/admin/turnos` (FR-7, FR-8) | 🟡 | `crearTurnoInterno`. Toma el slot atómicamente y crea el turno. **No valida** antelación mínima (FR-10), ni límite de turnos activos por especialidad (FR-9), ni `forzar`. Rechaza categoría con `derivarAGuardia`. Prioridad = `categoria.prioridadBase`. |
| Buscar/listar turnos con filtros y paginación (FR-6) | 🟡 | `GET /api/admin/turnos` solo filtra por `fecha` (y por `profesionalId` propio si el rol es PROFESIONAL). Sin filtro por DNI/especialidad/estado/rango, **sin paginación**. |
| Editar contacto/motivo de un turno (FR-11) | ❌ | No hay endpoint. |
| Cancelar turno + liberar/bloquear slot (FR-40, FR-41) | ❌ | No hay endpoint ni lógica. `CANCELADO` está en el enum pero nunca se usa. |
| Cambiar estado: presente / ausente / atendido (FR-16) | 🟡 | `POST /api/admin/turnos/[id]/estado` con `{estado: PRESENTE|AUSENTE|ATENDIDO}`. Valida transición y, para rol PROFESIONAL, que el turno sea suyo. Encola `CAMBIO_ESTADO_TURNO`. **Sin check-in** (FR-15) ni estado `ATENDIENDO`. |
| Agenda del día del profesional (FR-13) | 🟡 | Se cubre con `GET /api/admin/turnos?fecha=`. Distingue sobreturno por `tipo`. |
| Cola del día ordenada por prioridad y hora (FR-14) | 🟡 | `GET /api/admin/turnos?fecha=` ordena `prioridad asc, horaProgramada asc, horaLlegada asc`. **Bug de orden**: el enum `PrioridadOperativa` está declarado `NORMAL→…→URGENTE`, así que `asc` pone **NORMAL primero y URGENTE último** — al revés de "mayor prioridad primero". |
| Médicos de turno para una fecha (FR-17) | 🟡 | `GET /api/admin/medicos-de-turno?fecha=`. Deriva de franjas vigentes + `ausenciasDia`. Devuelve `ausente: boolean`. **Sin** conteos de turnos por estado, sin sala/horario resuelto por slot. |
| Marcar profesional ausente (FR-18, FR-19, FR-21) | 🟡 | `POST /api/admin/ausencias`. Crea `AusenciaProfesionalDia` (único por prof+fecha → falla la 2ª por constraint, no con 409 `AUSENCIA_YA_REGISTRADA` explícito), pasa los turnos activos a `A_REPROGRAMAR`, abre un `CasoReprogramacion` por turno y encola `REPROGRACION_INICIADA`. **No** crea `BLOQUEO` de agenda. |
| Resolver caso de reprogramación (FR-22) | 🟡 | `POST /api/admin/reprogramaciones?casoId=` con `{slotDestinoId, motivo}`. Crea turno destino sobre un slot del **mismo profesional y especialidad**, marca el caso `RESUELTO`. No permite elegir otro profesional. |
| Desplazamiento manual por Coordinación (FR-34–FR-38) | 🟡 | `POST /api/admin/turnos/[id]/desplazar` con `{slotDestinoId, motivo}`, solo ADMIN/COORDINACION. Crea el turno destino en `REPROGRAMADO_PENDIENTE_CONFIRMACION` y marca el origen igual; abre `CasoReprogramacion` ya `PENDIENTE` con origen y destino. **Divergencias**: no propone hueco (hay que pasar el slot), la regla de 24 h se evalúa sobre el **slot destino**, no sobre el turno origen; no hay paso de confirmar/rechazar ni liberación del slot origen; no chequea check-in (no existe). |
| Formulario de admisión guiado (FR-23, FR-24, NFR-M3) | ❌ | No hay motor de preguntas ni endpoint `/evaluar` ni `/preguntas`. `registrarDemandaEspontanea` recibe `respuestas` como mapa libre y `prioridadConfirmada` opcional; la sugerida sale de `categoria.prioridadBase` (o `URGENTE` si `derivarAGuardia`). |
| Demanda espontánea → guardia / sobreturno (FR-25, FR-26, FR-28) | 🟡 | `POST /api/admin/demanda`. Si categoría `derivarAGuardia` o prioridad `URGENTE`: registra `DemandaEspontanea` con `derivadaAGuardia=true`, sin turno. Si no: crea un `Turno` `tipo=SOBRETURNO` + `DemandaEspontanea` ligada. |
| Tope de sobreturnos + override (FR-30, FR-31) | 🟡 | Cuenta sobreturnos activos del profesional/fecha vs. `tope_sobreturnos_por_profesional_dia`. Si se alcanzó: rol RECEPCION → 409 `TOPE_SOBRETURNOS_ALCANZADO`; ADMIN/COORDINACION pueden pasar **si mandan `motivoAjuste`** (si no, 409 `MOTIVO_OVERRIDE_REQUERIDO`). Auditoría `OVERRIDE_SOBRETURNO` con el motivo. |
| Sobreturno para profesional ausente rechazado (FR-33) | ❌ | No se chequea. |
| Aviso de sobreturno (FR-32) | 🟡 | Encola `SOBRETURNO_CREADO` al profesional. No hay aviso a Coordinación ni indicador en panel. |
| Reportes (FR-42, FR-43, FR-44) | 🟡 | Un solo endpoint `GET /api/admin/reportes?tipo=` con `tipo ∈ {turnos, especialidades, categorias, sobreturnos, demanda}`. **Siempre CSV** (sin JSON, sin `?formato=`), separador coma, CRLF, **sin BOM**, sin `Content-Disposition` con filtro de fechas en el nombre. Sin `% ausentismo`, sin ocupación por profesional, sin franjas horarias, sin validación `RANGO_INVALIDO`. Filtra por `desde`/`hasta` opcionales. |
| Parámetros nuevos editables solo por ADMIN (FR-45) | 🟡 | Solo `tope_sobreturnos_por_profesional_dia`; se edita por el endpoint de parámetros de Fase 1 (rango 0–10 en `parametros.ts` y `validaciones.ts`). |
| Auditoría inmutable de operaciones (FR-46, FR-47, FR-48) | 🟡 | `registrarAuditoria` se llama dentro de cada transacción con acciones nuevas: `CREAR_TURNO`, `CAMBIAR_ESTADO_TURNO`, `CREAR_SOBRETURNO`, `OVERRIDE_SOBRETURNO`, `MARCAR_AUSENCIA_PROFESIONAL`, `REPROGRAMAR_TURNO`. Faltan `CHECK_IN`, `CANCELAR`, y el snapshot antes/después es parcial. La consulta de auditoría es la de Fase 1. |
| Integridad con catálogos (FR-51) | ❌ | No se impide desactivar profesional/especialidad/sala con turnos activos futuros. |
| Notificaciones **encoladas sin enviar** en Fase 2 (FR-50) | 🟡→Fase 3 ya activa | Se encolan en la misma transacción ✅, pero además `notificaciones.ts` + `POST /api/cron/notificaciones` **ya envían de verdad** por Resend. Eso era alcance de Fase 3. |

### UI

| Pantalla (spec / mockups) | Estado | Realidad en `main` |
|---|---|---|
| Consola operativa: cola del día, admisión/sobreturno, reprogramaciones | 🟡 | [AdminConsole.tsx](../../apps/web/src/app/admin/AdminConsole.tsx) (107 líneas, un solo archivo). Login propio, 3 tabs, métricas, marcar estados, marcar ausencia por `window.prompt`, resolver casos tomando el primer slot compatible. Sin formulario de reserva manual sobre slot, sin selección de hueco, sin filtros. Reemplaza la ruta `/admin` de Fase 1. |
| Portal ciudadano `/turnos` (Fase 3) | 🟡 | [turnos/page.tsx](../../apps/web/src/app/turnos/page.tsx) — reserva + "Mi turno". Adelanto de Fase 3. |

---

## Divergencias del spec original — **resueltas** (ver Decisiones tomadas)

Las 11 divergencias detectadas al revisar el código quedaron resueltas por las decisiones D-1..D-10 del 2026-09-03. Se listan con su resolución.

1. **Sin entidad `Paciente`.** El spec la exigía (FR-1). La implementación desnormaliza todo en `Turno` → sin `contadorAusencias` (FR-5) ni límite de turnos activos por especialidad (FR-9). → **Resuelto por D-1: se introduce `Paciente` ahora**, con migración de los datos embebidos. FR-1/5/9 vuelven a estar vigentes.

2. **Máquina de estados sin check-in.** No existen `EN_ESPERA`/`checkInAt` (FR-15) ni `ATENDIENDO` (FR-16). → **Resuelto por D-2: se recupera el check-in con `EN_ESPERA`** (idempotente, bloquea desplazamiento, ordena la cola de sobreturnos). `ATENDIENDO` **no** se agrega; `PRESENTE` se reconcilia a `EN_ESPERA`. FR-16 se baja a "marcar `ATENDIDO`/`AUSENTE`".

3. **Desplazamiento sin dos fases.** El código no libera el slot origen ni tiene confirmación (FR-36, FR-38, NFR-R2 rotos). → **Resuelto por D-6: ciclo completo del spec** — turno nuevo `PENDIENTE_CONFIRMACION`, confirmar/rechazar, liberación del slot origen al confirmar.

4. **Regla de 24 h evaluada sobre el destino.** → **Resuelto por D-6: se corrige** para evaluar el horario del turno **origen** (FR-37) y sumar el bloqueo por check-in.

5. **Orden de la cola invertido.** `orderBy: { prioridad: "asc" }` con enum `NORMAL→URGENTE`. → **Bug P0: se corrige** (peso numérico de prioridad, mayor primero; luego hora programada; luego hora de check-in/llegada; luego creación — FR-14).

6. **Sin formulario de admisión guiado.** FR-23/FR-24, NFR-M3. → **Resuelto por D-3: se construye** el motor de preguntas → nivel 1–4 como función pura, con endpoints `/preguntas` y `/evaluar`.

7. **Reportes muy por debajo del spec.** → **Resuelto por D-4: mínimo viable primero** — turnos por día con % de ausentismo + ocupación por profesional bien hechos (JSON + CSV con BOM, `?formato=`, `RANGO_INVALIDO`); los otros tres reportes de FR-42 al final de la fase.

8. **Fase 3 adelantada y mezclada.** → **Resuelto por D-5: se formaliza en el spec de Fase 3.** El código queda en `main`; se escribe/retoma el spec de Fase 3 y ese alcance se contabiliza allí. OS-1/OS-2 siguen vigentes para Fase 2. Sin revertir.

9. **Nomenclatura de parámetros.** → **Resuelto por D-8: alinear al spec** — `tope_sobreturnos_dia` (default **3**, 0..20), agregar `ventana_desplazamiento_horas` (24, 0..168) y `limite_turnos_activos_por_especialidad` (1, 1..10); sacar el `24 h` hardcodeado.

10. **Códigos de error y guardas.** → **P1: se traducen** los errores de constraint a los códigos del spec (`AUSENCIA_YA_REGISTRADA`, `ANTELACION_INSUFICIENTE`, `TURNO_ACTIVO_DUPLICADO`, `PROFESIONAL_AUSENTE`, `PROFESIONAL_INACTIVO`, `RANGO_INVALIDO`). Se renombra el wrapper de las rutas `/api/publico/*` a uno neutro (o se documenta) para no confundir con auth admin.

11. **Sin tests.** → **P0: se agregan** tests de integración de `operacion.ts` y se aíslan a funciones puras la máquina de estados, el orden de cola (NFR-M2) y la evaluación de prioridad del formulario guiado (NFR-M3).

---

## Modelo de datos implementado (`main`)

Fuente: [apps/web/prisma/schema.prisma](../../apps/web/prisma/schema.prisma) + migraciones `20260904*` y `20260905090000`.

### Enums nuevos

```prisma
enum PrioridadOperativa { NORMAL PREFERENCIAL PRIORITARIO URGENTE }          // coexiste con PrioridadBase (Fase 1)
enum EstadoTurno { CONFIRMADO PRESENTE AUSENTE ATENDIDO CANCELADO A_REPROGRAMAR REPROGRAMADO_PENDIENTE_CONFIRMACION }
enum TipoTurno { NORMAL SOBRETURNO }
enum EstadoCasoReprogramacion { PENDIENTE RESUELTO }
enum TipoEventoNotificable { REPROGRAMACION_INICIADA TURNO_REPROGRAMADO SOBRETURNO_CREADO CAMBIO_ESTADO_TURNO }
enum EstadoEventoNotificable { PENDIENTE ENTREGADO FALLIDO }
// EstadoSlot += OCUPADO, RESERVADO_TEMPORAL
// AccionAuditada += CREAR_TURNO CAMBIAR_ESTADO_TURNO CREAR_SOBRETURNO OVERRIDE_SOBRETURNO MARCAR_AUSENCIA_PROFESIONAL REPROGRAMAR_TURNO
// EntidadAuditada += turno demanda_espontanea ausencia_profesional caso_reprogramacion
```

### `Turno`

Datos de paciente y responsable **embebidos** (no hay tabla `Paciente`). Campos clave: `slotId?` (unique), `profesionalId`, `especialidadId`, `salaId?`, `categoriaId`, `fecha` (date), `horaProgramada?` (string "HH:MM"), `horaLlegada?` (timestamptz, para sobreturnos/espontánea), `tipo` (NORMAL|SOBRETURNO), `prioridad` (PrioridadOperativa), `estado` (EstadoTurno), `pacienteNombre/Dni/Nacimiento`, `responsableNombre/Dni?/Vinculo`, `telefono?`, `email?`, `consentimientoAceptadoAt?/Version?` (Fase 3), `presenteAt?/ausenteAt?/atendidoAt?`. Índices: `(fecha, estado)`, `(profesionalId, fecha)`, `(pacienteDni, especialidadId, estado)`. Relaciones: `demanda?`, `casosOrigen[]`/`casosDestino[]` (CasoReprogramacion), `eventos[]`.

Máquina de estados real (`operacion.ts` → `SIGUIENTES`):

| Desde | Hacia |
|---|---|
| `CONFIRMADO` | `PRESENTE`, `AUSENTE` |
| `PRESENTE` | `ATENDIDO`, `AUSENTE` |
| `AUSENTE` / `ATENDIDO` / `CANCELADO` / `A_REPROGRAMAR` / `REPROGRAMADO_PENDIENTE_CONFIRMACION` | terminal |

`A_REPROGRAMAR` lo setea `marcarAusenciaProfesional`; `REPROGRAMADO_PENDIENTE_CONFIRMACION` lo setea `desplazarTurno` y `resolverCasoReprogramacion`. Ninguna ruta produce `CANCELADO`.

### `DemandaEspontanea`

`turnoId?` (unique), `categoriaId`, `prioridadSugerida`, `prioridadConfirmada`, `respuestas` (Json libre), `motivoAjuste?`, `derivadaAGuardia` (bool), `horaLlegada` (default now). Índices: `(horaLlegada)`, `(prioridadConfirmada)`.

### `AusenciaProfesionalDia`

`profesionalId`, `fecha` (date), `motivo` (≤280), `marcadaPorId` (→ Usuario). Único `(profesionalId, fecha)`.

### `CasoReprogramacion`

`turnoOrigenId`, `turnoDestinoId?` (unique), `estado` (PENDIENTE|RESUELTO), `motivo`, `resueltoPorId?`, `createdAt`, `resueltoAt?`. Índice `(estado)`. **Cubre a la vez** el flujo "profesional caído" (destino nulo hasta resolver) y el desplazamiento manual (origen y destino a la vez, ya `PENDIENTE`).

### `EventoNotificable` (outbox)

`turnoId` (NOT NULL), `tipo`, `destinatario` (email o `profesional:<id>` o `responsable-sin-email`), `payload` (Json), `estado` (PENDIENTE|ENTREGADO|FALLIDO), `createdAt`, `procesadoAt?`. Índice `(estado, createdAt)`.

### `ReservaTemporal` (Fase 3, ya en el esquema)

`slotId` (unique), `token` (unique), `expiraAt`, `categoriaId`, datos paciente/responsable embebidos, `consentimientoVersion`. Slot gana `reservadoHasta?` y `reservaToken?`.

### Parámetros

`parametro_sistema` gana `tope_sobreturnos_por_profesional_dia = 2` (rango 0–10 en `parametros.ts`/`validaciones.ts`).

---

## API implementada (`main`)

Todas bajo `rutaAdmin(...)` (wrapper de manejo de errores de Fase 1). La autorización real la impone `exigirRoles(...)` dentro de cada handler.

### Operación del día (admin)

| Método + ruta | Roles | Cuerpo / query | Caso de uso |
|---|---|---|---|
| `GET /api/admin/turnos?fecha=YYYY-MM-DD` | ADMIN, COORDINACION, RECEPCION, PROFESIONAL (propios) | — | listar turnos del día (`prioridad asc, hora`) |
| `POST /api/admin/turnos` | ADMIN, COORDINACION, RECEPCION | `crearTurnoSchema` (`slotId`, `categoriaId`, `paciente{nombre,dni,fechaNacimiento}`, `responsable{nombre,dni,vinculo,telefono?,email?}`) | `crearTurnoInterno` → 201 |
| `POST /api/admin/turnos/[id]/estado` | ADMIN, COORDINACION, RECEPCION, PROFESIONAL (propios) | `{ estado: "PRESENTE"｜"AUSENTE"｜"ATENDIDO" }` | `cambiarEstadoTurno` |
| `POST /api/admin/turnos/[id]/desplazar` | ADMIN, COORDINACION | `{ slotDestinoId, motivo }` | `desplazarTurno` → 201 |
| `POST /api/admin/demanda` | ADMIN, COORDINACION, RECEPCION | `crearDemandaSchema` (`categoriaId`, `profesionalId`, `especialidadId`, `salaId?`, `prioridadConfirmada?`, `motivoAjuste?`, `respuestas: Record<string,string>`, `paciente`, `responsable`) | `registrarDemandaEspontanea` → 201 |
| `GET /api/admin/demanda?derivadaAGuardia=true` | ADMIN, COORDINACION, RECEPCION | — | listar demanda |
| `POST /api/admin/ausencias` | ADMIN, COORDINACION | `{ profesionalId, fecha, motivo }` | `marcarAusenciaProfesional` → 201 |
| `GET /api/admin/ausencias?fecha=` | ADMIN, COORDINACION, RECEPCION | — | listar ausencias |
| `GET /api/admin/medicos-de-turno?fecha=` | ADMIN, COORDINACION, RECEPCION, PROFESIONAL (propio) | — | profesionales con franja vigente + `ausente` |
| `GET /api/admin/reprogramaciones` | ADMIN, COORDINACION, RECEPCION | — | casos `PENDIENTE` |
| `POST /api/admin/reprogramaciones?casoId=` | ADMIN, COORDINACION, RECEPCION | `{ slotDestinoId, motivo }` | `resolverCasoReprogramacion` |
| `GET /api/admin/reportes?tipo=&desde=&hasta=` | ADMIN, COORDINACION | `tipo ∈ {turnos, especialidades, categorias, sobreturnos, demanda}` | CSV (siempre) |

Códigos de error de `traducirErrorOperacion`: 409 (`SLOT_NO_DISPONIBLE`, `CATEGORIA_NO_RESERVABLE`, `TRANSICION_INVALIDA`, `TOPE_SOBRETURNOS_ALCANZADO`, `MOTIVO_OVERRIDE_REQUERIDO`, `CATEGORIA_NO_ENCONTRADA`, `PROFESIONAL_O_ESPECIALIDAD_INVALIDO`, `TURNO_NO_DESPLAZABLE`, `SLOT_DESTINO_INVALIDO`, `MENOS_DE_24_HORAS`, `CASO_NO_PENDIENTE`), 404 (`*_NO_ENCONTRADO`), 403 (`SIN_PERMISO`).

### Canal ciudadano y crons (adelanto de Fase 3)

| Método + ruta | Notas |
|---|---|
| `GET /api/publico/catalogo` | categorías activas + especialidades |
| `GET /api/publico/slots?categoriaId=&especialidadId=` | slots DISPONIBLE próximos 90 días |
| `POST /api/publico/reservas` | `reservarSlot` → `{ token, expiraAt, slot }`, slot→`RESERVADO_TEMPORAL` |
| `POST /api/publico/reservas/confirmar` | `confirmarReserva(token)` → crea `Turno`, slot→`OCUPADO` |
| `POST /api/publico/mi-turno` | `{ dni, fechaNacimiento }` → turnos del paciente |
| `POST /api/cron/notificaciones` | `Bearer CRON_SECRET`; `procesarNotificaciones` envía por Resend |
| `POST /api/cron/reservas` | expira `ReservaTemporal` vencidas, libera slots |
| `POST /api/cron/retencion` | anonimiza turnos > `retencion_datos_meses` |

---

## Trabajo pendiente para cerrar la Fase 2

Detalle secuenciado en [plan-accion-fase-2-operacion-del-dia.md](../plan-accion-fase-2-operacion-del-dia.md). Resumen por prioridad:

**P0 — correcciones y cimientos (bloquean el resto)**
- [ ] **Bug** orden de la cola del día: peso de prioridad (mayor primero) → hora programada → hora de check-in/llegada → creación (FR-14, divergencia 5).
- [ ] **Bug** regla de 24 h del desplazamiento: evaluar el horario del turno **origen**, no el slot destino (FR-37, divergencia 4).
- [ ] **D-1** Entidad `Paciente` + migración de datos embebidos de `Turno` + `Turno.pacienteId` (FR-1). Recalcular `contadorAusencias` (FR-5).
- [ ] **D-10** `EventoNotificable` gana `canal` e `intentos`.
- [ ] Tests de integración de `operacion.ts` (concurrencia de slot, transiciones inválidas, tope + override, ausencia → casos) + aislar funciones puras: máquina de estados, orden de cola (NFR-M2), evaluación de prioridad (NFR-M3).

**P1 — funcionalidad de Fase 2 faltante**
- [ ] **D-2** Check-in: estado `EN_ESPERA` (reconciliar `PRESENTE`), `checkInAt` idempotente, `POST /api/admin/turnos/[id]/check-in`, bloqueo de desplazamiento con check-in (FR-15).
- [ ] **D-6** Ciclo de desplazamiento completo: `PENDIENTE_CONFIRMACION`, propuesta de próximo hueco (`GET /api/admin/turnos/[id]/huecos`), `confirmar`/`rechazar`, liberación/bloqueo del slot origen al confirmar (FR-35, FR-36, FR-38, NFR-R2).
- [ ] **D-7** `marcarAusenciaProfesional` crea la excepción `BLOQUEO` de agenda y pasa los slots `DISPONIBLE` restantes a `BLOQUEADO` (FR-19).
- [ ] **D-3** Formulario de admisión guiado: motor de reglas como función pura, `GET /preguntas`, `POST /evaluar`, confirmación/ajuste de nivel por Recepción (FR-23, FR-24).
- [ ] **D-9** Canal de contacto obligatorio: email o (teléfono + `telefonoEsWhatsapp`), 400 si falta (FR-2).
- [ ] **D-8** Parámetros: renombrar a `tope_sobreturnos_dia` (default 3), agregar `ventana_desplazamiento_horas` (24) y `limite_turnos_activos_por_especialidad` (1); quitar el `24 h` hardcodeado (FR-45).
- [ ] Cancelación de turno con motivo + liberación/bloqueo de slot + evento `CANCELACION_HOSPITAL` (FR-40, FR-41).
- [ ] Edición de contacto/motivo de turno no finalizado (FR-11).
- [ ] Búsqueda de turnos con filtros (DNI, profesional, especialidad, estado, rango) + paginación de 25 (FR-6).
- [ ] Antelación mínima + `forzar` en la reserva manual (FR-10); límite de turnos activos por especialidad + `forzar` (FR-9).
- [ ] Rechazo de sobreturno para profesional ausente en esa fecha → 409 `PROFESIONAL_AUSENTE` (FR-33).
- [ ] Aviso de sobreturno a Coordinación + distintivo en panel (FR-32).
- [ ] Integridad de catálogos: bloquear baja de profesional/especialidad/sala con turnos activos futuros (FR-51).
- [ ] Traducir errores de constraint a códigos del spec (divergencia 10).
- [ ] Auditoría: sumar `CHECK_IN` y `CANCELAR`, completar snapshot antes/después (FR-46).

**P1-final — reportes (D-4, mínimo viable primero)**
- [ ] `turnos-por-dia` con % de ausentismo + `ocupacion-profesional`, JSON + CSV con BOM, `?formato=`, `RANGO_INVALIDO` (FR-42a/d, FR-43, FR-44).
- [ ] (al cierre) los otros tres reportes de FR-42: demanda por especialidad+categoría, sobreturnos+desplazamientos, demanda espontánea por franja horaria.

**P2 — Fase 3 (fuera de esta fase, D-5)**
- [ ] Escribir/retomar el spec de Fase 3 e incorporar el código ya adelantado (`ReservaTemporal`, `ciudadano.ts`, `notificaciones.ts`, `/turnos`, crons).

**UI**
- [ ] Formulario de reserva manual sobre slot en la consola.
- [ ] Formulario de admisión guiado (preguntas + nivel sugerido + ajuste).
- [ ] Selección de hueco al resolver reprogramación / desplazar (hoy toma el primero).
- [ ] Reemplazar `window.prompt` por diálogos accesibles (NFR-A1, NFR-A2).
- [ ] Alinear la consola con los mockups (`mockups-html/`).

---

## Apéndice A — Diseño original (referencia de intención)

> Lo que sigue es el spec tal como fue escrito antes de la implementación. Se conserva completo porque fija la intención de diseño, las invariantes de concurrencia y los criterios de aceptación. Donde el código difiere, manda la sección **Divergencias** de arriba y hay una decisión pendiente.

### A.1 Functional Requirements

#### Modelo de turno y pacientes

- FR-1: El sistema MUST introducir la entidad **Paciente**, identificada por DNI único, con nombre, fecha de nacimiento y obra social opcional (referencia a `ObraSocial` u texto libre "otra").
- FR-2: El sistema MUST registrar en cada turno los datos del **solicitante responsable** (DNI, nombre, vínculo con el paciente) y al menos un canal de contacto: email o teléfono marcado como WhatsApp; MUST rechazar la carga si no hay ninguno.
- FR-3: El sistema MUST modelar el **Turno** con: paciente, solicitante, profesional, especialidad, fecha, hora de inicio (nullable hasta asignarse en un sobreturno), slot de origen (nullable en sobreturnos), categoría de problema (opcional) y detalle libre opcional, prioridad (nivel 1 `NORMAL`, 2 `PREFERENCIAL`, 3 `PRIORITARIO`), origen (`PANEL`, `ESPONTANEA`) y estado.
- FR-4: El sistema MUST implementar la máquina de estados del turno con los estados `AGENDADO`, `PENDIENTE_CONFIRMACION`, `EN_ESPERA`, `ATENDIENDO`, `ATENDIDO`, `AUSENTE`, `CANCELADO`, `REPROGRAMADO`, y MUST NOT permitir transiciones fuera de las declaradas en la sección Data Models.
- FR-5: El sistema MUST mantener un contador de ausencias (no-show) por paciente, incrementado al pasar un turno a `AUSENTE`, y MUST NOT aplicar ninguna penalización ni bloqueo automático derivado de ese contador.
- FR-6: El sistema MUST permitir buscar y listar turnos filtrando por DNI de paciente, profesional, especialidad, rango de fechas y estado, con paginación de 25 ítems.

#### Reserva manual por Recepción

- FR-7: El sistema MUST permitir a los roles `RECEPCION`, `COORDINACION` y `ADMIN` crear un turno tomando un slot en estado `DISPONIBLE` y cargando paciente + solicitante + motivo.
- FR-8: El sistema MUST marcar el slot como `OCUPADO` de forma atómica al confirmar el turno y MUST rechazar con 409 `SLOT_NO_DISPONIBLE` si el slot ya no está `DISPONIBLE` en el momento de confirmar.
- FR-9: El sistema MUST impedir que un mismo paciente tenga más de `limite_turnos_activos_por_especialidad` (default 1) turnos activos (`AGENDADO`, `PENDIENTE_CONFIRMACION`, `EN_ESPERA`) en la misma especialidad, y MUST permitir al personal saltear la regla enviando `forzar = true`, dejando registro en auditoría.
- FR-10: El sistema MUST rechazar con 409 `ANTELACION_INSUFICIENTE` la reserva de un slot con menos de `antelacion_minima_horas` de antelación, salvo `forzar = true`.
- FR-11: El sistema MUST permitir editar los datos de contacto del solicitante y el detalle del motivo de un turno no finalizado, sin cambiar el slot ni el paciente.
- FR-12: El sistema MUST derivar la prioridad base del turno de la categoría de problema seleccionada, y MUST NOT admitir un turno de prioridad nivel 4 (`URGENTE` no genera turno).

#### Vista de turnos del día y cola

- FR-13: El sistema MUST exponer la agenda del día de un profesional: sus turnos de la fecha ordenados por hora, con estado, prioridad, distintivo de sobreturno y datos del paciente.
- FR-14: El sistema MUST exponer una **cola del día** por profesional que mezcle turnos agendados y sobreturnos, ordenada primero por nivel de prioridad (mayor primero) y luego por hora de turno; para sobreturnos sin hora, por hora de check-in y luego por orden de creación.
- FR-15: El sistema MUST permitir a `RECEPCION` (y `COORDINACION`/`ADMIN`) registrar el **check-in** de un turno de la fecha actual, fijando `checkInAt` y pasando el turno a `EN_ESPERA`; el check-in MUST ser idempotente.
- FR-16: El sistema MUST permitir marcar un turno como `ATENDIENDO`, `ATENDIDO` o `AUSENTE`; el rol `PROFESIONAL` solo puede hacerlo sobre sus propios turnos.

#### Médicos de turno y flujo "profesional caído"

- FR-17: El sistema MUST derivar de las agendas la vista **"médicos de turno"** para una fecha: profesionales que atienden, horario, especialidad, sala y estado (`PRESENTE` / `AUSENTE`), más el conteo de turnos por estado.
- FR-18: El sistema MUST permitir a `COORDINACION`/`ADMIN` marcar a un profesional como **ausente** en una fecha, con motivo textual obligatorio; MUST rechazar con 409 `AUSENCIA_YA_REGISTRADA` una segunda marca para el mismo profesional y fecha.
- FR-19: Al marcar un profesional ausente, el sistema MUST crear una excepción de `BLOQUEO` para esa fecha (bloquea los slots `DISPONIBLE` restantes) y MUST generar una **lista de trabajo** con los turnos activos (`AGENDADO`, `PENDIENTE_CONFIRMACION`, `EN_ESPERA`) de ese profesional y fecha, cada uno marcado "a reprogramar".
- FR-20: El sistema MUST NOT incluir en la lista de trabajo los turnos ya en estado `ATENDIDO`, `AUSENTE`, `CANCELADO` o `REPROGRAMADO`.
- FR-21: El sistema MUST encolar una notificación "estamos reprogramando tu turno" por cada turno de la lista de trabajo, en el momento de generarla y antes de resolver cada caso.
- FR-22: El sistema MUST permitir a `RECEPCION`/`COORDINACION`/`ADMIN` reasignar cada turno de la lista de trabajo, caso por caso, a otro profesional de la misma especialidad y/o a otra fecha/slot; al resolver un caso MUST encolar una notificación de turno reprogramado y marcar el ítem como `RESUELTO`.

#### Demanda espontánea y prioridades

- FR-23: El sistema MUST proveer un **formulario de admisión guiado** de preguntas cerradas que, a partir de las respuestas, sugiera un nivel de prioridad (1 `NORMAL`, 2 `PREFERENCIAL`, 3 `PRIORITARIO`, 4 `URGENTE`).
- FR-24: El sistema MUST permitir a `RECEPCION` confirmar o ajustar el nivel sugerido antes de registrar el evento.
- FR-25: Si el nivel asignado es 4 (`URGENTE`), el sistema MUST NOT generar turno ni sobreturno, MUST devolver la indicación de derivar a guardia, y MUST registrar igualmente el evento con `derivadoAGuardia = true`.
- FR-26: Si el nivel asignado es 1–3, el sistema MUST registrar la demanda espontánea y crear un **sobreturno** del profesional elegido con esa prioridad.
- FR-27: El sistema MUST registrar cada evento de demanda espontánea con paciente, solicitante, categoría (opcional), respuestas del formulario, nivel sugerido, nivel asignado, `derivadoAGuardia`, turno generado (si lo hay) y usuario que lo registró.
- FR-28: Si la categoría seleccionada tiene `derivarAGuardia = true`, el sistema MUST cortar el flujo y devolver la indicación de guardia sin evaluar el formulario.

#### Sobreturnos

- FR-29: El sistema MUST permitir crear un sobreturno para un profesional y fecha con paciente, solicitante, motivo y prioridad, **sin consumir un slot** (`slotId = null`, `esSobreturno = true`).
- FR-30: El sistema MUST rechazar con 409 `TOPE_SOBRETURNOS_ALCANZADO` un sobreturno cuando el profesional ya alcanzó su tope diario (`topeSobreturnosDia` del profesional si está definido, si no `tope_sobreturnos_dia`), salvo `autorizarOverride = true` enviado por `COORDINACION`/`ADMIN`.
- FR-31: El sistema MUST registrar en auditoría cada override de tope de sobreturno con el usuario autorizante y el motivo.
- FR-32: El sistema MUST encolar una notificación al profesional y a coordinación (indicador visible en el panel) por cada sobreturno creado, y MUST marcar el sobreturno con un distintivo visual en la agenda y en la cola del día.
- FR-33: El sistema MUST NOT permitir crear un sobreturno para un profesional marcado ausente en esa fecha (409 `PROFESIONAL_AUSENTE`).

#### Desplazamiento manual de turno confirmado

- FR-34: El sistema MUST permitir SOLO a los roles `COORDINACION`/`ADMIN` iniciar el desplazamiento de un turno `AGENDADO`, y MUST NOT desplazar ningún turno de forma automática bajo ninguna circunstancia.
- FR-35: Al iniciar un desplazamiento, el sistema MUST proponer el próximo hueco disponible del mismo profesional (mismo día si hay, si no el más cercano) y MUST permitir elegir otro hueco disponible manualmente.
- FR-36: El sistema MUST crear el turno nuevo en estado `PENDIENTE_CONFIRMACION` y MUST NOT liberar el slot del turno original hasta que el desplazamiento se confirme.
- FR-37: El sistema MUST rechazar con 409 `DESPLAZAMIENTO_BLOQUEADO` el desplazamiento de un turno a menos de `ventana_desplazamiento_horas` (default 24) de su horario, o de un turno que ya tiene check-in realizado.
- FR-38: El sistema MUST permitir a `RECEPCION`/`COORDINACION`/`ADMIN` **confirmar** o **rechazar** un desplazamiento en nombre del paciente; al confirmar, el turno nuevo pasa a `AGENDADO`, el original a `REPROGRAMADO` y su slot se libera según FR-40; al rechazar, el turno nuevo se descarta y el original permanece `AGENDADO`.
- FR-39: El sistema MUST registrar todo desplazamiento (turno original, turno nuevo, hueco propuesto, motivo, usuario, timestamps y resultado) en un registro consultable y en auditoría.

#### Cancelación y liberación de slots

- FR-40: El sistema MUST permitir al personal cancelar un turno con motivo obligatorio; el turno pasa a `CANCELADO` y se marca `cancelacionTardia = true` si se cancela con menos de `antelacion_minima_horas` de antelación. Al cancelar, el slot vuelve a `DISPONIBLE` si la fecha sigue dentro de la ventana de reserva y por encima de la antelación mínima; en caso contrario el slot pasa a `BLOQUEADO` y no se re-ofrece.
- FR-41: El sistema MUST encolar una notificación de "cancelación por el hospital" cada vez que el personal cancela un turno.

#### Reportes

- FR-42: El sistema MUST exponer a los roles `ADMIN`/`COORDINACION` cinco reportes, cada uno como tabla filtrable por rango de fechas: (a) turnos por día (agendados, atendidos, ausentes, cancelados y % de ausentismo), (b) demanda por especialidad y por categoría de problema, (c) sobreturnos y desplazamientos del período con motivo, (d) ocupación por profesional (slots ofrecidos vs. usados), (e) demanda espontánea por franja horaria.
- FR-43: El sistema MUST permitir exportar cada reporte a **CSV** (UTF-8 con BOM, separador coma, encabezados en español) mediante `?formato=csv`, respondiendo con `Content-Disposition: attachment`.
- FR-44: Los reportes MUST calcularse sobre datos vivos (sin caché mayor a 60 s) y MUST rechazar con 400 `RANGO_INVALIDO` un rango mayor a 366 días o con `hasta` anterior a `desde`.

#### Parámetros y auditoría

- FR-45: El sistema MUST agregar a los parámetros del sistema, editables solo por `ADMIN`: `tope_sobreturnos_dia` (default 3, rango 0..20), `ventana_desplazamiento_horas` (default 24, rango 0..168), `limite_turnos_activos_por_especialidad` (default 1, rango 1..10).
- FR-46: El sistema MUST escribir un registro de auditoría inmutable por cada operación de escritura sobre turnos (crear, editar, cancelar, check-in, marcar atendiendo/atendido/ausente), demanda espontánea, sobreturnos (incluido el override de tope), desplazamientos y ausencias de profesional, con actor, acción, entidad, identificador, timestamp UTC, motivo cuando aplique y snapshot del estado anterior y nuevo.
- FR-47: El sistema MUST permitir a `ADMIN`/`COORDINACION` consultar la auditoría de estas entidades filtrando por rango de fechas, actor y entidad, como extensión de la vista de auditoría de Fase 1.
- FR-48: El sistema MUST NOT permitir editar ni borrar registros de auditoría desde ninguna interfaz.

#### Notificaciones (cola persistente, sin envío)

- FR-49: El sistema MUST crear la tabla `notificacion` como cola persistente, con destinatario (snapshot del contacto), canal (`EMAIL` | `WHATSAPP`), tipo de evento, estado (`PENDIENTE` | `ENVIADO` | `FALLIDO`), payload y contador de intentos.
- FR-50: En Fase 2 el sistema MUST escribir filas de notificación en estado `PENDIENTE` **en la misma transacción** que la acción que las origina, y MUST NOT enviar ninguna notificación; si la acción origen falla, no queda ninguna notificación encolada. El worker de envío y el canal email son de Fase 3.

#### Integridad con catálogos

- FR-51: El sistema MUST impedir desactivar o eliminar un profesional, especialidad o sala que tenga turnos activos (`AGENDADO`, `PENDIENTE_CONFIRMACION`, `EN_ESPERA`) con fecha futura, devolviendo un error que identifique los turnos bloqueantes.

### A.2 Non-Functional Requirements

#### Rendimiento

- NFR-P1: La agenda del día y la cola del día MUST responder en < 400 ms (p95) con hasta 250 turnos en la fecha consultada.
- NFR-P2: La búsqueda de turnos por DNI o rango de fechas MUST responder en < 600 ms (p95) con 100.000 turnos en la base, usando índices; no se permiten full table scans sobre `turno`.
- NFR-P3: Cada reporte con rango de hasta 366 días MUST generarse en < 5 s y el CSV MUST comenzar a transmitirse en < 2 s.
- NFR-P4: La confirmación de una reserva manual (incluida la toma atómica del slot y el encolado de la notificación) MUST completarse en < 1,5 s (p95).

#### Seguridad

- NFR-S1: Todos los endpoints de esta fase están bajo `/api/admin/**` y MUST requerir sesión válida; esta fase no expone ningún endpoint público.
- NFR-S2: La autorización por rol MUST verificarse en el servidor en cada endpoint según la matriz de la sección API Contracts; el rol `PROFESIONAL` MUST poder solo leer y operar (`ATENDIENDO`/`ATENDIDO`/`AUSENTE`) sus propios turnos.
- NFR-S3: Los datos de paciente y solicitante (DNI, fecha de nacimiento, teléfono, email) MUST NOT aparecer en logs de aplicación ni en mensajes de error.
- NFR-S4: Los mensajes de error MUST NOT filtrar detalles internos (SQL, nombres de tabla, stack traces).
- NFR-S5: El override de tope de sobreturno (FR-30) y el inicio de un desplazamiento (FR-34) MUST estar restringidos a `COORDINACION`/`ADMIN` en el servidor, con independencia de la UI.

#### Accesibilidad

- NFR-A1: Todas las acciones de la operación del día (check-in, atender, ausente, cancelar, crear sobreturno, desplazar, confirmar/rechazar) MUST ser operables por teclado (WCAG 2.1.1).
- NFR-A2: Los formularios de reserva manual y de admisión guiada MUST tener labels asociados programáticamente y MUST anunciar los errores de validación mediante `aria-live` o `aria-describedby` (WCAG 1.3.1, 3.3.1).
- NFR-A3: El estado y la prioridad de cada turno MUST comunicarse por texto o ícono además del color (WCAG 1.4.1).

#### Fiabilidad y datos

- NFR-R1: La toma de un slot MUST ser atómica: ante dos reservas simultáneas del mismo slot, exactamente una confirma (201) y la otra recibe 409 `SLOT_NO_DISPONIBLE`, sin doble ocupación.
- NFR-R2: El desplazamiento MUST preservar la invariante "el turno original conserva su slot hasta que exista un turno nuevo confirmado"; una falla a mitad no MUST dejar ningún turno sin slot ni dos turnos activos sobre el mismo slot.
- NFR-R3: Toda notificación encolada MUST escribirse en la misma transacción que su acción origen; no MUST haber eventos perdidos ni encolados por acciones que luego fallan.
- NFR-R4: Todos los timestamps se almacenan en UTC; la presentación y los cortes por "día" (agenda del día, cola, reportes) usan la zona `America/Argentina/Buenos_Aires`.
- NFR-R5: El contador de ausencias por paciente MUST ser consistente en todo momento con la cantidad de turnos de ese paciente en estado `AUSENTE`.

#### Mantenibilidad

- NFR-M1: Todos los cambios de esquema MUST ir en migraciones de Prisma versionadas; sin cambios manuales.
- NFR-M2: La máquina de estados del turno (transición válida dado estado + evento) y la regla de orden de la cola del día MUST estar aisladas en funciones puras testeables sin base de datos.
- NFR-M3: La evaluación del nivel de prioridad del formulario de admisión guiado (respuestas → nivel sugerido) MUST estar aislada en una función pura testeable sin base de datos.

### A.3 Acceptance Criteria

> Referencia de verificación del diseño original. Antes de correrlos como suite hay que reconciliar los nombres de estado/entidad con la implementación (o decidir corregir el código). Marcados con ⚠️ los que hoy no aplican tal cual por una divergencia.

- **AC-1** ⚠️ Reserva manual crea paciente y toma el slot (FR-1, FR-3, FR-7, FR-8) — *no hay entidad Paciente; el resto (toma de slot, turno `CONFIRMADO`) sí aplica.*
- **AC-2** Solicitante sin canal de contacto rechazado (FR-2) — *el schema hoy no exige email o teléfono: falta la regla.*
- **AC-3** Slot ya ocupado al confirmar → 409 `SLOT_NO_DISPONIBLE` (FR-8, NFR-R1). ✅ cubierto por `crearTurnoInterno`.
- **AC-4** Reservas simultáneas del mismo slot → exactamente una 201 (NFR-R1). ✅ lógica presente; falta test.
- **AC-5** ⚠️ Segundo turno activo en la misma especialidad (FR-9) — *no implementado.*
- **AC-6** ⚠️ Antelación mínima insuficiente (FR-10) — *no implementado.*
- **AC-7** ⚠️ Editar contacto de un turno no finalizado (FR-11) — *no implementado.*
- **AC-8** Prioridad derivada de la categoría; nivel 4 rechazado (FR-12). 🟡 la prioridad sale de la categoría; "nivel 4 no genera turno" se cumple vía `derivarAGuardia`/`URGENTE`.
- **AC-9** La máquina de estados rechaza una transición inválida → 409 (FR-4, NFR-M2). 🟡 `TRANSICION_INVALIDA` existe; la máquina no está aislada como función pura.
- **AC-10** ⚠️ Marcar ausente incrementa el contador del paciente (FR-5, NFR-R5) — *no hay contador.*
- **AC-11** ⚠️ Buscar turnos por DNI (FR-6) — *no implementado.*
- **AC-12** Agenda del día ordenada por hora con marca de sobreturno (FR-13). 🟡 vía `GET /api/admin/turnos?fecha=`.
- **AC-13** ⚠️ Cola del día ordenada por prioridad y luego hora (FR-14, NFR-M2) — *orden invertido; sin endpoint dedicado.*
- **AC-14** ⚠️ Check-in fija `checkInAt` y pasa a `EN_ESPERA` (FR-15) — *no implementado.*
- **AC-15** El profesional solo opera sus propios turnos → 403 (FR-16, NFR-S2). ✅ `cambiarEstadoTurno` valida `profesionalId`.
- **AC-16** Vista "médicos de turno" derivada de la agenda (FR-17). 🟡 sin conteos por estado.
- **AC-17** Marcar profesional ausente crea BLOQUEO y lista de trabajo (FR-18–20). 🟡 crea casos de reprogramación; **no** crea `BLOQUEO`.
- **AC-18** ⚠️ Segunda marca de ausencia → 409 `AUSENCIA_YA_REGISTRADA` (FR-18) — *hoy falla por constraint, no con ese código.*
- **AC-19** Se encola "estamos reprogramando" por cada turno de la lista (FR-21, FR-50). ✅ `REPROGRAMACION_INICIADA` por turno; ⚠️ además se envía de verdad por el cron.
- **AC-20** Reasignar un turno de la lista de trabajo (FR-22). 🟡 `POST /api/admin/reprogramaciones`; solo mismo profesional/especialidad.
- **AC-21** ⚠️ El formulario de admisión guiado sugiere un nivel (FR-23, NFR-M3) — *no implementado.*
- **AC-22** Recepción ajusta el nivel sugerido (FR-24). 🟡 `prioridadConfirmada` + `motivoAjuste` en `registrarDemandaEspontanea`.
- **AC-23** Nivel 4 no genera turno y deriva a guardia (FR-25). ✅ (por `URGENTE`/`derivarAGuardia`).
- **AC-24** Nivel 1–3 genera un sobreturno (FR-26). ✅ `tipo=SOBRETURNO`, `slotId=null`.
- **AC-25** El evento de demanda espontánea queda registrado (FR-27). 🟡 sin `pacienteId`/`registradoPorId` (queda en auditoría).
- **AC-26** Categoría "derivar a guardia" corta el flujo (FR-28). ✅.
- **AC-27** El sobreturno no consume un slot (FR-29). ✅.
- **AC-28** Sobreturno sobre el tope requiere override de Coordinación (FR-30). 🟡 override = ADMIN/COORDINACION **con `motivoAjuste`**.
- **AC-29** El override de tope queda auditado (FR-31). ✅ `OVERRIDE_SOBRETURNO` + motivo.
- **AC-30** El sobreturno encola aviso al profesional (FR-32). 🟡 solo al profesional.
- **AC-31** ⚠️ Sobreturno para profesional ausente rechazado (FR-33) — *no implementado.*
- **AC-32** Solo Coordinación inicia el desplazamiento; nunca automático (FR-34, NFR-S5). ✅ `exigirRoles("ADMIN","COORDINACION")`.
- **AC-33** ⚠️ El desplazamiento propone el próximo hueco del mismo profesional (FR-35) — *hay que pasar `slotDestinoId`.*
- **AC-34** ⚠️ El original conserva su slot hasta confirmar (FR-36, NFR-R2) — *no hay paso de confirmación.*
- **AC-35** ⚠️ Desplazamiento bloqueado por ventana o check-in (FR-37) — *la ventana se evalúa sobre el slot destino; no hay check-in.*
- **AC-36 / AC-37** ⚠️ Confirmar / rechazar el desplazamiento (FR-38, FR-39) — *no implementado.*
- **AC-38 / AC-39 / AC-40** ⚠️ Cancelación tardía / liberación de slot (FR-40) — *no implementado.*
- **AC-41** ⚠️ La cancelación por el hospital encola notificación (FR-41, FR-49) — *no implementado.*
- **AC-42 / AC-43 / AC-44** ⚠️ Reportes con % ausentismo, CSV con BOM y attachment, rango inválido (FR-42–44) — *el reporte actual no cumple.*
- **AC-45** Parámetros nuevos editables solo por ADMIN (FR-45). 🟡 solo `tope_sobreturnos_por_profesional_dia`.
- **AC-46** Auditoría de las operaciones de turno (FR-46, FR-47). 🟡 acciones nuevas presentes; faltan `CHECK_IN`/`CANCELAR`.
- **AC-47** La notificación se encola en la misma transacción (FR-50, NFR-R3). ✅ todo dentro de `db.$transaction`.
- **AC-48** ⚠️ No se puede desactivar un profesional con turnos activos futuros (FR-51) — *no implementado.*
- **AC-49** Registros de auditoría inmutables (FR-48). ✅ heredado de Fase 1.
- **AC-50** Timestamps en UTC, cortes de día en hora Argentina (NFR-R4). 🟡 revisar: varios cortes usan `T00:00:00.000Z` (UTC), no la zona AR.

### A.4 Data Models (diseño original)

> Referencia. El modelo real está en **Modelo de datos implementado**. Diferencias mayores: no hay `Paciente`, `Desplazamiento`, `ItemReprogramacion` ni `Notificacion` con canal; `Turno` desnormaliza al paciente; los estados son otros.

Entidades del diseño: `Paciente` (dni único, obraSocial, `contadorAusencias`), `Turno` (FK a Paciente + solicitante embebido, estados `AGENDADO`/`PENDIENTE_CONFIRMACION`/`EN_ESPERA`/`ATENDIENDO`/`ATENDIDO`/`AUSENTE`/`CANCELADO`/`REPROGRAMADO`, `esSobreturno`, `checkInAt`, `cancelacionTardia`, `reprogramadoDesdeId`), `DemandaEspontanea` (`nivelSugerido`/`nivelAsignado` 1..4, `respuestas` jsonb), `Desplazamiento` (`turnoOriginalId`, `turnoNuevoId`, `huecoSlotId`, `estado` PROPUESTO/CONFIRMADO/RECHAZADO), `AusenciaProfesional` (`excepcionId` → el BLOQUEO), `ItemReprogramacion` (lista de trabajo, `estado` PENDIENTE/RESUELTO), `Notificacion` (`canal` EMAIL/WHATSAPP, `tipoEvento`, `estado` PENDIENTE/ENVIADO/FALLIDO, `intentos`).

Máquina de estados del diseño (para cuando se decida sobre check-in): `AGENDADO→{EN_ESPERA(check-in), CANCELADO, AUSENTE, REPROGRAMADO}`, `PENDIENTE_CONFIRMACION→{AGENDADO, CANCELADO}`, `EN_ESPERA→{ATENDIENDO, CANCELADO, AUSENTE}`, `ATENDIENDO→{ATENDIDO, AUSENTE}`, terminales `ATENDIDO`/`AUSENTE`/`CANCELADO`/`REPROGRAMADO`.

Modificaciones a Fase 1 previstas: `EstadoSlot += OCUPADO` (hecho), `Profesional.topeSobreturnosDia` (no hecho), 3 parámetros nuevos (1 de 3 hecho, con otro nombre).

### A.5 Out of Scope (del diseño original)

- OS-1: Canal ciudadano web (formulario público, "Mi turno", consentimiento, confirmación del paciente de un turno desplazado) — **Fase 3**. *Nota: parcialmente adelantado en `main` (`/turnos`, `ciudadano.ts`, `ReservaTemporal`).*
- OS-2: **Envío** real de notificaciones, worker/cron, reintentos, canal WhatsApp — **Fase 3**. *Nota: el envío por Resend ya está en `main` (`notificaciones.ts`, cron).*
- OS-3: Estado `RESERVADO_TEMPORAL` y la reserva de ~7 min — **Fase 3**. *Nota: ya en el esquema.*
- OS-4: Reprogramación automática masiva ante caída de un profesional — rechazada (decisiones-mvp §9); siempre caso por caso.
- OS-5: Penalización o bloqueo automático por ausentismo — solo contador por DNI.
- OS-6: Job de retención / anonimización / "borrar mis datos" — **Fase 3**. *Nota: `POST /api/cron/retencion` ya existe.*
- OS-7: Bot de WhatsApp y `packages/whatsapp-bot` — Fase 4.
- OS-8: Triage clínico / cuestionario formal de banderas rojas. El formulario de admisión asigna **prioridad administrativa**, no evalúa condición clínica.
- OS-9: Conflictos o reserva de salas como recurso — la sala es atributo informativo.
- OS-10: Fila digital / sala de espera con pantallas y llamado por número.
- OS-11: Cuentas de ciudadano, login del paciente, historial multi-hijo.
- OS-12: Dashboards con gráficos — los reportes son tablas + CSV.
- OS-13: SMS.
- OS-14: Profesional de demanda espontánea "siempre activo" con agenda propia.
- OS-15: Historia clínica / registro de la atención médica.
- OS-16: Edición o reapertura de un turno en estado terminal.

### A.6 Trazabilidad FR → AC (diseño original)

FR-1→AC-1 · FR-2→AC-2 · FR-3→AC-1,AC-8 · FR-4→AC-9 · FR-5→AC-10 · FR-6→AC-11 · FR-7→AC-1 · FR-8→AC-1,AC-3 · FR-9→AC-5 · FR-10→AC-6 · FR-11→AC-7 · FR-12→AC-8 · FR-13→AC-12 · FR-14→AC-13 · FR-15→AC-14 · FR-16→AC-15 · FR-17→AC-16 · FR-18→AC-17,AC-18 · FR-19→AC-17 · FR-20→AC-17 · FR-21→AC-19 · FR-22→AC-20 · FR-23→AC-21 · FR-24→AC-22 · FR-25→AC-23 · FR-26→AC-24 · FR-27→AC-25 · FR-28→AC-26 · FR-29→AC-27 · FR-30→AC-28 · FR-31→AC-29 · FR-32→AC-30 · FR-33→AC-31 · FR-34→AC-32 · FR-35→AC-33 · FR-36→AC-34 · FR-37→AC-35 · FR-38→AC-36,AC-37 · FR-39→AC-37 · FR-40→AC-38,AC-39,AC-40 · FR-41→AC-41 · FR-42→AC-42 · FR-43→AC-43 · FR-44→AC-44 · FR-45→AC-45 · FR-46→AC-46 · FR-47→AC-46 · FR-48→AC-49 · FR-49→AC-41,AC-47 · FR-50→AC-19,AC-47 · FR-51→AC-48

Cobertura NFR: NFR-R1↔AC-3/AC-4 · NFR-R2↔AC-34 · NFR-R3↔AC-47 · NFR-R4↔AC-50 · NFR-R5↔AC-10 · NFR-M2↔AC-9/AC-13 · NFR-M3↔AC-21 · NFR-S2↔AC-15 · NFR-S5↔AC-28/AC-32.
