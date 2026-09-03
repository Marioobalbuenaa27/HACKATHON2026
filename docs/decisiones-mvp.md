# Turnero JP — Decisiones de MVP

> Decisiones funcionales y de alcance cerradas con el equipo el 2026-09-03.
> Ver también [vision-producto.md](vision-producto.md) y [stack-y-fases.md](stack-y-fases.md).

## 1. Turnos y agendas

- **Turno** = cita agendada para una fecha y hora concreta, contra la agenda de un profesional.
- La **agenda** de cada profesional se define como **franjas horarias semanales recurrentes** (ej.: "lunes y miércoles de 8 a 12, consultorio 4"), más **excepciones** puntuales (bloquear un día por licencia/feriado, o abrir un día extra).
- El sistema **genera los slots automáticamente** a partir de las franjas, para las próximas semanas. La **duración del turno** es configurable por especialidad.
- **Ventana de reserva:** 30 días móviles (hoy + 30), configurable desde el panel.
- **Antelación mínima:** se puede reservar para hoy mismo hasta 2 horas antes del slot, configurable. Con menos de 2 h, el turno online se cierra y la persona cae en el flujo de sobreturno presencial.
- **Límite anti-duplicados:** máximo **1 turno activo por niño/a por especialidad** (validado contra el DNI del niño/a). El personal del panel puede saltarse la regla.
- **Concurrencia:** el slot se asigna con un *unique constraint* a nivel base de datos sobre `profesional + fecha + hora`. Además, al elegir el slot queda en **reserva temporal ~7 minutos** mientras la persona completa los datos; un job libera las reservas vencidas.
- **Cancelación:** libre hasta 2 h antes del turno. Más tarde, solo por teléfono/WhatsApp, y queda marcada como "cancelación tardía".
- **Ausentismo (no-show):** lo marca el profesional o Recepción desde el panel. El MVP **solo registra** (contador de ausencias por DNI, visible en el panel). Sin penalización ni bloqueo automático.
- Un slot cancelado o liberado **vuelve a estar disponible online** automáticamente si sigue dentro de la ventana.

## 2. Demanda espontánea y escala de prioridades

### Escala de prioridades (4 niveles)

| Nivel | Nombre | Descripción | Genera turno |
|-------|--------|-------------|--------------|
| 1 | **Normal** | Turno agendado estándar. | Sí |
| 2 | **Preferencial** | Corresponde por ley/política: embarazadas, personas con discapacidad, adultos mayores acompañando, lactantes. | Sí |
| 3 | **Prioritario por situación** | Paciente del interior sin posibilidad de volver otro día; condición que requiere atención pronta pero no urgente; derivación "a la brevedad". | Sí |
| 4 | **Urgente** | El sistema indica "derivar a guardia inmediatamente" y corta el flujo. | **No** |

- **Quién asigna la prioridad:** Recepción/Admisión, mediante un **formulario de admisión guiado** (preguntas cerradas → el sistema sugiere un nivel, Recepción confirma o ajusta). Para turnos pedidos online, la prioridad base se deriva automáticamente de la categoría del problema.
- La **cola del día** se ordena por nivel de prioridad; dentro del mismo nivel, por hora de turno / hora de llegada.

### Mecanismo para absorber demanda espontánea prioritaria

- **Sobreturno por defecto:** el paciente que llega se agrega como *sobreturno* del profesional para ese día. Nadie pierde su turno; el caso prioritario se intercala según la cola ordenada por prioridad (todos esperan un poco más).
- **Desplazamiento de un turno confirmado: solo manual.** Únicamente un usuario con rol **Coordinación** puede decidirlo, caso por caso. **Nunca automático.**

### Mecánica del sobreturno

- **Tope** configurable por profesional/día (default 2–3). Un usuario con rol de coordinación puede autorizar un *override* por encima del tope.
- **Confirmación directa** (sin aceptación previa del profesional), para no trabar el flujo en Recepción.
- El profesional y Coordinación reciben **notificación**, y el sobreturno aparece con **marca visual distinta** en la agenda del día.

### Mecánica del desplazamiento manual

- El sistema **propone** el próximo hueco disponible del mismo profesional (mismo día si hay, si no el más cercano) y deja el turno en estado **"reprogramado – pendiente de confirmación"**.
- Se **notifica a la persona** por sus canales, pidiéndole que confirme o elija otro horario.
- El turno original **no se libera** hasta que haya un nuevo turno asignado.
- **Prohibido** desplazar un turno a menos de 24 h de su horario, o uno con check-in ya hecho. En esos casos, la única opción es el sobreturno.
- Todo desplazamiento queda en un **log de auditoría** (usuario, motivo, timestamp).

### Flujo "profesional caído" (ausencia imprevista)

Cuando Coordinación marca a un profesional como ausente ese día:

- El sistema genera una **lista de trabajo** para Recepción: cada turno del profesional queda "a reprogramar".
- Recepción los reasigna **uno por uno** (a otro profesional de la misma especialidad ese día si hay lugar, o a otra fecha), con notificación automática al resolver cada caso.
- Los pacientes reciben primero un aviso de **"estamos reprogramando tu turno, te contactamos"**, para que nadie viaje al hospital en vano.

## 3. Canal ciudadano (formulario web)

- **Sin cuentas de usuario.** Cada solicitud es independiente. El sistema vincula los turnos al **DNI del niño/a** internamente.
- **Datos que se piden:**
  - Niño/a: nombre, DNI, fecha de nacimiento, obra social (opcional).
  - Adulto responsable: nombre, DNI, vínculo, teléfono, email.
- **Contacto obligatorio:** al menos uno de {email, teléfono con WhatsApp}. Se puede dar solo teléfono.
- **Motivo de consulta:** selección de **categoría obligatoria** (catálogo que administra el hospital) + **texto libre opcional** para detalle. El ciudadano **no elige la especialidad directamente**: elige una categoría en lenguaje común y el sistema resuelve la especialidad. Si una categoría mapea a más de una especialidad, se muestran las opciones con una breve explicación.
- **Flujo:** categoría → especialidad (resuelta) → profesional (opcional) → slot.
- **Gestión del turno propio:** página "Mi turno", donde la persona ingresa **DNI del niño/a + fecha de nacimiento** (o + código de turno) para ver, cancelar o reprogramar.
- **Obra social:** opcional. Lista administrable desde el panel + campo "otra".

### Detección de urgencias / banderas rojas

- **Cartel de alarma fijo**, siempre visible al inicio del flujo: "Si tu hijo/a tiene dificultad para respirar, convulsiones, fiebre en menor de 3 meses, etc., no saques turno: andá a la guardia ya."
- Algunas **categorías marcadas como "derivar a guardia"** (ej. traumatismo, quemadura): si la persona las elige, el flujo se corta y se muestra el mensaje de derivación en vez de ofrecer slots.
- **Descargo de responsabilidad explícito:** el sistema no realiza triage clínico.

## 4. Panel administrativo

- **Salas / consultorios:** son un **atributo informativo** de la agenda/franja (consultorio + ubicación), editable por Coordinación. Se muestran en la confirmación del turno y en una vista de ocupación del día. **Sin** lógica de conflictos ni reserva de salas como recurso.
- **"Médicos de turno":** vista derivada automáticamente de la agenda (qué profesionales atienden hoy, en qué horario y consultorio). Coordinación puede marcar a un profesional como **ausente ese día**, lo que dispara el flujo "profesional caído". Sin check-in del profesional.
- **Reportes (MVP):** tablas con filtro de rango de fechas + **export CSV**. Sin dashboards con gráficos elaborados.
  - Turnos por día/semana: agendados, atendidos, ausentes, cancelados (con % de ausentismo).
  - Demanda por especialidad y por categoría de problema.
  - Sobreturnos y desplazamientos del período (con motivo).
  - Ocupación por profesional (slots ofrecidos vs. usados).
  - Demanda espontánea registrada por Recepción (volumen, prioridades, horarios pico).

## 5. Bot de WhatsApp

- **Alcance:** subconjunto de funciones —
  - Sacar turno (categoría → especialidad → **opcionalmente profesional específico** → primer slot disponible).
  - Consultar "¿cuándo es mi turno?".
  - Cancelar el turno propio.
- **No** hace reprogramación dentro del chat. Casos raros (dos turnos activos, datos que no coinciden, errores) → "te comunico con el hospital" (deriva a atención humana).
- Flujo guiado por menús/botones. Mismo backend que el formulario web.
- **Infraestructura:** Baileys (WhatsApp Web no oficial) para desarrollo, detrás de una capa de abstracción `MessagingProvider` reemplazable por la Cloud API oficial de Meta para producción real. Ver [stack-y-fases.md](stack-y-fases.md).

## 6. Notificaciones

| Evento | Canal |
|--------|-------|
| Confirmación al sacar turno | Email + WhatsApp (los que haya) |
| Recordatorio 24 h antes | WhatsApp (fallback email) |
| Turno cancelado por el hospital | Email + WhatsApp |
| "Estamos reprogramando tu turno" (profesional caído) | Email + WhatsApp |
| Turno reprogramado / desplazado (requiere confirmación) | Email + WhatsApp con opción de confirmar |
| Turno liberado por vencimiento de confirmación | Email + WhatsApp |

- **Sin SMS** en el MVP.
- **Un solo recordatorio**, a 24 h.
- Todos los envíos quedan en un **log con estado** (enviado / fallido). La tabla `notificaciones` funciona como cola persistente.

## 7. Datos personales (Ley 25.326 — datos de salud de menores)

**Incluido en el MVP:**

- Checkbox de **consentimiento informado** en formulario y bot antes de enviar datos, con link a una **política de privacidad**.
- **Política de retención:** los turnos y datos asociados se anonimizan/purgan a los N meses de completado el turno.
- Función **"borrar mis datos"** a pedido.
- Datos cifrados en tránsito (HTTPS). Contraseñas hasheadas.
- **Log de auditoría de acciones** (desplazamientos, sobreturnos, cambios de agenda) desde el inicio.

**Diferido al endurecimiento pre-producción:**

- Cifrado en reposo de campos sensibles (motivo de consulta, categoría).
- Log de auditoría de **lecturas** de datos de pacientes.

## 8. Dispositivo, accesibilidad, datos de prueba

- **Formulario ciudadano:** mobile-first, responsive. Navegadores modernos (últimas 2 versiones de Chrome/Safari/Firefox en Android/iOS). Sin IE.
- **Panel administrativo:** desktop-first, responsive básico.
- **Accesibilidad:** apuntar a **WCAG 2.1 AA** en lo razonable (contraste, navegación por teclado, labels, lenguaje simple). Sin certificación formal en el MVP.
- **Datos de catálogo:** seed ficticio realista (especialidades típicas de un hospital pediátrico argentino, ~2–3 profesionales por especialidad, 15–20 categorías de problema con su mapeo a especialidad). Todo cargable y editable desde el panel.

## 9. Fuera de alcance del MVP

- Historia clínica / registro de la atención médica.
- Fila digital / gestión de sala de espera con pantallas y llamado.
- Cuentas de usuario ciudadano con login y multi-hijo.
- Triage clínico formal / cuestionario de banderas rojas.
- Integración con HIS, farmacia, laboratorio o validación de cobertura de obras sociales online.
- App móvil nativa.
- Multi-efector / multi-tenant.
- Pagos / cobros.
- Reprogramación automática masiva.
- Penalización automática por ausentismo.
- Recordatorios por SMS.
- Profesional de demanda espontánea "siempre activo" (queda solo el sobreturno + desplazamiento manual).
- Cupo de turnos reservados por agenda para asignación el mismo día (se evaluó y se descartó a favor del esquema de prioridades + sobreturno).
- WhatsApp API oficial (se usa Baileys en desarrollo).
- Cifrado en reposo por campo y audit log de lecturas (endurecimiento pre-producción).
