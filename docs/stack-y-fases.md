# Turnero JP — Stack técnico y fases de implementación

> Decidido el 2026-09-03. Ver también [vision-producto.md](vision-producto.md) y [decisiones-mvp.md](decisiones-mvp.md).

## Stack

### Estructura del repositorio
- **Monorepo.**
- **Una sola aplicación Next.js** (App Router) para el **panel administrativo + el formulario ciudadano**, separados por *route groups*:
  - `/admin/*` — protegido, verificación de rol por endpoint.
  - `/` — público (formulario y "Mi turno").
  - Middleware de autenticación.
- **Bot de WhatsApp en una carpeta / paquete separado** del monorepo. Corre como **proceso Node persistente** (Baileys necesita mantener la sesión viva; no es serverless).

### Tecnologías
| Área | Elección |
|------|----------|
| Frontend + API | Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui |
| Base de datos | PostgreSQL **gestionado en Supabase** (hosting de la BD; sin Docker). Acceso vía pooler (PgBouncer) en runtime y conexión directa para migraciones |
| ORM | Prisma (`prisma migrate` + `prisma db seed` sobre la instancia de Supabase) |
| Auth del panel | Email + contraseña, roles, sesión en cookies httpOnly (Auth.js / Lucia) |
| Jobs programados | Scheduler simple: cron en Node que consulta la base de datos cada ~5 min. **Sin Redis** en el MVP. |
| Cola de notificaciones | Tabla `notificaciones` con estado (pendiente / enviado / fallido) — actúa como cola persistente. |
| Mensajería WhatsApp | Baileys (desarrollo), detrás de una interfaz `MessagingProvider` abstracta (`enviarTexto`, `enviarMenu`, `recibirMensaje`, …) para poder migrar a la Cloud API oficial de Meta sin tocar la lógica del bot. |

### Nota sobre WhatsApp / Baileys
Baileys se conecta como WhatsApp Web (no oficial). Va contra los términos de servicio de WhatsApp, con riesgo real de baneo del número, sesión frágil y sin mensajes de plantilla aprobados. **No es apto para producción sostenida** en un hospital/municipio. Si el proyecto entra en un entorno real, hay que migrar a la **WhatsApp Business Platform (Cloud API de Meta)**, lo que requiere número dedicado, verificación de la empresa ante Meta y plantillas aprobadas. La capa de abstracción `MessagingProvider` existe para que esa migración sea un cambio de adaptador.

## Fases de implementación

El bot de WhatsApp va en la última fase.

### Fase 1 — Núcleo administrativo
- Modelo de datos.
- Autenticación + roles.
- ABM de: especialidades, categorías de problema, mapeo categoría → especialidad, profesionales, salas, obras sociales.
- Agendas con franjas semanales recurrentes + excepciones.
- Generación automática de slots.

### Fase 2 — Operación del día
- Vista de turnos del día.
- "Médicos de turno" (derivada de la agenda) + marcar profesional ausente.
- Registro de demanda espontánea + asignación de prioridad (formulario de admisión guiado).
- Sobreturnos (con tope configurable y override).
- Desplazamiento manual de turnos (rol Coordinación) + log de auditoría.
- Flujo "profesional caído" (lista de trabajo asistida para Recepción).
- Marcar presente / ausente / atendido.
- Reportes + export CSV.

### Fase 3 — Canal ciudadano web
- Formulario público: categoría → especialidad → profesional (opcional) → slot.
- Reserva temporal de slot (~7 min) + unique constraint.
- Página "Mi turno" (DNI del niño/a + fecha de nacimiento).
- Consentimiento informado + política de privacidad + retención de datos.
- Cartel de alarma / categorías "derivar a guardia".
- **Notificaciones por email** + worker de notificaciones (cron Node dentro del backend de la app Next).

### Fase 4 — Bot de WhatsApp
- Paquete separado con Baileys + adaptador `MessagingProvider`.
- Flujos de entrada: sacar turno (con opción de profesional específico), consultar turno, cancelar turno.
- Derivación a atención humana para casos fuera de alcance.
- **Activación del canal WhatsApp** en el worker de notificaciones ya existente (recordatorios, confirmaciones, avisos de reprogramación).

> El worker de notificaciones nace en la Fase 3 dentro de la app Next, **no** en el bot. Así las notificaciones por email funcionan aunque el bot todavía no exista, y la Fase 4 solo agrega un canal de salida más y los flujos de entrada.
