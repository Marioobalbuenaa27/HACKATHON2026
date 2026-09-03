import { BaileysMessagingProvider } from "./baileys-provider.js";
import { MemoryConversationStore } from "./conversation-store.js";
import { DemoAppointmentGateway } from "./demo-gateway.js";
import { ConversationEngine } from "./engine.js";
import { BotRuntime } from "./runtime.js";

const authDir = process.env.WHATSAPP_AUTH_DIR ?? ".data/whatsapp-auth";
const ttl = Number(process.env.CONVERSATION_TTL_MINUTES ?? "15");
const runtime = new BotRuntime(new BaileysMessagingProvider(authDir), new ConversationEngine(new MemoryConversationStore(), new DemoAppointmentGateway(), ttl));
void runtime.start();
process.on("SIGINT", () => void runtime.stop().finally(() => process.exit(0)));
