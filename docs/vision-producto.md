# Turnero JP — Visión de producto

> Última actualización: 2026-09-03

## Qué es

Sistema de turnos para un **hospital pediátrico público**. Proyecto greenfield: no se integra con un HIS (sistema de información hospitalaria) existente, pero se diseña de forma que esa integración sea posible a futuro.

- **Alcance institucional:** un solo hospital (single-tenant). Sin concepto de "organización" ni multi-efector en el modelo de datos.
- **Idioma:** español (Argentina). Sin internacionalización.

## Componentes

### 1. Panel administrativo
Aplicación web para el personal del hospital. Permite gestionar la información operativa (agendas, especialidades, salas, catálogos), operar el día a día (turnos, demanda espontánea, sobreturnos) y ver reportes.

Roles:

| Rol | Responsabilidad |
|-----|-----------------|
| **Administrador / TI** | Gestiona todo: usuarios, especialidades, categorías de problema, salas, obras sociales, parámetros del sistema. |
| **Coordinación** | Gestiona agendas de profesionales, autoriza overrides (sobreturnos extra, desplazamientos), ve reportes. |
| **Recepción / Admisión** | Opera el día: registra demanda espontánea, asigna prioridad, crea sobreturnos, marca presentes/ausentes, busca y gestiona turnos. |
| **Profesional** | Acceso de solo lectura a su agenda del día. Marca atendido/ausente. |

### 2. Formulario de autogestión ciudadana (web)
Aplicación web pública para que el adulto responsable de un paciente pediátrico solicite y gestione turnos, sin necesidad de crear una cuenta.

Flujo: **categoría de problema (lenguaje común) → especialidad (resuelta por el sistema) → profesional (opcional) → slot de horario**.

### 3. Bot de WhatsApp
Vía alternativa para solicitar turnos, pensada para personas con menos alfabetización digital o sin acceso a un navegador. Usa el mismo backend y base de datos que el formulario web. Cubre un subconjunto de funciones (sacar turno, consultar, cancelar).

## Modelo de paciente

- **Paciente:** el niño/a. Se identifica internamente por su DNI. No hay cuentas de usuario para pacientes.
- **Solicitante:** el adulto responsable, que aporta sus datos de contacto y su vínculo con el paciente.
- Cada turno registra ambos conjuntos de datos.

## El problema de diseño central: la demanda espontánea

En un hospital público siempre asisten personas **sin turno previo**: por desconocimiento de la plataforma, por falta de medios para sacarlo online, o por necesidad. Muchas vienen del interior y no pueden volver otro día; no son urgencias clínicas, pero tienen poco margen de espera.

El sistema **no puede crear capacidad de la nada**, pero sí garantizar que exista una vía continua para absorber esa demanda y darle a Recepción una herramienta para gestionarla. La solución adoptada combina:

1. **Escala de prioridades** (4 niveles) asignada por Recepción/Admisión.
2. **Sobreturno por defecto:** el paciente que llega se agrega como sobreturno del profesional; la cola del día se ordena por prioridad. Nadie pierde su turno.
3. **Desplazamiento manual** de un turno confirmado: solo como acción explícita de Coordinación, nunca automática.

El detalle está en [decisiones-mvp.md](decisiones-mvp.md).

## Documentos relacionados

- [decisiones-mvp.md](decisiones-mvp.md) — decisiones funcionales y de alcance del MVP.
- [stack-y-fases.md](stack-y-fases.md) — stack técnico y plan de implementación en 4 fases.
