# Spec: Fase 2 — Operación del día

**Date:** 2026-09-04  
**Status:** In Review  
**Base:** Fase 1 implementada (`fdfda62`)

## Alcance aprobado para el primer corte

La fase agrega el dominio operativo sobre los slots de Fase 1: turnos internos, demanda espontánea, sobreturnos, ausencias de profesionales, casos de reprogramación, eventos notificables y auditoría. El envío de notificaciones y los canales ciudadanos siguen siendo responsabilidad de Fase 3.

### Requerimientos funcionales implementables

- FR-1: Recepción, Coordinación y Admin pueden crear un turno interno sobre un slot disponible; la operación ocupa el slot de forma atómica.
- FR-2: Los turnos conservan paciente, responsable, contacto, categoría, prioridad, profesional, especialidad, fecha y estado operativo.
- FR-3: La operación diaria ordena la cola por prioridad y luego por hora programada u hora de llegada.
- FR-4: Recepción, Coordinación y el profesional asignado pueden marcar presencia, ausencia y atención con transiciones válidas y auditadas.
- FR-5: Coordinación/Admin puede registrar ausencia de un profesional para una fecha y el sistema abre un caso de reprogramación para cada turno afectado, sin liberar el origen.
- FR-6: Recepción registra demanda espontánea; las urgencias se derivan a guardia sin crear turno.
- FR-7: La demanda no urgente puede generar un sobreturno; el límite es el parámetro `tope_sobreturnos_por_profesional_dia`, con valor inicial 2 y override sólo de Coordinación/Admin con motivo.
- FR-8: Sólo Coordinación inicia desplazamientos manuales, con motivo, nunca dentro de las 24 h previas ni tras el check-in; el origen se conserva hasta que exista destino.
- FR-9: Cada ausencia, sobreturno, override, cambio de estado y desplazamiento genera auditoría inmutable y un evento de notificación persistente, sin enviar mensajes.
- FR-10: La UI diaria, médicos de turno, reportes y CSV consumen estos casos de uso y se implementan después de validar el dominio.

## Decisiones aplicadas

1. Se incluye alta interna de turnos: sin ella, la operación diaria no tendría turnos normales antes de Fase 3.
2. El tope inicial de sobreturnos es 2, configurable entre 0 y 10.
3. Fase 2 persiste `EventoNotificable`; Fase 3 incorpora el worker que los entrega.
4. El cuestionario de admisión queda configurable y sólo persiste respuestas cerradas; no se define ni automatiza criterio clínico en código.

## Fuera de alcance

Reserva temporal/autogestión ciudadana, envío de email o WhatsApp, triage clínico, desplazamientos masivos/automáticos, penalización por ausentismo y dashboards gráficos.
