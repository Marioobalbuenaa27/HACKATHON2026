import type { IncomingMessage, MessagingProvider } from "./contracts.js";

export class FakeMessagingProvider implements MessagingProvider {
  readonly sent: Array<{ to: string; text: string }> = [];
  private listener?: (message: IncomingMessage) => Promise<void>;
  async connect() {}
  async disconnect() {}
  async sendText(to: string, text: string) { this.sent.push({ to, text }); }
  onMessage(listener: (message: IncomingMessage) => Promise<void>) { this.listener = listener; }
  async receive(message: IncomingMessage) { await this.listener?.(message); }
}
