# Turnero JP

Sistema de turnos para un hospital pediátrico público (single-tenant, greenfield).
Panel administrativo + formulario ciudadano web + bot de WhatsApp, sobre un backend común.

- Visión y decisiones: [`docs/vision-producto.md`](docs/vision-producto.md), [`docs/decisiones-mvp.md`](docs/decisiones-mvp.md), [`docs/stack-y-fases.md`](docs/stack-y-fases.md)
- Specs por fase: [`docs/specs/`](docs/specs/)

## Estado

| Fase | Descripción | Estado |
|------|-------------|--------|
| 1 | Núcleo administrativo | **Completa** · API (`/api/admin/**`) + panel administrativo (auth, 6 ABM de catálogo, franjas/excepciones de agenda, generación de slots, parámetros, auditoría) + job diario de generación de slots · 65/65 tests en verde |
| 2 | Operación del día | No iniciada |
| 3 | Canal ciudadano web | No iniciada |
| 4 | Bot de WhatsApp | Paquete base/demo listo; integración de turnos pendiente de Fases 2–3 |

### Panel administrativo (Fase 1)

`/admin` — login con email/contraseña (4 roles). Secciones:

- **Catálogos:** especialidades, profesionales, categorías de problema (+ mapeo a especialidad), salas, obras sociales.
- **Agendas:** franjas semanales recurrentes, excepciones (bloqueo / apertura), visor de slots generados con acción manual "Generar slots".
- **Administración:** usuarios del panel, parámetros del sistema, auditoría (solo lectura).

La visibilidad de cada sección depende del rol; la autorización real la impone la API en cada endpoint.

## Stack

Monorepo pnpm. Una app Next.js (App Router, TS, Tailwind v4) para panel + formulario.
PostgreSQL gestionado en Supabase, gestionado desde la app con Prisma.
Auth.js (NextAuth v5, provider Credentials, JWT). Tests con Vitest.
El bot de WhatsApp irá en un paquete separado (Fase 4).

```
apps/web/          app Next.js (panel + formulario ciudadano)
  prisma/          schema.prisma + seed.ts + migraciones
  src/lib/         db, parámetros, lógica de dominio
  tests/           suites Vitest (extraídas del spec)
packages/          (reservado — bot de WhatsApp, Fase 4)
docs/              visión, decisiones, specs
```

El bot de demostración se inicia con `pnpm dev:whatsapp`. Sus contratos de
turnos son intercambiables: hasta que la Fase 3 exista, usa datos ficticios y
no accede directamente a Prisma.

## Requisitos

- Node >= 22, pnpm 9 (`corepack enable`)
- Un proyecto de [Supabase](https://supabase.com) (PostgreSQL). No hace falta Docker.

## Puesta en marcha (desarrollo)

```bash
pnpm install

# variables de entorno
cp .env.example apps/web/.env
# En apps/web/.env completar con el dashboard de Supabase
# (Project Settings -> Database -> Connection string):
#   DATABASE_URL -> connection pooler, puerto 6543, con ?pgbouncer=true
#   DIRECT_URL   -> conexión directa, puerto 5432 (la usa prisma migrate)
# y generar AUTH_SECRET con: openssl rand -base64 32

# base de datos (las tablas viven en Supabase)
pnpm db:migrate       # aplica migraciones Prisma sobre Supabase (via DIRECT_URL)
pnpm db:seed          # carga catálogo ficticio (idempotente; no corre en producción)

pnpm dev              # Next.js en http://localhost:3000
```

### Job de generación de slots (FR-39a)

`POST /api/cron/generar-slots` regenera los slots de todos los profesionales. Debe
ejecutarse al menos una vez por día. Se autentica con el header
`Authorization: Bearer $CRON_SECRET` (generar con `openssl rand -base64 32` y
definir la env var `CRON_SECRET` en el servidor).

- **Vercel:** `apps/web/vercel.json` ya declara el cron diario (05:00 UTC). Solo
  hace falta crear la env var `CRON_SECRET` en el proyecto; Vercel adjunta el header.
- **Fuera de Vercel:** el workflow `.github/workflows/generar-slots.yml` hace la
  llamada por `curl` (requiere los secrets `APP_URL` y `CRON_SECRET` en el repo), o
  un cron de sistema equivalente.
- La generación también es incremental: cada alta/edición/baja de franja o
  excepción regenera los slots afectados en el momento.

### Tests

Los tests de integración corren contra un **schema aislado** (`turnero_test`) del
mismo proyecto Supabase (sin Docker). Preparar una sola vez:

```bash
cp apps/web/.env.test.example apps/web/.env.test   # completar con las credenciales de Supabase
pnpm test:db:setup                                  # aplica las migraciones en el schema turnero_test
pnpm test                                           # Vitest — 65 tests de la Fase 1
```


### Usuarios del seed (solo desarrollo)

| Rol | Email | Contraseña |
|-----|-------|-----------|
| ADMIN | `admin@hospital.test` | `turnero-dev-1234` |
| COORDINACION | `coordinacion@hospital.test` | `turnero-dev-1234` |
| RECEPCION | `recepcion@hospital.test` | `turnero-dev-1234` |
| PROFESIONAL | `profesional@hospital.test` | `turnero-dev-1234` |

## Flujo de trabajo (spec-driven)

Nada de código sin spec aprobado. El spec define FR/NFR/AC; los tests de `apps/web/tests/`
se extraen de los AC y se implementan uno por uno. Si aparece un requisito faltante,
se actualiza el spec antes de codear.
