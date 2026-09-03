# Spec: Fase 1 — Núcleo administrativo (Turnero JP)

**Author:** Lautaro Mateo (lautaromateol@gmail.com)
**Date:** 2026-09-03
**Status:** In Review
**Reviewers:** (pendiente de asignar)
**Related specs:** Fase 2 — Operación del día (pendiente), Fase 3 — Canal ciudadano web (pendiente), Fase 4 — Bot de WhatsApp (pendiente)
**Documentos base:** [vision-producto.md](../vision-producto.md), [decisiones-mvp.md](../decisiones-mvp.md), [stack-y-fases.md](../stack-y-fases.md)

---

## Context

Turnero JP es un sistema de turnos para un hospital pediátrico público (un solo efector, single-tenant, greenfield sin integración con HIS). El producto tiene tres canales de entrada — panel administrativo, formulario ciudadano web y bot de WhatsApp — pero todos operan sobre el mismo backend y base de datos. Nada de eso puede construirse hasta que exista el núcleo administrativo: el modelo de datos, la autenticación del personal y la capacidad de cargar la información operativa del hospital (especialidades, profesionales, categorías de problema en lenguaje común, salas, obras sociales) y las agendas de las que se derivan los turnos.

Esta fase no expone ninguna funcionalidad al ciudadano ni genera turnos reservables por el público. Su entregable es un panel interno usable por los 4 roles del hospital (Administrador/TI, Coordinación, Recepción/Admisión, Profesional) que permite: iniciar sesión con email y contraseña, administrar los seis catálogos base, definir agendas como franjas semanales recurrentes con excepciones puntuales, y generar automáticamente los slots de las próximas semanas a partir de esas agendas. Sobre esos slots operarán la Fase 2 (operación del día) y la Fase 3 (reserva ciudadana).

El riesgo principal que esta fase mitiga es el de rework: si el modelo de datos o el esquema de agendas/slots queda mal definido, las tres fases siguientes heredan el error. Por eso el spec fija con precisión el modelo de datos completo del MVP (aunque varias entidades solo se *usen* en fases posteriores) y la mecánica de generación de slots.

Restricciones heredadas de las decisiones de MVP: Next.js App Router + TypeScript + PostgreSQL + Prisma; auth con email/contraseña y sesión en cookie httpOnly; sin Redis; español de Argentina sin i18n; panel desktop-first con responsive básico; apuntar a WCAG 2.1 AA razonable; Ley 25.326 (datos de salud de menores) — hashing de contraseñas, HTTPS, audit log de acciones desde el inicio.

---

## Functional Requirements

### Autenticación y roles

- FR-1: El sistema MUST permitir a un usuario del panel iniciar sesión con email y contraseña.
- FR-2: El sistema MUST rechazar el inicio de sesión cuando el email no existe, la contraseña no coincide, o el usuario está marcado como inactivo, devolviendo un error genérico que no distingue entre esos casos.
- FR-3: El sistema MUST almacenar las contraseñas hasheadas con un algoritmo de derivación lento (argon2id o bcrypt con cost ≥ 12) y MUST NOT devolver el hash ni la contraseña en ninguna respuesta de API.
- FR-4: El sistema MUST mantener la sesión mediante una cookie httpOnly, Secure y SameSite=Lax, con expiración máxima de 8 horas de inactividad.
- FR-5: El sistema MUST soportar exactamente cuatro roles: `ADMIN`, `COORDINACION`, `RECEPCION`, `PROFESIONAL`.
- FR-6: El sistema MUST rechazar con 401 toda petición a rutas o endpoints bajo `/admin` sin sesión válida, excepto la propia pantalla de login y el endpoint de login.
- FR-7: El sistema MUST rechazar con 403 toda petición a un endpoint cuando el rol de la sesión no está autorizado para esa operación, según la matriz de autorización de la sección API Contracts.
- FR-8: El sistema MUST permitir a un usuario `ADMIN` crear, editar, activar y desactivar usuarios del panel, asignándoles uno de los cuatro roles.
- FR-9: El sistema MUST NOT permitir eliminar (hard delete) usuarios del panel; la baja se hace por desactivación.
- FR-10: El sistema MUST NOT permitir que un usuario `ADMIN` se desactive a sí mismo ni cambie su propio rol.
- FR-11: El sistema MUST cerrar la sesión (invalidarla del lado servidor) cuando el usuario lo solicita explícitamente y cuando su cuenta es desactivada.
- FR-12: El sistema MUST permitir a un usuario `ADMIN` restablecer la contraseña de otro usuario del panel generando una contraseña temporal o un enlace de establecimiento; el ciudadano no tiene cuentas y queda fuera de esta fase.

### ABM de catálogos

- FR-13: El sistema MUST permitir crear, listar, editar y desactivar **especialidades**, cada una con nombre único y duración de turno en minutos (entero, 5–120, múltiplo de 5).
- FR-14: El sistema MUST permitir crear, listar, editar y desactivar **profesionales**, cada uno con nombre, apellido, matrícula y al menos una especialidad asociada.
- FR-15: El sistema MUST permitir vincular opcionalmente un profesional a un usuario del panel con rol `PROFESIONAL`, y MUST NOT permitir vincular el mismo usuario a más de un profesional.
- FR-16: El sistema MUST permitir crear, listar, editar y desactivar **categorías de problema**, cada una con nombre en lenguaje común, texto de ayuda opcional, prioridad base (nivel 1 `NORMAL`, 2 `PREFERENCIAL` o 3 `PRIORITARIO`), y una bandera `derivarAGuardia`.
- FR-17: El sistema MUST permitir definir el **mapeo categoría → especialidad** como relación muchos-a-muchos, con una nota aclaratoria opcional por par (para mostrarla al ciudadano cuando una categoría resuelve a más de una especialidad).
- FR-18: El sistema MUST NOT permitir que una categoría con `derivarAGuardia = true` tenga especialidades mapeadas, y MUST NOT permitir marcar `derivarAGuardia = true` en una categoría que ya tiene mapeos (hay que quitarlos primero).
- FR-19: El sistema MUST permitir crear, listar, editar y desactivar **salas / consultorios**, cada una con identificador (ej. "Consultorio 4"), ubicación textual opcional, y sin lógica de conflictos ni reserva como recurso.
- FR-20: El sistema MUST permitir crear, listar, editar y desactivar **obras sociales**, cada una con nombre único.
- FR-21: El sistema MUST impedir la desactivación de una especialidad, profesional o sala que esté referenciada por al menos una franja de agenda activa, devolviendo un error que identifique las franjas bloqueantes.
- FR-22: El sistema MUST conservar (no borrar) las entidades desactivadas y MUST excluirlas por defecto de los listados, ofreciendo un filtro para incluirlas.
- FR-23: El sistema SHOULD permitir reordenar las categorías de problema mediante un campo de orden entero, para controlar cómo se listan al ciudadano en fases posteriores.
- FR-24: Todas las operaciones de escritura de ABM MUST validar unicidad case-insensitive de los nombres declarados únicos (especialidad, obra social, matrícula de profesional, identificador de sala).

### Agendas: franjas y excepciones

- FR-25: El sistema MUST permitir a los roles `COORDINACION` y `ADMIN` definir la agenda de un profesional como un conjunto de **franjas semanales recurrentes**, cada una con: profesional, día de la semana (lunes–domingo), hora de inicio, hora de fin, especialidad (entre las del profesional), sala, y fecha de vigencia desde (obligatoria) y hasta (opcional).
- FR-26: El sistema MUST rechazar una franja cuya hora de fin no sea posterior a la hora de inicio, o cuya duración no sea múltiplo de la duración de turno de su especialidad.
- FR-27: El sistema MUST rechazar la creación o edición de una franja que se solape (mismo profesional, mismo día de semana, rango horario intersecante, períodos de vigencia intersecantes) con otra franja activa del mismo profesional.
- FR-28: El sistema MUST permitir editar y eliminar franjas; al eliminar o acortar una franja, MUST eliminar los slots futuros generados por ella que aún no estén ocupados, y MUST conservar los slots ocupados marcándolos como huérfanos para revisión (relevante en fases posteriores; en Fase 1 no hay slots ocupados).
- FR-29: El sistema MUST permitir registrar **excepciones de agenda** de tipo `BLOQUEO` (un profesional no atiende una fecha concreta, total o en un rango horario) con motivo textual.
- FR-30: El sistema MUST permitir registrar **excepciones de agenda** de tipo `APERTURA` (un profesional atiende una fecha concreta fuera de sus franjas habituales), especificando hora de inicio, hora de fin, especialidad, sala y motivo.
- FR-31: El sistema MUST rechazar una excepción de `APERTURA` que se solape con una franja recurrente vigente del mismo profesional para esa fecha, o con otra excepción de `APERTURA` de esa fecha.
- FR-32: El sistema MUST permitir eliminar una excepción; al eliminar un `BLOQUEO`, los slots correspondientes se regeneran en la próxima ejecución de generación; al eliminar una `APERTURA`, sus slots no ocupados MUST eliminarse.

### Generación de slots

- FR-33: El sistema MUST generar automáticamente los **slots** disponibles a partir de las franjas y excepciones, para el rango `[hoy, hoy + N días]`, donde `N` es el parámetro `ventana_generacion_dias` (default 45, configurable).
- FR-34: Para cada fecha dentro de la ventana, el sistema MUST calcular los slots así: tomar las franjas cuyo día de semana coincide y cuya vigencia cubre la fecha; sumar las excepciones de `APERTURA` de esa fecha; restar (no generar) los tramos cubiertos por excepciones de `BLOQUEO` de esa fecha.
- FR-35: El sistema MUST partir cada tramo resultante en slots consecutivos de duración igual a la duración de turno de la especialidad, descartando cualquier resto final menor a esa duración.
- FR-36: Cada slot generado MUST registrar: profesional, especialidad, sala, fecha, hora de inicio, hora de fin, origen (`FRANJA` o `APERTURA`), referencia a la franja o excepción de origen, y estado inicial `DISPONIBLE`.
- FR-37: El sistema MUST garantizar unicidad de `(profesional, fecha, hora_inicio)` a nivel de base de datos y MUST NOT crear un slot duplicado si ya existe uno para esa terna.
- FR-38: La generación MUST ser idempotente: ejecutarla varias veces sobre el mismo estado de agendas no crea, duplica ni altera slots ya existentes en estado `DISPONIBLE`, y no toca slots en cualquier otro estado.
- FR-39: El sistema MUST ejecutar la generación de slots (a) mediante un job programado que corre al menos una vez al día, y (b) de forma incremental tras cada alta o modificación de franja o excepción que afecte fechas dentro de la ventana.
- FR-40: El sistema MUST exponer a los roles `COORDINACION` y `ADMIN` una acción manual para disparar la generación de slots de un profesional o de todos, y MUST devolver un resumen (slots creados, eliminados, sin cambios).
- FR-41: El sistema MUST NOT generar slots para fechas pasadas ni para profesionales o especialidades desactivados.
- FR-42: El sistema SHOULD registrar cada corrida de generación (timestamp, disparador, contadores) para diagnóstico.

### Parámetros y auditoría

- FR-43: El sistema MUST exponer al rol `ADMIN` la edición de los parámetros del sistema: `ventana_reserva_dias` (default 30), `antelacion_minima_horas` (default 2), `reserva_temporal_minutos` (default 7), `ventana_generacion_dias` (default 45), `retencion_datos_meses` (default 12).
- FR-44: El sistema MUST escribir un registro de auditoría inmutable por cada operación de escritura sobre usuarios, franjas de agenda, excepciones y parámetros del sistema, incluyendo usuario actor, acción, entidad, identificador, timestamp UTC y, cuando aplique, motivo y snapshot del estado anterior y nuevo.
- FR-45: El sistema MUST permitir a los roles `ADMIN` y `COORDINACION` consultar el log de auditoría filtrando por rango de fechas, actor y entidad.
- FR-46: El sistema MUST NOT permitir editar ni borrar registros de auditoría desde ninguna interfaz.

### Datos semilla

- FR-47: El sistema MUST proveer un script de seed idempotente que cargue un catálogo ficticio realista: un usuario por cada uno de los 4 roles, ≥ 8 especialidades pediátricas típicas, 2–3 profesionales por especialidad, 15–20 categorías de problema con su mapeo a especialidad (incluyendo ≥ 2 categorías `derivarAGuardia`), ≥ 6 salas, ≥ 8 obras sociales, y franjas de agenda para al menos la mitad de los profesionales.
- FR-48: El seed MUST NOT ejecutarse automáticamente contra una base de datos marcada como producción (guard por variable de entorno).

---

## Non-Functional Requirements

### Rendimiento

- NFR-P1: Los listados de ABM MUST responder en < 400 ms (p95) con hasta 500 registros por entidad, usando paginación de 25 ítems por página.
- NFR-P2: La generación completa de slots para 60 profesionales, ventana de 45 días y franjas de ~4 h diarias MUST completarse en < 20 s en un entorno con PostgreSQL local.
- NFR-P3: La generación incremental tras editar una franja MUST completarse en < 2 s (p95).
- NFR-P4: Las consultas sobre la tabla de slots MUST usar índices; no se permiten full table scans sobre slots ni auditoría con > 10.000 filas.

### Seguridad

- NFR-S1: Todos los endpoints bajo `/api/admin/**` MUST requerir sesión válida, salvo `POST /api/admin/auth/login`.
- NFR-S2: Los intentos de login fallidos MUST estar limitados a 10 por cada 10 minutos por dirección IP y a 5 por cada 10 minutos por email.
- NFR-S3: Las contraseñas MUST tener un mínimo de 10 caracteres al establecerse o cambiarse.
- NFR-S4: La sesión MUST invalidarse del lado servidor al cambiar la contraseña del usuario o desactivar su cuenta.
- NFR-S5: Toda la aplicación MUST servirse exclusivamente sobre HTTPS en entornos desplegados; las cookies de sesión MUST llevar el flag Secure.
- NFR-S6: Los mensajes de error MUST NOT filtrar detalles internos (stack traces, nombres de tabla, SQL) al cliente.
- NFR-S7: La autorización por rol MUST verificarse en el servidor en cada endpoint; la ocultación de UI por rol es complementaria y no sustituye la verificación.

### Accesibilidad

- NFR-A1: Todos los campos de formulario del panel MUST tener label asociado programáticamente (WCAG 1.3.1).
- NFR-A2: El contraste de texto MUST cumplir una relación mínima de 4.5:1 (WCAG 1.4.3).
- NFR-A3: Todas las acciones (crear, editar, activar/desactivar, generar slots) MUST ser operables por teclado (WCAG 2.1.1) y los errores de validación MUST anunciarse mediante `aria-live` o asociación `aria-describedby`.

### Fiabilidad y datos

- NFR-R1: La generación de slots MUST ser transaccional por profesional: si falla a mitad, el estado de ese profesional queda como antes de la corrida (sin slots parciales).
- NFR-R2: Ninguna operación de ABM ni de agenda MUST producir pérdida de datos ante reinicio del proceso; toda escritura confirmada persiste en PostgreSQL.
- NFR-R3: El job programado MUST tolerar solapamiento: si una corrida anterior sigue en ejecución, la nueva se saltea (lock lógico) en lugar de correr en paralelo.
- NFR-R4: Todos los timestamps almacenados MUST estar en UTC; la presentación usa la zona horaria `America/Argentina/Buenos_Aires`.

### Mantenibilidad

- NFR-M1: El esquema de base de datos MUST estar versionado con migraciones de Prisma; no se aplican cambios de esquema manuales.
- NFR-M2: La lógica de cálculo de slots (dado un conjunto de franjas + excepciones + rango de fechas → lista de slots) MUST estar aislada en una función pura testeable sin base de datos.

---

## Acceptance Criteria

### AC-1: Login exitoso (FR-1, FR-4)
Given un usuario del panel activo con email `coord@hospital.test` y contraseña correcta
When hace `POST /api/admin/auth/login` con esas credenciales
Then recibe 200, se establece una cookie de sesión httpOnly + Secure + SameSite=Lax
And el cuerpo incluye su nombre y rol, y no incluye hash ni contraseña

### AC-2: Login con contraseña incorrecta (FR-2, FR-3)
Given un usuario del panel activo con email `coord@hospital.test`
When hace `POST /api/admin/auth/login` con una contraseña incorrecta
Then recibe 401 con `error = "CREDENCIALES_INVALIDAS"`
And no se establece cookie de sesión

### AC-3: Login de usuario inactivo (FR-2)
Given un usuario del panel cuyo campo `activo` es `false`
When hace `POST /api/admin/auth/login` con la contraseña correcta
Then recibe 401 con `error = "CREDENCIALES_INVALIDAS"` (mismo cuerpo que el caso de contraseña incorrecta)

### AC-4: Acceso sin sesión bloqueado (FR-6, NFR-S1)
Given una petición sin cookie de sesión válida
When hace `GET /api/admin/especialidades`
Then recibe 401 con `error = "NO_AUTENTICADO"`

### AC-5: Acceso con rol no autorizado (FR-7, NFR-S7)
Given una sesión válida con rol `PROFESIONAL`
When hace `POST /api/admin/especialidades` con un cuerpo válido
Then recibe 403 con `error = "NO_AUTORIZADO"`
And no se crea ninguna especialidad

### AC-6: Rate limiting de login (NFR-S2)
Given 5 intentos de login fallidos para el email `coord@hospital.test` en los últimos 10 minutos
When se hace un 6º `POST /api/admin/auth/login` con ese email
Then recibe 429 con `error = "DEMASIADOS_INTENTOS"`
And no se evalúan las credenciales

### AC-7: Alta de usuario por ADMIN (FR-8, FR-5)
Given una sesión con rol `ADMIN`
When hace `POST /api/admin/usuarios` con nombre, email nuevo y rol `RECEPCION`
Then recibe 201 con el usuario creado (sin contraseña ni hash)
And el usuario puede iniciar sesión con la contraseña temporal devuelta o generada

### AC-8: ADMIN no puede autodesactivarse (FR-10)
Given una sesión con rol `ADMIN` cuyo `usuarioId` es `U1`
When hace `PATCH /api/admin/usuarios/U1` con `{ "activo": false }`
Then recibe 409 con `error = "OPERACION_SOBRE_SI_MISMO"`
And su cuenta sigue activa

### AC-9: Desactivar cuenta cierra su sesión (FR-11, NFR-S4)
Given el usuario `U2` tiene una sesión activa
When un `ADMIN` hace `PATCH /api/admin/usuarios/U2` con `{ "activo": false }`
Then la siguiente petición autenticada de `U2` recibe 401
And `U2` no puede volver a iniciar sesión

### AC-10: Logout invalida la sesión (FR-11)
Given una sesión válida
When hace `POST /api/admin/auth/logout`
Then recibe 204, la cookie de sesión se elimina
And una petición posterior con esa cookie recibe 401

### AC-11: Alta de especialidad (FR-13, FR-24)
Given una sesión con rol `ADMIN`
When hace `POST /api/admin/especialidades` con `{ "nombre": "Cardiología infantil", "duracionTurnoMin": 20 }`
Then recibe 201 con la especialidad creada y `activa = true`

### AC-12: Especialidad con nombre duplicado (FR-24)
Given ya existe una especialidad "Cardiología infantil"
When se hace `POST /api/admin/especialidades` con `{ "nombre": "cardiología INFANTIL", "duracionTurnoMin": 30 }`
Then recibe 409 con `error = "NOMBRE_DUPLICADO"`

### AC-13: Duración de turno inválida (FR-13)
Given una sesión con rol `ADMIN`
When hace `POST /api/admin/especialidades` con `{ "nombre": "Test", "duracionTurnoMin": 22 }`
Then recibe 400 con `error = "VALIDACION"` y `details.duracionTurnoMin` indicando que debe ser múltiplo de 5 entre 5 y 120

### AC-14: Alta de profesional con especialidad (FR-14)
Given existe la especialidad "Pediatría general"
When un `COORDINACION` hace `POST /api/admin/profesionales` con nombre, apellido, matrícula y `especialidadIds` con esa especialidad
Then recibe 201 con el profesional creado y su lista de especialidades

### AC-15: Profesional sin especialidad rechazado (FR-14)
Given una sesión con rol `COORDINACION`
When hace `POST /api/admin/profesionales` con `especialidadIds: []`
Then recibe 400 con `error = "VALIDACION"` y `details.especialidadIds` indicando que se requiere al menos una

### AC-16: Un usuario PROFESIONAL no puede vincularse a dos profesionales (FR-15)
Given el usuario `U5` (rol `PROFESIONAL`) ya está vinculado al profesional `P1`
When se hace `PATCH /api/admin/profesionales/P2` con `{ "usuarioId": "U5" }`
Then recibe 409 con `error = "USUARIO_YA_VINCULADO"`

### AC-17: Alta de categoría de problema (FR-16)
Given una sesión con rol `ADMIN`
When hace `POST /api/admin/categorias` con `{ "nombre": "Tos y mocos hace varios días", "prioridadBase": "NORMAL", "derivarAGuardia": false }`
Then recibe 201 con la categoría creada

### AC-18: Mapeo categoría → especialidad muchos a muchos (FR-17)
Given existen la categoría `C1` y las especialidades `E1` y `E2`
When un `ADMIN` hace `PUT /api/admin/categorias/C1/especialidades` con `[{ "especialidadId": "E1" }, { "especialidadId": "E2", "nota": "Si además hay fiebre" }]`
Then recibe 200 y la categoría `C1` queda mapeada a `E1` y `E2` con la nota en `E2`

### AC-19: Categoría "derivar a guardia" no admite mapeos (FR-18)
Given la categoría `C2` tiene `derivarAGuardia = true`
When se hace `PUT /api/admin/categorias/C2/especialidades` con `[{ "especialidadId": "E1" }]`
Then recibe 409 con `error = "CATEGORIA_DERIVA_A_GUARDIA"`

### AC-20: No se puede marcar derivarAGuardia con mapeos existentes (FR-18)
Given la categoría `C3` está mapeada a la especialidad `E1`
When se hace `PATCH /api/admin/categorias/C3` con `{ "derivarAGuardia": true }`
Then recibe 409 con `error = "CATEGORIA_TIENE_MAPEOS"`

### AC-21: Alta de sala y de obra social (FR-19, FR-20)
Given una sesión con rol `COORDINACION` para salas y `ADMIN` para obras sociales
When hace `POST /api/admin/salas` con `{ "identificador": "Consultorio 4", "ubicacion": "PB ala este" }` y `POST /api/admin/obras-sociales` con `{ "nombre": "OSDE" }`
Then ambas devuelven 201 con la entidad creada y `activa = true`

### AC-22: No se puede desactivar una especialidad usada por una franja activa (FR-21)
Given la especialidad `E1` está referenciada por la franja activa `F1`
When se hace `PATCH /api/admin/especialidades/E1` con `{ "activa": false }`
Then recibe 409 con `error = "ENTIDAD_EN_USO"` y `details.franjas` lista `F1`

### AC-23: Entidades desactivadas se excluyen del listado por defecto (FR-22)
Given la obra social `OS9` está desactivada
When se hace `GET /api/admin/obras-sociales`
Then la respuesta no incluye `OS9`
And `GET /api/admin/obras-sociales?incluirInactivas=true` sí la incluye

### AC-24: Reordenar categorías (FR-23)
Given existen categorías `C1` (orden 1) y `C2` (orden 2)
When un `ADMIN` hace `PATCH /api/admin/categorias/C2` con `{ "orden": 0 }`
Then `GET /api/admin/categorias` devuelve `C2` antes que `C1`

### AC-25: Alta de franja de agenda válida (FR-25, FR-26)
Given el profesional `P1` atiende "Pediatría general" (duración 15 min) y existe la sala `S1`
When un `COORDINACION` hace `POST /api/admin/franjas` con día `LUNES`, `08:00`–`12:00`, especialidad de `P1`, sala `S1`, `vigenciaDesde` hoy
Then recibe 201 con la franja creada

### AC-26: Franja con fin anterior al inicio (FR-26)
Given una sesión con rol `COORDINACION`
When hace `POST /api/admin/franjas` con `horaInicio = "12:00"` y `horaFin = "08:00"`
Then recibe 400 con `error = "VALIDACION"` y `details.horaFin`

### AC-27: Franja con duración no múltiplo de la duración de turno (FR-26)
Given la especialidad de `P1` tiene duración de turno 20 min
When se hace `POST /api/admin/franjas` para `P1` con `08:00`–`08:30`
Then recibe 400 con `error = "VALIDACION"` indicando que el rango debe ser múltiplo de 20 minutos

### AC-28: Franjas solapadas del mismo profesional (FR-27)
Given `P1` tiene una franja activa los lunes `08:00`–`12:00` vigente todo el año
When se hace `POST /api/admin/franjas` para `P1` los lunes `11:00`–`13:00` con vigencia solapada
Then recibe 409 con `error = "FRANJA_SOLAPADA"` y `details.franjaId` de la franja en conflicto

### AC-29: Excepción de bloqueo (FR-29, FR-32)
Given `P1` tiene franja los lunes `08:00`–`12:00` y hay slots generados para el lunes `2026-09-14`
When un `COORDINACION` hace `POST /api/admin/excepciones` con `{ "profesionalId": "P1", "fecha": "2026-09-14", "tipo": "BLOQUEO", "motivo": "Licencia" }`
Then recibe 201
And tras la regeneración incremental, los slots `DISPONIBLE` de `P1` del `2026-09-14` quedan eliminados

### AC-30: Excepción de apertura (FR-30, FR-34)
Given `P1` no tiene franja los sábados
When un `COORDINACION` hace `POST /api/admin/excepciones` con `{ "profesionalId": "P1", "fecha": "2026-09-13", "tipo": "APERTURA", "horaInicio": "09:00", "horaFin": "12:00", "especialidadId": "...", "salaId": "..." }`
Then recibe 201
And tras la regeneración incremental existen slots `DISPONIBLE` de `P1` el `2026-09-13` entre `09:00` y `12:00` con `origen = "APERTURA"`

### AC-31: Apertura solapada con franja vigente (FR-31)
Given `P1` tiene franja los lunes `08:00`–`12:00` vigente
When se hace `POST /api/admin/excepciones` de tipo `APERTURA` para `P1` un lunes dentro de la vigencia, `10:00`–`13:00`
Then recibe 409 con `error = "APERTURA_SOLAPADA"`

### AC-32: Generación de slots desde una franja (FR-33, FR-34, FR-35, FR-36)
Given `P1` tiene una única franja los lunes `08:00`–`09:00`, especialidad con duración 15 min, sin excepciones, y `ventana_generacion_dias = 45`
When se ejecuta la generación de slots
Then para cada lunes en `[hoy, hoy+45]` existen exactamente 4 slots de `P1` (`08:00`, `08:15`, `08:30`, `08:45`), estado `DISPONIBLE`, `origen = "FRANJA"`

### AC-33: Resto final menor a la duración se descarta (FR-35)
Given `P1` tiene una franja los martes `08:00`–`08:50`, especialidad con duración 20 min
When se ejecuta la generación
Then para cada martes en la ventana existen 2 slots (`08:00`, `08:20`) y ningún slot que empiece `08:40`

### AC-34: Generación idempotente (FR-38)
Given ya se generaron los slots de `P1` para la ventana y ninguno cambió de estado
When se ejecuta la generación de slots una segunda vez sin cambios en agendas
Then el resumen indica `creados = 0`, `eliminados = 0`
And los identificadores y datos de los slots existentes no cambian

### AC-35: Unicidad de slot (FR-37)
Given existe un slot de `P1` para `2026-09-14 08:00`
When un proceso intenta insertar otro slot de `P1` para `2026-09-14 08:00`
Then la base de datos rechaza la inserción por violación de unique constraint
And la generación lo trata como "sin cambios", no como error

### AC-36: No se generan slots en el pasado ni para entidades inactivas (FR-41)
Given `P1` está desactivado y `P2` está activo con franja los lunes
When se ejecuta la generación
Then no existe ningún slot nuevo de `P1`
And no existe ningún slot con fecha anterior a hoy

### AC-37: Generación manual devuelve resumen (FR-40)
Given una sesión con rol `COORDINACION`
When hace `POST /api/admin/slots/generar` con `{ "profesionalId": "P1" }`
Then recibe 200 con `{ "creados": <n>, "eliminados": <m>, "sinCambios": <k>, "profesionales": 1 }`

### AC-38: Edición de parámetros del sistema (FR-43)
Given una sesión con rol `ADMIN`
When hace `PATCH /api/admin/parametros` con `{ "ventana_reserva_dias": 21 }`
Then recibe 200 con los parámetros actualizados
And `GET /api/admin/parametros` refleja `ventana_reserva_dias = 21`

### AC-39: Parámetro fuera de rango (FR-43)
Given una sesión con rol `ADMIN`
When hace `PATCH /api/admin/parametros` con `{ "antelacion_minima_horas": -1 }`
Then recibe 400 con `error = "VALIDACION"`

### AC-40: Auditoría de operaciones sensibles (FR-44, FR-45)
Given una sesión con rol `COORDINACION` que crea la franja `F9`
When un `ADMIN` hace `GET /api/admin/auditoria?entidad=franja`
Then la respuesta incluye un registro con `accion = "CREAR"`, `entidad = "franja"`, `entidadId = "F9"`, el `actorId` de Coordinación y un `timestamp` UTC

### AC-41: Registros de auditoría inmutables (FR-46, NFR-S7)
Given existe el registro de auditoría `A1`
When cualquier rol hace `PATCH` o `DELETE` sobre `/api/admin/auditoria/A1`
Then recibe 405 o 404 (el recurso no expone escritura)
And `A1` permanece sin cambios

### AC-42: Seed idempotente (FR-47, FR-48)
Given una base de datos de desarrollo vacía
When se ejecuta el script de seed dos veces consecutivas
Then la primera corrida crea el catálogo ficticio completo (4 usuarios, ≥ 8 especialidades, 2–3 profesionales por especialidad, 15–20 categorías con ≥ 2 `derivarAGuardia`, ≥ 6 salas, ≥ 8 obras sociales, franjas para ≥ la mitad de los profesionales)
And la segunda corrida no crea duplicados ni lanza error
And ejecutar el seed con la variable de entorno de producción activa aborta sin escribir

### AC-43: Transaccionalidad de la generación por profesional (NFR-R1)
Given la generación de slots de `P1` falla a mitad por un error simulado de base de datos
When termina la corrida
Then el conjunto de slots de `P1` es idéntico al que había antes de la corrida (sin slots parciales)
And la corrida de los demás profesionales no se ve afectada

### AC-44: Cálculo de slots aislado y testeable (NFR-M2)
Given un conjunto de franjas y excepciones en memoria y un rango de fechas
When se invoca la función pura de cálculo de slots sin conexión a base de datos
Then devuelve la lista esperada de slots (profesional, fecha, hora inicio, hora fin, origen) para ese rango

### AC-45: Franjas y slots respetan zona horaria (NFR-R4)
Given una franja los lunes `08:00`–`09:00` hora Argentina
When se generan los slots y se consultan sus timestamps almacenados
Then los timestamps están en UTC y, presentados en `America/Argentina/Buenos_Aires`, corresponden a `08:00`–`09:00` de ese lunes

---

## Edge Cases and Error Scenarios

- EC-1: Email vacío o con formato inválido en login → 400 `VALIDACION`, no se consulta la base de credenciales.
- EC-2: Cuerpo JSON malformado en cualquier endpoint de escritura → 400 `JSON_INVALIDO`, sin efectos secundarios.
- EC-3: Cookie de sesión presente pero firmada/expirada/no encontrada en el store → 401 `NO_AUTENTICADO`, se limpia la cookie.
- EC-4: Dos `ADMIN` crean simultáneamente una especialidad con el mismo nombre → la primera transacción hace 201, la segunda recibe 409 `NOMBRE_DUPLICADO` por el unique constraint.
- EC-5: Pérdida de conexión a PostgreSQL durante una operación de ABM → 503 `BASE_DE_DATOS_NO_DISPONIBLE`, la operación no se confirma, sin estado parcial.
- EC-6: Se elimina una franja mientras el job de generación la está procesando → la corrida en curso puede generar slots de esa franja; la siguiente corrida (o la incremental disparada por el borrado) los elimina si siguen `DISPONIBLE`.
- EC-7: Excepción de `APERTURA` cuya duración no es múltiplo de la duración de turno de la especialidad → 400 `VALIDACION`.
- EC-8: Excepción de `BLOQUEO` para una fecha en la que el profesional no tenía franja ni apertura → se acepta (201) y no tiene efecto sobre los slots.
- EC-9: Franja con `vigenciaHasta` anterior a `vigenciaDesde` → 400 `VALIDACION`.
- EC-10: Franja que cruza la medianoche (`horaInicio` 22:00, `horaFin` 02:00) → 400 `VALIDACION` (no se soportan franjas que cruzan de día en el MVP).
- EC-11: Cambio de la duración de turno de una especialidad con franjas y slots existentes → las franjas cuya duración deja de ser múltiplo quedan marcadas como inconsistentes y se listan; la generación no procesa esas franjas hasta corregirlas, y no borra slots ya `DISPONIBLE` de corridas previas salvo regeneración explícita.
- EC-12: `ventana_generacion_dias` se reduce (ej. de 45 a 20) → la siguiente corrida elimina los slots `DISPONIBLE` fuera de la nueva ventana; los slots en otros estados se conservan.
- EC-13: DST / cambio de hora — Argentina no aplica horario de verano actualmente; si se reintrodujera, la función de cálculo trabaja en hora local de pared y la conversión a UTC la resuelve la capa de persistencia; se documenta como riesgo conocido.
- EC-14: El job programado arranca mientras otra corrida sigue activa → la nueva corrida detecta el lock lógico (`NFR-R3`) y termina inmediatamente registrando "saltada por solapamiento".
- EC-15: Profesional vinculado a un usuario que luego se desactiva → el profesional sigue activo y sus agendas/slots no se ven afectados; solo se pierde el acceso de solo lectura de ese usuario.
- EC-16: Se intenta desactivar el único `ADMIN` activo del sistema → 409 `ULTIMO_ADMIN`, la operación se rechaza.
- EC-17: Paginación con `page` fuera de rango o `pageSize` > 100 → se normaliza a límites válidos (pageSize máximo 100), respuesta 200 con lista vacía si la página excede el total.
- EC-18: Matrícula de profesional duplicada → 409 `MATRICULA_DUPLICADA`.
- EC-19: Mapeo categoría → especialidad que referencia una especialidad inexistente o inactiva → 400 `VALIDACION` con el id ofensor en `details`.
- EC-20: Corrida de generación sin ninguna franja ni excepción en el sistema → 200 con `creados = 0`, no es error.

---

## API Contracts

Todos los endpoints son Route Handlers de Next.js bajo `/api/admin`. Autenticación por cookie de sesión httpOnly. Formato de error común:

```typescript
interface ApiError {
  error: string;                       // código legible por máquina, ej. "VALIDACION"
  message: string;                     // texto en español para el usuario
  details?: Record<string, string | string[]>; // errores por campo
}
```

Códigos de estado usados: 200, 201, 204, 400 (validación / JSON), 401 (no autenticado), 403 (no autorizado), 404 (no encontrado), 405 (método no permitido), 409 (conflicto), 429 (rate limit), 500 (error inesperado, genérico), 503 (base de datos no disponible).

### Matriz de autorización (rol → operación)

| Área | ADMIN | COORDINACION | RECEPCION | PROFESIONAL |
|------|-------|--------------|-----------|-------------|
| Login / logout / ver perfil propio | ✔ | ✔ | ✔ | ✔ |
| Usuarios del panel (ABM) | ✔ | ✗ | ✗ | ✗ |
| Parámetros del sistema | ✔ | ✗ | ✗ | ✗ |
| Especialidades, categorías, mapeo, obras sociales (ABM) | ✔ | lectura | lectura | lectura |
| Profesionales (ABM) | ✔ | ✔ | lectura | lectura |
| Salas (ABM) | ✔ | ✔ | lectura | lectura |
| Franjas de agenda y excepciones (ABM) | ✔ | ✔ | lectura | lectura (solo propias) |
| Generación manual de slots | ✔ | ✔ | ✗ | ✗ |
| Consultar auditoría | ✔ | ✔ | ✗ | ✗ |

Nota: Coordinación no administra usuarios del panel; esa área es exclusiva de ADMIN.

### Autenticación

```typescript
// POST /api/admin/auth/login        (público, rate-limited)
interface LoginRequest { email: string; password: string; } // email válido; password 1..128
interface LoginResponse { usuarioId: string; nombre: string; rol: Rol; }
// 200 + Set-Cookie: sesion=...; HttpOnly; Secure; SameSite=Lax; Max-Age=28800
// 400 VALIDACION | 401 CREDENCIALES_INVALIDAS | 429 DEMASIADOS_INTENTOS

// POST /api/admin/auth/logout       (autenticado)
// 204, elimina la cookie e invalida la sesión server-side

// GET  /api/admin/auth/me           (autenticado)
interface MeResponse { usuarioId: string; nombre: string; email: string; rol: Rol; profesionalId: string | null; }
```

### Usuarios del panel (solo ADMIN)

```typescript
type Rol = "ADMIN" | "COORDINACION" | "RECEPCION" | "PROFESIONAL";

// GET    /api/admin/usuarios?incluirInactivos=false&page=1&pageSize=25
interface UsuarioListItem { id: string; nombre: string; email: string; rol: Rol; activo: boolean; profesionalId: string | null; }
interface Paginated<T> { items: T[]; page: number; pageSize: number; total: number; }

// POST   /api/admin/usuarios
interface CrearUsuarioRequest { nombre: string; email: string; rol: Rol; } // email único; nombre 1..120
interface CrearUsuarioResponse { id: string; nombre: string; email: string; rol: Rol; activo: true; passwordTemporal: string; }
// 201 | 400 VALIDACION | 409 EMAIL_DUPLICADO

// PATCH  /api/admin/usuarios/:id
interface EditarUsuarioRequest { nombre?: string; rol?: Rol; activo?: boolean; }
// 200 | 400 VALIDACION | 409 OPERACION_SOBRE_SI_MISMO | 409 ULTIMO_ADMIN | 404 NO_ENCONTRADO

// POST   /api/admin/usuarios/:id/reset-password
interface ResetPasswordResponse { passwordTemporal: string; } // invalida sesiones del usuario
```

### Especialidades (lectura: todos; escritura: ADMIN)

```typescript
// GET    /api/admin/especialidades?incluirInactivas=false&page&pageSize
interface Especialidad { id: string; nombre: string; duracionTurnoMin: number; activa: boolean; }

// POST   /api/admin/especialidades
interface CrearEspecialidadRequest { nombre: string; duracionTurnoMin: number; } // nombre único ci; duracion 5..120 múltiplo de 5
// PATCH  /api/admin/especialidades/:id
interface EditarEspecialidadRequest { nombre?: string; duracionTurnoMin?: number; activa?: boolean; }
// 409 NOMBRE_DUPLICADO | 409 ENTIDAD_EN_USO (al desactivar con franjas activas) -> details.franjas: string[]
```

### Profesionales (lectura: todos; escritura: ADMIN, COORDINACION)

```typescript
// GET    /api/admin/profesionales?incluirInactivos=false&especialidadId=&page&pageSize
interface Profesional {
  id: string; nombre: string; apellido: string; matricula: string;
  especialidadIds: string[]; usuarioId: string | null; activo: boolean;
}
// POST   /api/admin/profesionales
interface CrearProfesionalRequest {
  nombre: string; apellido: string; matricula: string;   // matricula única ci
  especialidadIds: string[];                              // >= 1, todas activas y existentes
  usuarioId?: string | null;                              // opcional; usuario rol PROFESIONAL no vinculado
}
// PATCH  /api/admin/profesionales/:id  (mismos campos, todos opcionales)
// 409 MATRICULA_DUPLICADA | 409 USUARIO_YA_VINCULADO | 409 ENTIDAD_EN_USO | 400 VALIDACION
```

### Categorías de problema y mapeo (lectura: todos; escritura: ADMIN)

```typescript
type PrioridadBase = "NORMAL" | "PREFERENCIAL" | "PRIORITARIO"; // niveles 1..3; nivel 4 URGENTE no es categoría

// GET    /api/admin/categorias?incluirInactivas=false
interface Categoria {
  id: string; nombre: string; ayuda: string | null;
  prioridadBase: PrioridadBase; derivarAGuardia: boolean; orden: number; activa: boolean;
  especialidades: { especialidadId: string; nota: string | null }[];
}
// POST   /api/admin/categorias
interface CrearCategoriaRequest {
  nombre: string; ayuda?: string | null;
  prioridadBase: PrioridadBase; derivarAGuardia: boolean; orden?: number;
}
// PATCH  /api/admin/categorias/:id  (campos opcionales)
// 409 CATEGORIA_TIENE_MAPEOS (al pasar derivarAGuardia a true con mapeos)

// PUT    /api/admin/categorias/:id/especialidades
type MapeoRequest = { especialidadId: string; nota?: string | null }[];
// 200 | 409 CATEGORIA_DERIVA_A_GUARDIA | 400 VALIDACION (especialidad inexistente/inactiva)
```

### Salas y obras sociales

```typescript
// GET/POST/PATCH  /api/admin/salas          (lectura: todos; escritura: ADMIN, COORDINACION)
interface Sala { id: string; identificador: string; ubicacion: string | null; activa: boolean; } // identificador único ci

// GET/POST/PATCH  /api/admin/obras-sociales  (lectura: todos; escritura: ADMIN)
interface ObraSocial { id: string; nombre: string; activa: boolean; } // nombre único ci
```

### Franjas de agenda (lectura: todos; escritura: ADMIN, COORDINACION)

```typescript
type DiaSemana = "LUNES" | "MARTES" | "MIERCOLES" | "JUEVES" | "VIERNES" | "SABADO" | "DOMINGO";

// GET    /api/admin/franjas?profesionalId=&incluirInactivas=false
interface Franja {
  id: string; profesionalId: string; diaSemana: DiaSemana;
  horaInicio: string; horaFin: string;         // "HH:MM" 24h, misma fecha (no cruza medianoche)
  especialidadId: string; salaId: string;
  vigenciaDesde: string; vigenciaHasta: string | null; // "YYYY-MM-DD"
  activa: boolean; inconsistente: boolean;      // true si su duración dejó de ser múltiplo de la duración de turno
}
// POST   /api/admin/franjas   (mismos campos sin id/activa/inconsistente)
// PATCH  /api/admin/franjas/:id
// DELETE /api/admin/franjas/:id   -> elimina slots DISPONIBLE futuros de esa franja
// 409 FRANJA_SOLAPADA -> details.franjaId | 400 VALIDACION (fin<=inicio, no múltiplo, vigencia invertida, cruza medianoche)
```

### Excepciones de agenda (lectura: todos; escritura: ADMIN, COORDINACION)

```typescript
type TipoExcepcion = "BLOQUEO" | "APERTURA";

// GET    /api/admin/excepciones?profesionalId=&desde=&hasta=
interface Excepcion {
  id: string; profesionalId: string; fecha: string; tipo: TipoExcepcion;
  horaInicio: string | null; horaFin: string | null;   // null en BLOQUEO total; obligatorios en APERTURA
  especialidadId: string | null; salaId: string | null; // obligatorios en APERTURA
  motivo: string;
}
// POST   /api/admin/excepciones
// DELETE /api/admin/excepciones/:id
// 409 APERTURA_SOLAPADA | 400 VALIDACION
```

### Slots (lectura: ADMIN, COORDINACION, RECEPCION, PROFESIONAL-propios; generación: ADMIN, COORDINACION)

```typescript
type EstadoSlot = "DISPONIBLE" | "BLOQUEADO"; // otros estados (RESERVADO_TEMPORAL, OCUPADO) los agregan Fase 2/3
type OrigenSlot = "FRANJA" | "APERTURA";

// GET    /api/admin/slots?profesionalId=&desde=&hasta=&estado=
interface Slot {
  id: string; profesionalId: string; especialidadId: string; salaId: string;
  fecha: string; horaInicio: string; horaFin: string;   // fecha "YYYY-MM-DD", horas "HH:MM" locales
  inicioUtc: string; finUtc: string;                     // ISO 8601 UTC
  estado: EstadoSlot; origen: OrigenSlot; origenId: string;
}

// POST   /api/admin/slots/generar
interface GenerarSlotsRequest { profesionalId?: string; } // sin profesionalId => todos los activos
interface GenerarSlotsResponse {
  profesionales: number; creados: number; eliminados: number; sinCambios: number;
  franjasInconsistentesOmitidas: string[]; corridaId: string;
}
// 200 | 403 NO_AUTORIZADO
```

### Parámetros del sistema (lectura: ADMIN, COORDINACION; escritura: ADMIN)

```typescript
// GET / PATCH  /api/admin/parametros
interface Parametros {
  ventana_reserva_dias: number;        // 1..90,  default 30
  antelacion_minima_horas: number;     // 0..72,  default 2
  reserva_temporal_minutos: number;    // 1..30,  default 7
  ventana_generacion_dias: number;     // 7..120, default 45  (>= ventana_reserva_dias)
  retencion_datos_meses: number;       // 1..120, default 12
}
// 400 VALIDACION (fuera de rango, o ventana_generacion_dias < ventana_reserva_dias)
```

### Auditoría (lectura: ADMIN, COORDINACION; sin escritura)

```typescript
// GET /api/admin/auditoria?desde=&hasta=&actorId=&entidad=&page&pageSize
type EntidadAuditada = "usuario" | "franja" | "excepcion" | "parametros";
type AccionAuditada = "CREAR" | "EDITAR" | "ELIMINAR" | "DESACTIVAR" | "ACTIVAR" | "RESET_PASSWORD";
interface RegistroAuditoria {
  id: string; actorId: string; actorNombre: string;
  accion: AccionAuditada; entidad: EntidadAuditada; entidadId: string;
  motivo: string | null; antes: unknown | null; despues: unknown | null;
  timestamp: string; // ISO 8601 UTC
}
// PATCH/DELETE /api/admin/auditoria/:id -> 405 METODO_NO_PERMITIDO
```

---

## Data Models

Motor: PostgreSQL. ORM: Prisma. Todos los `id` son `uuid` (o `cuid`) PK autogenerados e inmutables. Todas las tablas tienen `createdAt` y `updatedAt` (`timestamptz`, UTC) salvo `auditoria` (solo `timestamp`, inmutable). Borrado: **soft delete por campo `activo`** en catálogos; **hard delete** permitido solo en `franja`, `excepcion_agenda` y `slot` (`DISPONIBLE`). Los nombres de tabla se muestran en singular conceptual; Prisma los mapea a snake_case plural.

### Usuario
| Field | Type | Constraints |
|-------|------|-------------|
| id | uuid | PK |
| nombre | varchar(120) | not null |
| email | citext | unique, not null, formato email |
| passwordHash | varchar(255) | not null, argon2id/bcrypt, nunca en respuestas |
| rol | enum(ADMIN, COORDINACION, RECEPCION, PROFESIONAL) | not null |
| activo | boolean | not null, default true |
| passwordActualizadaAt | timestamptz | not null |
| createdAt / updatedAt | timestamptz | UTC |

Índices: `email` (unique). Regla: siempre ≥ 1 usuario `ADMIN` con `activo = true` (validada en aplicación, EC-16).

### Sesion
| Field | Type | Constraints |
|-------|------|-------------|
| id | varchar(64) | PK, token opaco aleatorio |
| usuarioId | uuid | FK → Usuario, not null, on delete cascade |
| expiresAt | timestamptz | not null |
| createdAt | timestamptz | UTC |

Índices: `usuarioId`, `expiresAt`. Job de limpieza elimina sesiones vencidas. (Si se usa Auth.js/Lucia, esta tabla la define el adaptador; el contrato es equivalente.)

### Especialidad
| Field | Type | Constraints |
|-------|------|-------------|
| id | uuid | PK |
| nombre | citext | unique, not null |
| duracionTurnoMin | smallint | not null, 5..120, múltiplo de 5 |
| activa | boolean | not null, default true |

### Profesional
| Field | Type | Constraints |
|-------|------|-------------|
| id | uuid | PK |
| nombre | varchar(120) | not null |
| apellido | varchar(120) | not null |
| matricula | citext | unique, not null |
| usuarioId | uuid | FK → Usuario, unique, nullable; el usuario debe tener rol PROFESIONAL |
| activo | boolean | not null, default true |

### ProfesionalEspecialidad (N:M)
| Field | Type | Constraints |
|-------|------|-------------|
| profesionalId | uuid | FK → Profesional, PK compuesta |
| especialidadId | uuid | FK → Especialidad, PK compuesta |

### CategoriaProblema
| Field | Type | Constraints |
|-------|------|-------------|
| id | uuid | PK |
| nombre | citext | unique, not null |
| ayuda | text | nullable |
| prioridadBase | enum(NORMAL, PREFERENCIAL, PRIORITARIO) | not null, default NORMAL |
| derivarAGuardia | boolean | not null, default false |
| orden | integer | not null, default 0 |
| activa | boolean | not null, default true |

Regla: `derivarAGuardia = true` ⇒ 0 filas en `CategoriaEspecialidad` (FR-18).

### CategoriaEspecialidad (N:M con atributo)
| Field | Type | Constraints |
|-------|------|-------------|
| categoriaId | uuid | FK → CategoriaProblema, PK compuesta |
| especialidadId | uuid | FK → Especialidad, PK compuesta |
| nota | varchar(280) | nullable |

### Sala
| Field | Type | Constraints |
|-------|------|-------------|
| id | uuid | PK |
| identificador | citext | unique, not null (ej. "Consultorio 4") |
| ubicacion | varchar(200) | nullable |
| activa | boolean | not null, default true |

### ObraSocial
| Field | Type | Constraints |
|-------|------|-------------|
| id | uuid | PK |
| nombre | citext | unique, not null |
| activa | boolean | not null, default true |

### FranjaAgenda
| Field | Type | Constraints |
|-------|------|-------------|
| id | uuid | PK |
| profesionalId | uuid | FK → Profesional, not null |
| diaSemana | enum(LUNES..DOMINGO) | not null |
| horaInicio | time | not null |
| horaFin | time | not null, > horaInicio, mismo día |
| especialidadId | uuid | FK → Especialidad, not null, ∈ especialidades del profesional |
| salaId | uuid | FK → Sala, not null |
| vigenciaDesde | date | not null |
| vigenciaHasta | date | nullable, ≥ vigenciaDesde |
| activa | boolean | not null, default true |
| inconsistente | boolean | not null, default false (EC-11) |

Índices: `(profesionalId, diaSemana)`, `(profesionalId, activa)`. Solapamiento (FR-27) validado en aplicación dentro de transacción con lock por profesional.

### ExcepcionAgenda
| Field | Type | Constraints |
|-------|------|-------------|
| id | uuid | PK |
| profesionalId | uuid | FK → Profesional, not null |
| fecha | date | not null |
| tipo | enum(BLOQUEO, APERTURA) | not null |
| horaInicio | time | nullable (null ⇒ bloqueo de día completo); not null si APERTURA |
| horaFin | time | nullable; not null si APERTURA; > horaInicio |
| especialidadId | uuid | FK → Especialidad, nullable; not null si APERTURA |
| salaId | uuid | FK → Sala, nullable; not null si APERTURA |
| motivo | varchar(280) | not null |

Índices: `(profesionalId, fecha)`.

### Slot
| Field | Type | Constraints |
|-------|------|-------------|
| id | uuid | PK |
| profesionalId | uuid | FK → Profesional, not null |
| especialidadId | uuid | FK → Especialidad, not null |
| salaId | uuid | FK → Sala, not null |
| fecha | date | not null, ≥ hoy al generarse |
| horaInicio | time | not null |
| horaFin | time | not null |
| inicioUtc | timestamptz | not null (deriva de fecha+horaInicio en zona AR) |
| finUtc | timestamptz | not null |
| estado | enum(DISPONIBLE, BLOQUEADO) | not null, default DISPONIBLE (Fase 2/3 añaden estados) |
| origen | enum(FRANJA, APERTURA) | not null |
| origenId | uuid | FK → FranjaAgenda o ExcepcionAgenda según `origen`, not null |
| huerfano | boolean | not null, default false (FR-28) |

Índices: **unique `(profesionalId, fecha, horaInicio)`** (FR-37); `(profesionalId, fecha)`; `(fecha, estado)`; `(origen, origenId)`.

### ParametroSistema
| Field | Type | Constraints |
|-------|------|-------------|
| clave | varchar(50) | PK |
| valor | integer | not null |
| updatedAt | timestamptz | UTC |

Filas fijas: las 5 claves de FR-43. Sin altas/bajas por API, solo edición de `valor`.

### CorridaGeneracion
| Field | Type | Constraints |
|-------|------|-------------|
| id | uuid | PK |
| disparador | enum(JOB, MANUAL, INCREMENTAL) | not null |
| actorId | uuid | FK → Usuario, nullable (null si JOB) |
| profesionalId | uuid | nullable (null ⇒ todos) |
| creados / eliminados / sinCambios | integer | not null, default 0 |
| estado | enum(OK, SALTADA, ERROR) | not null |
| detalle | text | nullable |
| iniciadaAt / finalizadaAt | timestamptz | UTC |

### Auditoria
| Field | Type | Constraints |
|-------|------|-------------|
| id | uuid | PK |
| actorId | uuid | FK → Usuario, not null |
| accion | enum(CREAR, EDITAR, ELIMINAR, DESACTIVAR, ACTIVAR, RESET_PASSWORD) | not null |
| entidad | enum(usuario, franja, excepcion, parametros) | not null |
| entidadId | varchar(64) | not null |
| motivo | varchar(280) | nullable |
| antes | jsonb | nullable |
| despues | jsonb | nullable |
| timestamp | timestamptz | not null, UTC, default now() |

Sin `updatedAt`. Sin operaciones de UPDATE/DELETE (permiso revocado a nivel aplicación; idealmente `REVOKE` a nivel rol de base de datos). Índices: `(entidad, timestamp)`, `(actorId, timestamp)`.

### Enum `Rol` (compartido)
`ADMIN | COORDINACION | RECEPCION | PROFESIONAL`

---

## Out of Scope

- OS-1: Reserva de turnos por parte del ciudadano y estados de slot `RESERVADO_TEMPORAL` / `OCUPADO` / cancelaciones — Fase 3. En Fase 1 los slots solo nacen `DISPONIBLE` o `BLOQUEADO`.
- OS-2: Vista de turnos del día, "médicos de turno", marcar presente/ausente/atendido — Fase 2.
- OS-3: Demanda espontánea, escala de prioridades operativa, sobreturnos, desplazamiento manual, flujo "profesional caído" — Fase 2 (esta fase solo deja el campo `prioridadBase` en categorías y el modelo listo).
- OS-4: Reportes y export CSV — Fase 2.
- OS-5: Formulario ciudadano, página "Mi turno", consentimiento informado, cartel de banderas rojas — Fase 3.
- OS-6: Notificaciones (email/WhatsApp), tabla `notificaciones`, worker de notificaciones — Fase 3.
- OS-7: Bot de WhatsApp, Baileys, `MessagingProvider` — Fase 4.
- OS-8: Función "borrar mis datos", job de retención/anonimización a los N meses — Fase 3 (el parámetro `retencion_datos_meses` se define aquí pero no se ejecuta ningún purgado).
- OS-9: Cifrado en reposo por campo sensible y audit log de **lecturas** de datos de pacientes — endurecimiento pre-producción, explícitamente diferido en decisiones-mvp §7.
- OS-10: Recuperación de contraseña self-service por email para el personal — el MVP usa reset asistido por ADMIN (FR-12). El ciudadano no tiene cuentas.
- OS-11: Multi-tenant / multi-efector / concepto de "organización" — el producto es single-tenant por decisión de visión.
- OS-12: Franjas de agenda que cruzan la medianoche y turnos de duración variable dentro de una misma franja — no hay casos de uso en un hospital pediátrico ambulatorio; se rechazan por validación (EC-10).
- OS-13: Lógica de conflictos/reserva de salas como recurso — decisión de MVP: la sala es un atributo informativo.
- OS-14: Autenticación federada (SSO del municipio, OAuth) — no hay requerimiento; email + contraseña.
- OS-15: Historia clínica / registro de la atención médica — fuera de alcance de todo el producto MVP.
- OS-16: MFA / 2FA para el personal del panel — no requerido en el MVP; se puede evaluar en endurecimiento pre-producción.

---

## Trazabilidad (FR → AC)

| FR | AC | FR | AC | FR | AC |
|----|----|----|----|----|----|
| FR-1 | AC-1 | FR-17 | AC-18 | FR-33 | AC-32 |
| FR-2 | AC-2, AC-3 | FR-18 | AC-19, AC-20 | FR-34 | AC-30, AC-32 |
| FR-3 | AC-2 | FR-19 | AC-21 | FR-35 | AC-32, AC-33 |
| FR-4 | AC-1 | FR-20 | AC-21 | FR-36 | AC-32 |
| FR-5 | AC-7 | FR-21 | AC-22 | FR-37 | AC-35 |
| FR-6 | AC-4 | FR-22 | AC-23 | FR-38 | AC-34 |
| FR-7 | AC-5 | FR-23 | AC-24 | FR-39 | AC-29, AC-32 |
| FR-8 | AC-7 | FR-24 | AC-11, AC-12 | FR-40 | AC-37 |
| FR-9 | AC-9 | FR-25 | AC-25 | FR-41 | AC-36 |
| FR-10 | AC-8 | FR-26 | AC-26, AC-27 | FR-42 | AC-37 |
| FR-11 | AC-9, AC-10 | FR-27 | AC-28 | FR-43 | AC-38, AC-39 |
| FR-12 | AC-7 | FR-28 | AC-29 | FR-44 | AC-40 |
| FR-13 | AC-11, AC-13 | FR-29 | AC-29 | FR-45 | AC-40 |
| FR-14 | AC-14, AC-15 | FR-30 | AC-30 | FR-46 | AC-41 |
| FR-15 | AC-16 | FR-31 | AC-31 | FR-47 | AC-42 |
| FR-16 | AC-17 | FR-32 | AC-29 | FR-48 | AC-42 |
