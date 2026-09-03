# Plan de acción — Fase 2: Operación del día

**Estado:** En curso. Fase 1 validada como base.

| Hito | Estado | Entregable |
|---|---|---|
| 1. Modelo y migración | Completado | Enums, `Turno`, demanda, ausencia, reprogramación, outbox y parámetro de sobreturnos. |
| 2. Casos de uso transaccionales | En curso | Alta interna, estados, sobreturno/override, ausencia y desplazamiento con auditoría y transacciones. Falta cerrar pruebas de integración. |
| 3. API de operación | En curso | Cola diaria, demanda, ausencias, médicos de turno, desplazamiento y reportes CSV protegidos por rol. |
| 4. Pantallas operativas | Pendiente | Vista diaria, médicos de turno, admisión y lista de reprogramación. |
| 5. Reportes y CSV | Pendiente | Cinco reportes del MVP con filtros reutilizables. |
| 6. Hardening | Pendiente | Accesibilidad, PII, concurrencia, rendimiento y runbook. |

## Estrategia

Cada mutación se implementa primero como caso de uso de servidor y prueba de integración; las rutas y pantallas sólo lo consumen. El slot y su turno se modifican en la misma transacción, y auditoría/outbox se escriben dentro de esa transacción. De este modo Fase 3 reutiliza las reglas de negocio en vez de duplicarlas.

## Criterio del corte actual

El primer corte termina cuando la migración puede aplicarse, Prisma genera el cliente y el modelo soporta las restricciones necesarias para los casos de uso. No se expondrán rutas hasta que sus pruebas de transacción existan.
