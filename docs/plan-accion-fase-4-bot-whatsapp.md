# Plan de acción — Fase 4: paquete del bot de WhatsApp

**Fecha:** 2026-09-03  
**Estado:** Propuesto — la implementación queda bloqueada hasta aprobar las especificaciones de las fases 2, 3 y 4.

## Objetivo

Incorporar un canal de WhatsApp como paquete Node persistente e independiente de la app web. El bot debe reutilizar los mismos casos de uso y la misma base de datos que el formulario ciudadano: solicitar un turno, consultar el propio turno y cancelarlo. También debe habilitar WhatsApp como canal de salida de la cola de notificaciones creada en la Fase 3.

El adaptador inicial será Baileys, únicamente para desarrollo o demostración. No se habilita para producción hospitalaria: WhatsApp Web es frágil y no oficial. La lógica de negocio no podrá depender de Baileys, para permitir un reemplazo posterior por WhatsApp Business Platform (Cloud API).

## Alcance y límites

| Incluido | Excluido |
|---|---|
| Menú guiado para sacar turno: categoría, especialidad resuelta, profesional opcional y primer slot disponible | Reprogramar turnos en el chat |
| Consulta y cancelación del turno propio | Triage clínico, diagnósticos o indicaciones médicas |
| Derivación explícita a atención humana ante ambigüedad, error o caso fuera de alcance | Sobreturnos, gestión de demanda espontánea y acciones de panel |
| Adaptador Baileys, interfaz `MessagingProvider` y canal de salida para la cola existente | API oficial de Meta en esta fase |
| Trazabilidad técnica sin guardar contenido sensible innecesario | Exponer credenciales, sesión o datos clínicos en logs |

## Dependencias y puerta de inicio

No se debe crear el paquete ni instalar dependencias antes de cumplir estos criterios:

1. La Fase 1 debe estar implementada y sus pruebas aprobadas: provee catálogos, agendas, slots y parámetros.
2. La especificación de Fase 2 debe definir los estados finales de `Turno` y sus reglas de cancelación tardía.
3. La especificación de Fase 3 debe estar aprobada e implementada: reserva temporal, creación/consulta/cancelación de turno, consentimiento, modelo de paciente/responsable y tabla/worker de `notificaciones`.
4. Debe aprobarse la spec de Fase 4, con contratos compartidos y criterios de aceptación verificables. Este documento es el plan de trabajo, no reemplaza esa spec.
5. Deben estar definidos número de demostración, responsable operativo de atención humana y el mecanismo seguro para persistir credenciales de sesión.

## Arquitectura objetivo

```text
WhatsApp <-> adaptador Baileys <-> orquestador de conversación
                                      |             |
                                      |             +-> estado de conversación persistente
                                      v
                           casos de uso públicos compartidos
                                      |
                         PostgreSQL/Supabase <- apps/web
                                      ^
worker de notificaciones (Fase 3) ---+--- MessagingProvider (salida WhatsApp)
```

- Crear `packages/whatsapp-bot` como workspace pnpm TypeScript, con proceso `start` persistente, configuración validada al arrancar y directorio de credenciales fuera de Git.
- Extraer o definir en un paquete compartido los casos de uso públicos; el bot no debe llamar rutas HTTP internas de Next ni manipular tablas Prisma directamente. La app web y el bot deben aplicar idénticas reglas de reserva, duplicados, cancelación, consentimiento y auditoría.
- Separar el transporte de la conversación mediante `MessagingProvider` (`sendText`, `sendMenu`, `onMessage`, `disconnect`). Baileys implementa esa interfaz; las reglas y mensajes del bot sólo conocen la abstracción.
- Persistir el estado mínimo de la conversación por número normalizado: paso actual, datos transitorios, versión del flujo, vencimiento e idempotency key del mensaje. No persistir texto libre ni datos de salud salvo que sea imprescindible para completar la reserva y esté cubierto por la política de retención de Fase 3.

## Hitos de implementación

| Hito | Acciones | Entregable y criterio de salida |
|---|---|---|
| 0. Especificar | Redactar `docs/specs/fase-4-bot-whatsapp.md`: FR/NFR, escenarios Given/When/Then, errores, contratos, modelos y fuera de alcance. Acordar el protocolo de derivación humana y el texto de consentimiento. | Spec validada y aprobada; casos de prueba extraídos en rojo. |
| 1. Contratos compartidos | Definir interfaces para búsqueda de categorías/especialidades/profesionales, reserva/confirmación, consulta, cancelación y encolado de notificaciones. Añadir errores de dominio estables (`SIN_DISPONIBILIDAD`, `DATOS_NO_COINCIDEN`, `MULTIPLES_TURNOS`, `FUERA_DE_VENTANA`, etc.). | Web y bot compilan contra los mismos contratos; pruebas de contrato demuestran reglas idénticas. |
| 2. Paquete y transporte | Crear el workspace, comandos de desarrollo/arranque/test y el adaptador Baileys. Implementar reconexión con backoff, QR de desarrollo, cierre ordenado, almacenamiento seguro de credenciales e idempotencia de mensajes entrantes. | El proceso se reconecta sin duplicar el procesamiento y nunca versiona la sesión. |
| 3. Motor conversacional | Implementar un estado finito, menús accesibles en texto y timeout de sesión. Incluir inicio/reinicio/cancelación de flujo, validación de respuestas, mensaje de guardia para categorías marcadas y derivación humana ante estados no resolubles. | Tests unitarios cubren todas las transiciones y no existe una transición que cree o cancele un turno fuera de un caso de uso compartido. |
| 4. Flujos de entrada | Implementar en este orden: sacar turno, consultar turno y cancelar turno. Para reservar, solicitar consentimiento antes de datos personales, resolver categoría/especialidad, ofrecer profesional opcional y confirmar el primer slot disponible. | Pruebas de integración desde mensaje entrante hasta efecto de dominio para happy path, duplicado, falta de cupo, datos no coincidentes, dos turnos y cancelación tardía. |
| 5. Notificaciones salientes | Añadir `WhatsApp` como canal al worker de Fase 3, con adaptador de envío, estados pendientes/enviado/fallido, reintentos acotados e idempotencia por notificación. Mantener el fallback email definido por producto. | Cada evento definido en `decisiones-mvp.md` queda auditado y un fallo de WhatsApp no bloquea email ni el worker. |
| 6. Seguridad y operación | Añadir redacción de PII en logs, métricas y alertas, runbook de QR/reconexión/caídas, health check, rotación de credenciales y prueba de recuperación. Revisar consentimiento, retención y la derivación humana con la institución. | Revisión de seguridad aprobada y simulacro de caída/reconexión documentado. |
| 7. Validación y demo | Ejecutar suite unitaria, integración con proveedor falso y prueba controlada con Baileys. Hacer prueba de aceptación con los tres flujos y los mensajes de notificación. | Todos los AC de la spec pasan; demo con datos ficticios y número de prueba. |

## Decisiones que la spec debe cerrar

1. **Identificación para consultar/cancelar:** combinación exacta de teléfono, DNI/fecha de nacimiento y/o código de turno; debe impedir revelar turnos a terceros.
2. **Primer slot disponible:** orden determinista, zona horaria `America/Argentina/Buenos_Aires` y qué hacer si el slot se ocupa mientras el chat avanza.
3. **Reserva:** el bot usará el mismo TTL de reserva temporal de Fase 3 (hoy parametrizado en 7 minutos) y nunca una implementación paralela.
4. **Atención humana:** texto, horario/canal de contacto, registro de la derivación y comportamiento cuando no hay atención disponible.
5. **Mensajería saliente:** formato de cada evento, elegibilidad de WhatsApp, número normalizado y política exacta de reintentos/fallback.
6. **Consentimiento y borrado:** evidencia que se guarda, versión de la política y cómo se cumple una solicitud de eliminación para conversaciones asociadas a un teléfono.

## Pruebas y criterios de calidad

- Unitarias: parser de mensajes, máquina de estados, normalización de teléfono y mapeo de errores de dominio.
- Integración: casos de uso compartidos con PostgreSQL de prueba y proveedor simulado; concurrencia de dos conversaciones sobre el mismo slot.
- Contrato: el adaptador Baileys y un adaptador falso deben cumplir `MessagingProvider`.
- End-to-end controlada: QR, reconexión, los tres flujos, cola de notificaciones, fallo temporal de transporte y fallback email.
- Seguridad: logs sin DNI, fecha de nacimiento, teléfono completo, contenido libre ni credenciales; sesiones y secretos fuera del repositorio.
- Operación: health check, métricas de mensajes recibidos/enviados/fallidos, reconexiones y conversaciones derivadas; alertas sin PII.

## Riesgos y tratamiento

| Riesgo | Tratamiento |
|---|---|
| Suspensión del número o ruptura de Baileys | Limitarlo a desarrollo/demo, aislar el adaptador y mantener el formulario web y email como canales funcionales. |
| Duplicados por reintentos o reconexiones | Idempotencia por id de mensaje y reglas transaccionales de reserva ya existentes. |
| Exposición de datos de menores | Minimización de datos, consentimiento previo, logs redactados, retención y revisión de seguridad. |
| Respuesta clínica inapropiada | Menús acotados, cartel de guardia, categorías de derivación y derivación humana; sin texto clínico libre. |
| Divergencia entre web y bot | Casos de uso y contratos compartidos; prohibición de acceso directo del bot a Prisma/tablas. |

## Definición de terminado

La Fase 4 estará terminada cuando la spec esté aprobada, todos sus criterios de aceptación y casos borde tengan pruebas verdes, el paquete sea ejecutable y observable, los tres flujos reutilicen reglas de dominio de Fase 3, la cola entregue notificaciones por WhatsApp sin afectar email, y exista un runbook validado para recuperar la sesión. Su estado de despliegue seguirá siendo **demostración/desarrollo**, no producción clínica, hasta sustituir Baileys por el adaptador oficial de Meta y completar la revisión institucional correspondiente.
