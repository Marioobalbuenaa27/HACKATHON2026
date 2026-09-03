# Turnero JP

Sistema de turnos para un hospital pediátrico público (single-tenant, greenfield).
Panel administrativo + formulario ciudadano web + bot de WhatsApp, sobre un backend común.

- Visión y decisiones: [`docs/vision-producto.md`](docs/vision-producto.md), [`docs/decisiones-mvp.md`](docs/decisiones-mvp.md), [`docs/stack-y-fases.md`](docs/stack-y-fases.md)
- Specs por fase: [`docs/specs/`](docs/specs/)

## Estado

| Fase | Descripción | Estado |
|------|-------------|--------|
| 1 | Núcleo administrativo | Spec **Approved** · scaffolding listo · implementación pendiente |
| 2 | Operación del día | No iniciada |
| 3 | Canal ciudadano web | No iniciada |
| 4 | Bot de WhatsApp | No iniciada |

## Stack

Monorepo pnpm. Una app Next.js (App Router, TS, Tailwind v4) para panel + formulario.
PostgreSQL + Prisma. Auth.js (NextAuth v5, provider Credentials, JWT). Tests con Vitest.
El bot de WhatsApp irá en un paquete separado (Fase 4).

```
apps/web/          app Next.js (panel + formulario ciudadano)
  prisma/          schema.prisma + seed.ts + migraciones
  src/lib/         db, parámetros, lógica de dominio
  tests/           suites Vitest (extraídas del spec)
packages/          (reservado — bot de WhatsApp, Fase 4)
docs/              visión, decisiones, specs
```

## Requisitos

- Node >= 22, pnpm 9 (`corepack enable`)
- Docker (para la base de datos de desarrollo)

## Puesta en marcha (desarrollo)

```bash
pnpm install

# copiar variables de entorno
cp .env.example apps/web/.env    # ajustar AUTH_SECRET

# base de datos
pnpm db:up            # levanta Postgres en Docker (puerto 5432)
pnpm db:migrate       # aplica migraciones Prisma
pnpm db:seed          # carga catálogo ficticio (idempotente; no corre en producción)

pnpm dev              # Next.js en http://localhost:3000
pnpm test             # Vitest (hoy: 64 stubs en rojo — RED phase de la Fase 1)
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
