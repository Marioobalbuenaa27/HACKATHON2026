# Spec: Preparación del paquete de WhatsApp

**Author:** Equipo Turnero JP  
**Date:** 2026-09-03  
**Status:** Approved  
**Reviewers:** Product owner — alcance autorizado el 2026-09-03  
**Related specs:** Fase 1 (Approved), Fase 2 y Fase 3 (pendientes), Fase 4 completa (pendiente)

## Context

El bot de WhatsApp es un canal ciudadano previsto para la Fase 4, pero los modelos y casos de uso reales de turno todavía dependen de las fases 2 y 3. Se necesita adelantar su infraestructura y experiencia conversacional sin duplicar ni anticipar reglas de reserva, consulta o cancelación.

Este incremento crea un paquete Node persistente y demostrable. Sus integraciones de negocio se expresan como contratos intercambiables y se entregan con un adaptador de demostración. Baileys queda aislado como transporte de desarrollo.

## Functional Requirements

- FR-1: El repositorio MUST contener un workspace `packages/whatsapp-bot` ejecutable con TypeScript.
- FR-2: El paquete MUST exponer `MessagingProvider` y `AppointmentGateway`; el motor conversacional MUST depender sólo de esas interfaces.
- FR-3: El paquete MUST incluir un adaptador Baileys que reciba mensajes, envíe texto y persista su credencial fuera de Git.
- FR-4: El bot MUST mostrar un menú inicial, consentimiento, flujo de solicitud demo, consulta demo, cancelación demo y derivación humana.
- FR-5: El bot MUST guardar el estado mínimo de conversación por teléfono normalizado y vencerlo tras un tiempo configurable.
- FR-6: El bot MUST ignorar de forma idempotente mensajes entrantes ya procesados durante su ejecución.
- FR-7: El paquete MUST incluir un proveedor y gateway falsos para pruebas sin WhatsApp ni base de datos.

## Non-Functional Requirements

- NFR-S1: Las credenciales y el estado local MUST estar ignorados por Git.
- NFR-S2: Los logs MUST NOT incluir DNI, fecha de nacimiento ni contenido de los mensajes.
- NFR-R1: Una desconexión del proveedor MUST dejar el proceso recuperable mediante reconexión.
- NFR-M1: El motor MUST responder una transición de conversación en menos de 50 ms sin una integración externa.

## Acceptance Criteria

### AC-1: Menú inicial (FR-4)
Given un mensaje inicial de un número nuevo
When el motor procesa el mensaje
Then responde con las opciones sacar, consultar y cancelar un turno.

### AC-2: Solicitud demo (FR-4)
Given una conversación en la opción de sacar turno
When la persona acepta el consentimiento y selecciona una categoría no urgente
Then el motor solicita la especialidad y confirma un slot devuelto por `AppointmentGateway`.

### AC-3: Categoría urgente (FR-4)
Given una categoría marcada para derivar a guardia
When la persona la selecciona
Then el motor muestra la indicación de guardia y cierra el flujo.

### AC-4: Dependencia intercambiable (FR-2, FR-7)
Given un proveedor y gateway falsos
When se procesa un mensaje
Then el flujo completa sin importar Baileys ni acceder a Prisma.

### AC-5: Mensaje duplicado (FR-6)
Given un mensaje con un id ya procesado
When el runtime lo recibe de nuevo
Then no vuelve a ejecutar el motor ni envía una respuesta.

## Edge Cases

- EC-1: Opción inválida → pedir una opción válida sin perder el estado.
- EC-2: Conversación vencida → reiniciar mostrando el menú.
- EC-3: Gateway devuelve `OUT_OF_SCOPE` o `NOT_FOUND` → derivar a atención humana.
- EC-4: Baileys se desconecta → registrar sólo el código y reintentar con backoff; no exponer el error al usuario.

## API Contracts

```ts
interface MessagingProvider {
  connect(): Promise<void>; disconnect(): Promise<void>;
  sendText(to: string, text: string): Promise<void>;
  onMessage(listener: (message: IncomingMessage) => Promise<void>): void;
}
interface AppointmentGateway {
  categories(): Promise<Category[]>;
  specialties(categoryId: string): Promise<Specialty[]>;
  firstSlot(input: SlotSearch): Promise<Slot | null>;
  lookup(input: Lookup): Promise<AppointmentResult>;
  cancel(input: Lookup): Promise<AppointmentResult>;
}
```

## Data Models

| Entity | Fields | Constraints |
|---|---|---|
| Conversation | phone, step, data, expiresAt | phone normalized; minimum data only; expires |
| IncomingMessage | id, from, text, receivedAt | id is idempotency key |

## Out of Scope

- OS-1: Persistencia de producción de conversaciones — requiere modelo de retención de Fase 3.
- OS-2: Reglas reales de turno, paciente, reserva y cancelación — las definen Fases 2 y 3.
- OS-3: Meta Cloud API — adaptador futuro.
- OS-4: Cualquier recomendación clínica o reprogramación por chat.
