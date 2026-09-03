import type { IncomingMessage, MessagingProvider } from "./contracts.js";
import { ConversationEngine } from "./engine.js";

export class BotRuntime {
  private readonly processed = new Set<string>();
  constructor(private readonly provider: MessagingProvider, private readonly engine: ConversationEngine) {}
  async start() { this.provider.onMessage((message) => this.handle(message)); await this.provider.connect(); }
  async stop() { await this.provider.disconnect(); }
  private async handle(message: IncomingMessage) {
    if (this.processed.has(message.id)) return;
    this.processed.add(message.id);
    const reply = await this.engine.reply(message);
    await this.provider.sendText(message.from, reply);
  }
}
