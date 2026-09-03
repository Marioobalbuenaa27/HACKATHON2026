/**
 * Test suite for: Fase 1 — Núcleo administrativo (Turnero JP)
 * Auto-generated from spec. 45 acceptance criteria, 19 edge cases.
 *
 * All tests are stubs — implement the test body to make them pass.
 * Fase 4 del spec-driven-workflow: RED phase. Cada stub se reemplaza por un
 * test real al implementar su AC/EC en la Fase 5.
 */
import { describe, it } from "vitest";

describe("Fase 1 — Núcleo administrativo (Turnero JP)", () => {
  it("AC-1: Login exitoso [FR-1, FR-4]", () => {
    // Given un usuario del panel activo con email `coord@hospital.test` y contraseña correcta
    // When hace `POST /api/admin/auth/login` con esas credenciales
    // Then recibe 200, se establece una cookie de sesión httpOnly + Secure + SameSite=Lax
    // Then el cuerpo incluye su nombre y rol, y no incluye hash ni contraseña

    throw new Error("Not implemented");
  });

  it("AC-2: Login con contraseña incorrecta [FR-2, FR-3]", () => {
    // Given un usuario del panel activo con email `coord@hospital.test`
    // When hace `POST /api/admin/auth/login` con una contraseña incorrecta
    // Then recibe 401 con `error = "CREDENCIALES_INVALIDAS"`
    // Then no se establece cookie de sesión

    throw new Error("Not implemented");
  });

  it("AC-3: Login de usuario inactivo [FR-2]", () => {
    // Given un usuario del panel cuyo campo `activo` es `false`
    // When hace `POST /api/admin/auth/login` con la contraseña correcta
    // Then recibe 401 con `error = "CREDENCIALES_INVALIDAS"` (mismo cuerpo que el caso de contraseña incorrecta)

    throw new Error("Not implemented");
  });

  it("AC-4: Acceso sin sesión bloqueado [FR-6, NFR-S1]", () => {
    // Given una petición sin cookie de sesión válida
    // When hace `GET /api/admin/especialidades`
    // Then recibe 401 con `error = "NO_AUTENTICADO"`

    throw new Error("Not implemented");
  });

  it("AC-5: Acceso con rol no autorizado [FR-7, NFR-S7]", () => {
    // Given una sesión válida con rol `PROFESIONAL`
    // When hace `POST /api/admin/especialidades` con un cuerpo válido
    // Then recibe 403 con `error = "NO_AUTORIZADO"`
    // Then no se crea ninguna especialidad

    throw new Error("Not implemented");
  });

  it("AC-6: Rate limiting de login [NFR-S2]", () => {
    // Given 5 intentos de login fallidos para el email `coord@hospital.test` en los últimos 10 minutos
    // When se hace un 6º `POST /api/admin/auth/login` con ese email
    // Then recibe 429 con `error = "DEMASIADOS_INTENTOS"`
    // Then no se evalúan las credenciales

    throw new Error("Not implemented");
  });

  it("AC-7: Alta de usuario por ADMIN y reset de contraseña [FR-8, FR-5, FR-12]", () => {
    // Given una sesión con rol `ADMIN`
    // When hace `POST /api/admin/usuarios` con nombre, email nuevo y rol `RECEPCION`
    // Then recibe 201 con el usuario creado (sin contraseña ni hash)
    // Then el usuario puede iniciar sesión con la contraseña temporal devuelta o generada

    throw new Error("Not implemented");
  });

  it("AC-8: ADMIN no puede autodesactivarse [FR-10]", () => {
    // Given una sesión con rol `ADMIN` cuyo `usuarioId` es `U1`
    // When hace `PATCH /api/admin/usuarios/U1` con `{ "activo": false }`
    // Then recibe 409 con `error = "OPERACION_SOBRE_SI_MISMO"`
    // Then su cuenta sigue activa

    throw new Error("Not implemented");
  });

  it("AC-9: Desactivar cuenta cierra su sesión y no borra el usuario [FR-9, FR-11, NFR-S4]", () => {
    // Given el usuario `U2` tiene una sesión activa
    // When un `ADMIN` hace `PATCH /api/admin/usuarios/U2` con `{ "activo": false }`
    // Then la siguiente petición autenticada de `U2` recibe 401
    // Then `U2` no puede volver a iniciar sesión
    // Then el registro de `U2` sigue existiendo (no hay endpoint de hard delete de usuarios)

    throw new Error("Not implemented");
  });

  it("AC-10: Logout invalida la sesión [FR-11]", () => {
    // Given una sesión válida
    // When hace `POST /api/admin/auth/logout`
    // Then recibe 204, la cookie de sesión se elimina
    // Then una petición posterior con esa cookie recibe 401

    throw new Error("Not implemented");
  });

  it("AC-11: Alta de especialidad [FR-13, FR-24]", () => {
    // Given una sesión con rol `ADMIN`
    // When hace `POST /api/admin/especialidades` con `{ "nombre": "Cardiología infantil", "duracionTurnoMin": 20 }`
    // Then recibe 201 con la especialidad creada y `activa = true`

    throw new Error("Not implemented");
  });

  it("AC-12: Especialidad con nombre duplicado [FR-24]", () => {
    // Given ya existe una especialidad "Cardiología infantil"
    // When se hace `POST /api/admin/especialidades` con `{ "nombre": "cardiología INFANTIL", "duracionTurnoMin": 30 }`
    // Then recibe 409 con `error = "NOMBRE_DUPLICADO"`

    throw new Error("Not implemented");
  });

  it("AC-13: Duración de turno inválida [FR-13]", () => {
    // Given una sesión con rol `ADMIN`
    // When hace `POST /api/admin/especialidades` con `{ "nombre": "Test", "duracionTurnoMin": 22 }`
    // Then recibe 400 con `error = "VALIDACION"` y `details.duracionTurnoMin` indicando que debe ser múltiplo de 5 entre 5 y 120

    throw new Error("Not implemented");
  });

  it("AC-14: Alta de profesional con especialidad [FR-14]", () => {
    // Given existe la especialidad "Pediatría general"
    // When un `COORDINACION` hace `POST /api/admin/profesionales` con nombre, apellido, matrícula y `especialidadIds` con esa especialidad
    // Then recibe 201 con el profesional creado y su lista de especialidades

    throw new Error("Not implemented");
  });

  it("AC-15: Profesional sin especialidad rechazado [FR-14]", () => {
    // Given una sesión con rol `COORDINACION`
    // When hace `POST /api/admin/profesionales` con `especialidadIds: []`
    // Then recibe 400 con `error = "VALIDACION"` y `details.especialidadIds` indicando que se requiere al menos una

    throw new Error("Not implemented");
  });

  it("AC-16: Un usuario PROFESIONAL no puede vincularse a dos profesionales [FR-15]", () => {
    // Given el usuario `U5` (rol `PROFESIONAL`) ya está vinculado al profesional `P1`
    // When se hace `PATCH /api/admin/profesionales/P2` con `{ "usuarioId": "U5" }`
    // Then recibe 409 con `error = "USUARIO_YA_VINCULADO"`

    throw new Error("Not implemented");
  });

  it("AC-17: Alta de categoría de problema [FR-16]", () => {
    // Given una sesión con rol `ADMIN`
    // When hace `POST /api/admin/categorias` con `{ "nombre": "Tos y mocos hace varios días", "prioridadBase": "NORMAL", "derivarAGuardia": false }`
    // Then recibe 201 con la categoría creada

    throw new Error("Not implemented");
  });

  it("AC-18: Mapeo categoría → especialidad muchos a muchos [FR-17]", () => {
    // Given existen la categoría `C1` y las especialidades `E1` y `E2`
    // When un `ADMIN` hace `PUT /api/admin/categorias/C1/especialidades` con `[{ "especialidadId": "E1" }, { "especialidadId": "E2", "nota": "Si además hay fiebre" }]`
    // Then recibe 200 y la categoría `C1` queda mapeada a `E1` y `E2` con la nota en `E2`

    throw new Error("Not implemented");
  });

  it("AC-19: Categoría marcada 'derivar a guardia' no admite mapeos [FR-18]", () => {
    // Given la categoría `C2` tiene `derivarAGuardia = true`
    // When se hace `PUT /api/admin/categorias/C2/especialidades` con `[{ "especialidadId": "E1" }]`
    // Then recibe 409 con `error = "CATEGORIA_DERIVA_A_GUARDIA"`

    throw new Error("Not implemented");
  });

  it("AC-20: No se puede marcar derivarAGuardia con mapeos existentes [FR-18]", () => {
    // Given la categoría `C3` está mapeada a la especialidad `E1`
    // When se hace `PATCH /api/admin/categorias/C3` con `{ "derivarAGuardia": true }`
    // Then recibe 409 con `error = "CATEGORIA_TIENE_MAPEOS"`

    throw new Error("Not implemented");
  });

  it("AC-21: Alta de sala y de obra social [FR-19, FR-20]", () => {
    // Given una sesión con rol `COORDINACION` para salas y `ADMIN` para obras sociales
    // When hace `POST /api/admin/salas` con `{ "identificador": "Consultorio 4", "ubicacion": "PB ala este" }` y `POST /api/admin/obras-sociales` con `{ "nombre": "OSDE" }`
    // Then ambas devuelven 201 con la entidad creada y `activa = true`

    throw new Error("Not implemented");
  });

  it("AC-22: No se puede desactivar una especialidad usada por una franja activa [FR-21]", () => {
    // Given la especialidad `E1` está referenciada por la franja activa `F1`
    // When se hace `PATCH /api/admin/especialidades/E1` con `{ "activa": false }`
    // Then recibe 409 con `error = "ENTIDAD_EN_USO"` y `details.franjas` lista `F1`

    throw new Error("Not implemented");
  });

  it("AC-23: Entidades desactivadas se excluyen del listado por defecto [FR-22]", () => {
    // Given la obra social `OS9` está desactivada
    // When se hace `GET /api/admin/obras-sociales`
    // Then la respuesta no incluye `OS9`
    // Then `GET /api/admin/obras-sociales?incluirInactivas=true` sí la incluye

    throw new Error("Not implemented");
  });

  it("AC-24: Reordenar categorías [FR-23]", () => {
    // Given existen categorías `C1` (orden 1) y `C2` (orden 2)
    // When un `ADMIN` hace `PATCH /api/admin/categorias/C2` con `{ "orden": 0 }`
    // Then `GET /api/admin/categorias` devuelve `C2` antes que `C1`

    throw new Error("Not implemented");
  });

  it("AC-25: Alta de franja de agenda válida [FR-25, FR-26]", () => {
    // Given el profesional `P1` atiende "Pediatría general" (duración 15 min) y existe la sala `S1`
    // When un `COORDINACION` hace `POST /api/admin/franjas` con día `LUNES`, `08:00`–`12:00`, especialidad de `P1`, sala `S1`, `vigenciaDesde` hoy
    // Then recibe 201 con la franja creada

    throw new Error("Not implemented");
  });

  it("AC-26: Franja con fin anterior al inicio [FR-26]", () => {
    // Given una sesión con rol `COORDINACION`
    // When hace `POST /api/admin/franjas` con `horaInicio = "12:00"` y `horaFin = "08:00"`
    // Then recibe 400 con `error = "VALIDACION"` y `details.horaFin`

    throw new Error("Not implemented");
  });

  it("AC-27: Franja con duración no múltiplo de la duración de turno [FR-26]", () => {
    // Given la especialidad de `P1` tiene duración de turno 20 min
    // When se hace `POST /api/admin/franjas` para `P1` con `08:00`–`08:30`
    // Then recibe 400 con `error = "VALIDACION"` indicando que el rango debe ser múltiplo de 20 minutos

    throw new Error("Not implemented");
  });

  it("AC-28: Franjas solapadas del mismo profesional [FR-27]", () => {
    // Given `P1` tiene una franja activa los lunes `08:00`–`12:00` vigente todo el año
    // When se hace `POST /api/admin/franjas` para `P1` los lunes `11:00`–`13:00` con vigencia solapada
    // Then recibe 409 con `error = "FRANJA_SOLAPADA"` y `details.franjaId` de la franja en conflicto

    throw new Error("Not implemented");
  });

  it("AC-29: Excepción de bloqueo elimina slots y dispara regeneración incremental [FR-28, FR-29, FR-32, FR-39]", () => {
    // Given `P1` tiene franja los lunes `08:00`–`12:00` y hay slots generados para el lunes `2026-09-14`
    // When un `COORDINACION` hace `POST /api/admin/excepciones` con `{ "profesionalId": "P1", "fecha": "2026-09-14", "tipo": "BLOQUEO", "motivo": "Licencia" }`
    // Then recibe 201
    // Then se dispara automáticamente la regeneración incremental de `P1` para las fechas afectadas
    // Then los slots `DISPONIBLE` de `P1` del `2026-09-14` quedan eliminados; un slot en cualquier otro estado se conserva marcado `huerfano`

    throw new Error("Not implemented");
  });

  it("AC-30: Excepción de apertura [FR-30, FR-34]", () => {
    // Given `P1` no tiene franja los sábados
    // When un `COORDINACION` hace `POST /api/admin/excepciones` con `{ "profesionalId": "P1", "fecha": "2026-09-13", "tipo": "APERTURA", "horaInicio": "09:00", "horaFin": "12:00", "especialidadId": "...", "salaId": "..." }`
    // Then recibe 201
    // Then tras la regeneración incremental existen slots `DISPONIBLE` de `P1` el `2026-09-13` entre `09:00` y `12:00` con `origen = "APERTURA"`

    throw new Error("Not implemented");
  });

  it("AC-31: Apertura solapada con franja vigente [FR-31]", () => {
    // Given `P1` tiene franja los lunes `08:00`–`12:00` vigente
    // When se hace `POST /api/admin/excepciones` de tipo `APERTURA` para `P1` un lunes dentro de la vigencia, `10:00`–`13:00`
    // Then recibe 409 con `error = "APERTURA_SOLAPADA"`

    throw new Error("Not implemented");
  });

  it("AC-32: Generación de slots desde una franja [FR-33, FR-34, FR-35, FR-36]", () => {
    // Given `P1` tiene una única franja los lunes `08:00`–`09:00`, especialidad con duración 15 min, sin excepciones, y `ventana_generacion_dias = 45`
    // When se ejecuta la generación de slots
    // Then para cada lunes en `[hoy, hoy+45]` existen exactamente 4 slots de `P1` (`08:00`, `08:15`, `08:30`, `08:45`), estado `DISPONIBLE`, `origen = "FRANJA"`

    throw new Error("Not implemented");
  });

  it("AC-33: Resto final menor a la duración se descarta [FR-35]", () => {
    // Given `P1` tiene una franja los martes `08:00`–`08:50`, especialidad con duración 20 min
    // When se ejecuta la generación
    // Then para cada martes en la ventana existen 2 slots (`08:00`, `08:20`) y ningún slot que empiece `08:40`

    throw new Error("Not implemented");
  });

  it("AC-34: Generación idempotente [FR-38]", () => {
    // Given ya se generaron los slots de `P1` para la ventana y ninguno cambió de estado
    // When se ejecuta la generación de slots una segunda vez sin cambios en agendas
    // Then el resumen indica `creados = 0`, `eliminados = 0`
    // Then los identificadores y datos de los slots existentes no cambian

    throw new Error("Not implemented");
  });

  it("AC-35: Unicidad de slot [FR-37]", () => {
    // Given existe un slot de `P1` para `2026-09-14 08:00`
    // When un proceso intenta insertar otro slot de `P1` para `2026-09-14 08:00`
    // Then la base de datos rechaza la inserción por violación de unique constraint
    // Then la generación lo trata como "sin cambios", no como error

    throw new Error("Not implemented");
  });

  it("AC-36: No se generan slots en el pasado ni para entidades inactivas [FR-41]", () => {
    // Given `P1` está desactivado y `P2` está activo con franja los lunes
    // When se ejecuta la generación
    // Then no existe ningún slot nuevo de `P1`
    // Then no existe ningún slot con fecha anterior a hoy

    throw new Error("Not implemented");
  });

  it("AC-37: Generación manual devuelve resumen y queda registrada [FR-40, FR-42]", () => {
    // Given una sesión con rol `COORDINACION`
    // When hace `POST /api/admin/slots/generar` con `{ "profesionalId": "P1" }`
    // Then recibe 200 con `{ "creados": <n>, "eliminados": <m>, "sinCambios": <k>, "profesionales": 1, "corridaId": "<id>" }`
    // Then existe una fila en `CorridaGeneracion` con `disparador = "MANUAL"`, el `actorId` de la sesión y esos contadores

    throw new Error("Not implemented");
  });

  it("AC-38: Edición de parámetros del sistema [FR-43]", () => {
    // Given una sesión con rol `ADMIN`
    // When hace `PATCH /api/admin/parametros` con `{ "ventana_reserva_dias": 21 }`
    // Then recibe 200 con los parámetros actualizados
    // Then `GET /api/admin/parametros` refleja `ventana_reserva_dias = 21`

    throw new Error("Not implemented");
  });

  it("AC-39: Parámetro fuera de rango [FR-43]", () => {
    // Given una sesión con rol `ADMIN`
    // When hace `PATCH /api/admin/parametros` con `{ "antelacion_minima_horas": -1 }`
    // Then recibe 400 con `error = "VALIDACION"`

    throw new Error("Not implemented");
  });

  it("AC-40: Auditoría de operaciones sensibles [FR-44, FR-45]", () => {
    // Given una sesión con rol `COORDINACION` que crea la franja `F9`
    // When un `ADMIN` hace `GET /api/admin/auditoria?entidad=franja`
    // Then la respuesta incluye un registro con `accion = "CREAR"`, `entidad = "franja"`, `entidadId = "F9"`, el `actorId` de Coordinación y un `timestamp` UTC

    throw new Error("Not implemented");
  });

  it("AC-41: Registros de auditoría inmutables [FR-46, NFR-S7]", () => {
    // Given existe el registro de auditoría `A1`
    // When cualquier rol hace `PATCH` o `DELETE` sobre `/api/admin/auditoria/A1`
    // Then recibe 405 o 404 (el recurso no expone escritura)
    // Then `A1` permanece sin cambios

    throw new Error("Not implemented");
  });

  it("AC-42: Seed idempotente [FR-47, FR-48]", () => {
    // Given una base de datos de desarrollo vacía
    // When se ejecuta el script de seed dos veces consecutivas
    // Then la primera corrida crea el catálogo ficticio completo (4 usuarios, ≥ 8 especialidades, 2–3 profesionales por especialidad, 15–20 categorías con ≥ 2 `derivarAGuardia`, ≥ 6 salas, ≥ 8 obras sociales, franjas para ≥ la mitad de los profesionales)
    // Then la segunda corrida no crea duplicados ni lanza error
    // Then ejecutar el seed con la variable de entorno de producción activa aborta sin escribir

    throw new Error("Not implemented");
  });

  it("AC-43: Transaccionalidad de la generación por profesional [NFR-R1]", () => {
    // Given la generación de slots de `P1` falla a mitad por un error simulado de base de datos
    // When termina la corrida
    // Then el conjunto de slots de `P1` es idéntico al que había antes de la corrida (sin slots parciales)
    // Then la corrida de los demás profesionales no se ve afectada

    throw new Error("Not implemented");
  });

  it("AC-44: Cálculo de slots aislado y testeable [NFR-M2]", () => {
    // Given un conjunto de franjas y excepciones en memoria y un rango de fechas
    // When se invoca la función pura de cálculo de slots sin conexión a base de datos
    // Then devuelve la lista esperada de slots (profesional, fecha, hora inicio, hora fin, origen) para ese rango

    throw new Error("Not implemented");
  });

  it("AC-45: Franjas y slots respetan zona horaria [NFR-R4]", () => {
    // Given una franja los lunes `08:00`–`09:00` hora Argentina
    // When se generan los slots y se consultan sus timestamps almacenados
    // Then los timestamps están en UTC y, presentados en `America/Argentina/Buenos_Aires`, corresponden a `08:00`–`09:00` de ese lunes

    throw new Error("Not implemented");
  });

  // --- Edge Cases ---

  it("EC-1: Email vacío o con formato inválido en login", () => {
    // Condition: Email vacío o con formato inválido en login
    // Expected: 400 `VALIDACION`, no se consulta la base de credenciales

    throw new Error("Not implemented");
  });

  it("EC-2: Cuerpo JSON malformado en cualquier endpoint de escritura", () => {
    // Condition: Cuerpo JSON malformado en cualquier endpoint de escritura
    // Expected: 400 `JSON_INVALIDO`, sin efectos secundarios

    throw new Error("Not implemented");
  });

  it("EC-3: Cookie de sesión presente pero firmada/expirada/no encontrada en el store", () => {
    // Condition: Cookie de sesión presente pero firmada/expirada/no encontrada en el store
    // Expected: 401 `NO_AUTENTICADO`, se limpia la cookie

    throw new Error("Not implemented");
  });

  it("EC-4: Dos `ADMIN` crean simultáneamente una especialidad con el mismo nombre", () => {
    // Condition: Dos `ADMIN` crean simultáneamente una especialidad con el mismo nombre
    // Expected: la primera transacción hace 201, la segunda recibe 409 `NOMBRE_DUPLICADO` por el unique constraint

    throw new Error("Not implemented");
  });

  it("EC-5: Pérdida de conexión a PostgreSQL durante una operación de ABM", () => {
    // Condition: Pérdida de conexión a PostgreSQL durante una operación de ABM
    // Expected: 503 `BASE_DE_DATOS_NO_DISPONIBLE`, la operación no se confirma, sin estado parcial

    throw new Error("Not implemented");
  });

  it("EC-6: Se elimina una franja mientras el job de generación la está procesando", () => {
    // Condition: Se elimina una franja mientras el job de generación la está procesando
    // Expected: la corrida en curso puede generar slots de esa franja; la siguiente corrida (o la incremental disparada por el borrado) los elimina si siguen `DISPONIBLE`

    throw new Error("Not implemented");
  });

  it("EC-7: Excepción de `APERTURA` cuya duración no es múltiplo de la duración de turno de la especialidad", () => {
    // Condition: Excepción de `APERTURA` cuya duración no es múltiplo de la duración de turno de la especialidad
    // Expected: 400 `VALIDACION`

    throw new Error("Not implemented");
  });

  it("EC-8: Excepción de `BLOQUEO` para una fecha en la que el profesional no tenía franja ni apertura", () => {
    // Condition: Excepción de `BLOQUEO` para una fecha en la que el profesional no tenía franja ni apertura
    // Expected: se acepta (201) y no tiene efecto sobre los slots

    throw new Error("Not implemented");
  });

  it("EC-9: Franja con `vigenciaHasta` anterior a `vigenciaDesde`", () => {
    // Condition: Franja con `vigenciaHasta` anterior a `vigenciaDesde`
    // Expected: 400 `VALIDACION`

    throw new Error("Not implemented");
  });

  it("EC-10: Franja que cruza la medianoche (`horaInicio` 22:00, `horaFin` 02:00)", () => {
    // Condition: Franja que cruza la medianoche (`horaInicio` 22:00, `horaFin` 02:00)
    // Expected: 400 `VALIDACION` (no se soportan franjas que cruzan de día en el MVP)

    throw new Error("Not implemented");
  });

  it("EC-11: Cambio de la duración de turno de una especialidad con franjas y slots existentes", () => {
    // Condition: Cambio de la duración de turno de una especialidad con franjas y slots existentes
    // Expected: las franjas cuya duración deja de ser múltiplo quedan marcadas como inconsistentes y se listan; la generación no procesa esas franjas hasta corregirlas, y no borra slots ya `DISPONIBLE` de corridas previas salvo regeneración explícita

    throw new Error("Not implemented");
  });

  it("EC-12: `ventana_generacion_dias` se reduce (ej. de 45 a 20)", () => {
    // Condition: `ventana_generacion_dias` se reduce (ej. de 45 a 20)
    // Expected: la siguiente corrida elimina los slots `DISPONIBLE` fuera de la nueva ventana; los slots en otros estados se conservan

    throw new Error("Not implemented");
  });

  it("EC-14: El job programado arranca mientras otra corrida sigue activa", () => {
    // Condition: El job programado arranca mientras otra corrida sigue activa
    // Expected: la nueva corrida detecta el lock lógico (`NFR-R3`) y termina inmediatamente registrando "saltada por solapamiento"

    throw new Error("Not implemented");
  });

  it("EC-15: Profesional vinculado a un usuario que luego se desactiva", () => {
    // Condition: Profesional vinculado a un usuario que luego se desactiva
    // Expected: el profesional sigue activo y sus agendas/slots no se ven afectados; solo se pierde el acceso de solo lectura de ese usuario

    throw new Error("Not implemented");
  });

  it("EC-16: Se intenta desactivar el único `ADMIN` activo del sistema", () => {
    // Condition: Se intenta desactivar el único `ADMIN` activo del sistema
    // Expected: 409 `ULTIMO_ADMIN`, la operación se rechaza

    throw new Error("Not implemented");
  });

  it("EC-17: Paginación con `page` fuera de rango o `pageSize` > 100", () => {
    // Condition: Paginación con `page` fuera de rango o `pageSize` > 100
    // Expected: se normaliza a límites válidos (pageSize máximo 100), respuesta 200 con lista vacía si la página excede el total

    throw new Error("Not implemented");
  });

  it("EC-18: Matrícula de profesional duplicada", () => {
    // Condition: Matrícula de profesional duplicada
    // Expected: 409 `MATRICULA_DUPLICADA`

    throw new Error("Not implemented");
  });

  it("EC-19: Mapeo categoría", () => {
    // Condition: Mapeo categoría
    // Expected: especialidad que referencia una especialidad inexistente o inactiva → 400 `VALIDACION` con el id ofensor en `details`

    throw new Error("Not implemented");
  });

  it("EC-20: Corrida de generación sin ninguna franja ni excepción en el sistema", () => {
    // Condition: Corrida de generación sin ninguna franja ni excepción en el sistema
    // Expected: 200 con `creados = 0`, no es error

    throw new Error("Not implemented");
  });

});
