import { describe, expect, it } from "vitest";
import { MemoryConversationStore } from "../src/conversation-store.js";
import { DemoAppointmentGateway } from "../src/demo-gateway.js";
import { ConversationEngine } from "../src/engine.js";
import { FakeMessagingProvider } from "../src/fake-provider.js";
import { BotRuntime } from "../src/runtime.js";

describe("BotRuntime", () => {
  it("no procesa dos veces el mismo mensaje", async () => {
    const provider = new FakeMessagingProvider();
    const runtime = new BotRuntime(provider, new ConversationEngine(new MemoryConversationStore(), new DemoAppointmentGateway()));
    await runtime.start();
    const message = { id: "same", from: "5491112345678@s.whatsapp.net", text: "hola", receivedAt: new Date() };
    await provider.receive(message); await provider.receive(message);
    expect(provider.sent).toHaveLength(1);
  });
});
