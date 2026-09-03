import { describe, expect, it } from "vitest";
import { MemoryConversationStore } from "../src/conversation-store.js";
import { DemoAppointmentGateway } from "../src/demo-gateway.js";
import { ConversationEngine } from "../src/engine.js";

const message = (text: string) => ({ id: crypto.randomUUID(), from: "5491112345678@s.whatsapp.net", text, receivedAt: new Date() });

describe("ConversationEngine", () => {
  it("muestra el menú y completa un turno demo", async () => {
    const engine = new ConversationEngine(new MemoryConversationStore(), new DemoAppointmentGateway());
    expect(await engine.reply(message("hola"))).toContain("Sacar un turno");
    expect(await engine.reply(message("1"))).toContain("consentimiento");
    expect(await engine.reply(message("ACEPTO"))).toContain("Control pediátrico");
    expect(await engine.reply(message("1"))).toContain("Pediatría general");
    expect(await engine.reply(message("1"))).toContain("Turno demo");
  });

  it("deriva a guardia ante una categoría urgente", async () => {
    const engine = new ConversationEngine(new MemoryConversationStore(), new DemoAppointmentGateway());
    await engine.reply(message("hola")); await engine.reply(message("1")); await engine.reply(message("ACEPTO"));
    expect(await engine.reply(message("3"))).toContain("guardia");
  });
});
