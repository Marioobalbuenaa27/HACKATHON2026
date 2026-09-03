import type { AppointmentGateway, Category, IncomingMessage, Specialty } from "./contracts.js";
import type { Conversation, ConversationStore, Step } from "./conversation-store.js";

const MENU = "Hola, soy el asistente de turnos del hospital.\n1. Sacar un turno\n2. Consultar mi turno\n3. Cancelar mi turno\nEscribí el número de una opción.";
const HUMAN = "Para poder ayudarte con este caso, comunicate con la atención del hospital.";

export class ConversationEngine {
  constructor(private readonly store: ConversationStore, private readonly appointments: AppointmentGateway, private readonly ttlMinutes = 15) {}

  async reply(message: IncomingMessage): Promise<string> {
    const phone = normalizePhone(message.from);
    let conversation = await this.store.get(phone);
    if (!conversation || conversation.expiresAt <= message.receivedAt || /^(inicio|menu|hola)$/i.test(message.text.trim())) {
      conversation = this.newConversation(phone, "MENU");
      await this.store.save(conversation);
      return MENU;
    }
    const answer = await this.advance(conversation, message.text.trim());
    return answer;
  }

  private async advance(c: Conversation, text: string): Promise<string> {
    if (/^(humano|asesor)$/i.test(text)) return this.finish(c.phone, HUMAN);
    if (c.step === "MENU") {
      if (text === "1") return this.move(c, "CONSENT", "Antes de continuar necesitamos tu consentimiento para usar los datos sólo para gestionar el turno. Escribí ACEPTO para continuar.");
      if (text === "2") return this.move(c, "LOOKUP", "Escribí tu DNI para consultar el turno. Para salir, escribí HUMANO.");
      if (text === "3") return this.move(c, "CANCEL", "Escribí tu DNI para cancelar el turno. Para salir, escribí HUMANO.");
      return MENU;
    }
    if (c.step === "CONSENT") {
      if (!/^acepto$/i.test(text)) return "Para solicitar un turno necesitás escribir ACEPTO. Si preferís, escribí HUMANO.";
      const categories = await this.appointments.categories();
      c.data.categories = JSON.stringify(categories.map(({ id, name }) => ({ id, name })));
      return this.move(c, "CATEGORY", `Elegí el motivo:\n${categories.map((x, i) => `${i + 1}. ${x.name}`).join("\n")}`);
    }
    if (c.step === "CATEGORY") return this.selectCategory(c, text);
    if (c.step === "SPECIALTY") return this.selectSpecialty(c, text);
    if (c.step === "LOOKUP") return this.lookup(c, text, false);
    return this.lookup(c, text, true);
  }

  private async selectCategory(c: Conversation, text: string) {
    const categories: Pick<Category, "id" | "name">[] = JSON.parse(c.data.categories ?? "[]");
    const category = categories[Number(text) - 1];
    if (!category) return "Elegí un número de la lista.";
    const completeCategory = (await this.appointments.categories()).find((x) => x.id === category.id);
    if (completeCategory?.emergency) return this.finish(c.phone, "Por este motivo no saques un turno: acercate a la guardia inmediatamente.");
    const specialties = await this.appointments.specialties(category.id);
    if (!specialties.length) return this.finish(c.phone, HUMAN);
    c.data.categoryId = category.id;
    c.data.specialties = JSON.stringify(specialties);
    return this.move(c, "SPECIALTY", `Elegí una especialidad:\n${specialties.map((x, i) => `${i + 1}. ${x.name}`).join("\n")}`);
  }

  private async selectSpecialty(c: Conversation, text: string) {
    const specialties: Specialty[] = JSON.parse(c.data.specialties ?? "[]");
    const specialty = specialties[Number(text) - 1];
    if (!specialty) return "Elegí un número de la lista.";
    const slot = await this.appointments.firstSlot({ categoryId: c.data.categoryId, specialtyId: specialty.id, phone: c.phone });
    if (!slot) return this.finish(c.phone, "No encontramos disponibilidad por el momento. " + HUMAN);
    return this.finish(c.phone, `Turno demo: ${slot.specialtyName}, ${slot.startsAt.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}${slot.professionalName ? ` con ${slot.professionalName}` : ""}. La reserva real se conectará en la Fase 3.`);
  }

  private async lookup(c: Conversation, document: string, cancel: boolean) {
    if (!/^\d{7,9}$/.test(document)) return "Ingresá un DNI válido, sólo números.";
    const result = cancel ? await this.appointments.cancel({ phone: c.phone, document }) : await this.appointments.lookup({ phone: c.phone, document });
    return this.finish(c.phone, result.status === "FOUND" ? result.summary ?? "Encontramos tu turno." : result.status === "NOT_FOUND" ? "No encontramos un turno con esos datos." : HUMAN);
  }

  private newConversation(phone: string, step: Step): Conversation { return { phone, step, data: {}, expiresAt: this.expiry() }; }
  private async move(c: Conversation, step: Step, reply: string) { c.step = step; c.expiresAt = this.expiry(); await this.store.save(c); return reply; }
  private async finish(phone: string, reply: string) { await this.store.remove(phone); return reply; }
  private expiry() { return new Date(Date.now() + this.ttlMinutes * 60_000); }
}

export function normalizePhone(value: string) { return value.replace(/\D/g, ""); }
