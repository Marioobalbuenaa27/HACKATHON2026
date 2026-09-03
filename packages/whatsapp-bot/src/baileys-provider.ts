import makeWASocket, { DisconnectReason, useMultiFileAuthState } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import type { IncomingMessage, MessagingProvider } from "./contracts.js";

export class BaileysMessagingProvider implements MessagingProvider {
  private listener?: (message: IncomingMessage) => Promise<void>;
  private socket?: ReturnType<typeof makeWASocket>;
  private reconnecting = false;
  constructor(private readonly authDir: string) {}
  onMessage(listener: (message: IncomingMessage) => Promise<void>) { this.listener = listener; }
  async connect(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
    const socket = makeWASocket({ auth: state, printQRInTerminal: true });
    this.socket = socket;
    socket.ev.on("creds.update", saveCreds);
    socket.ev.on("messages.upsert", ({ messages, type }) => {
      if (type !== "notify") return;
      for (const message of messages) {
        const from = message.key.remoteJid;
        const text = message.message?.conversation ?? message.message?.extendedTextMessage?.text;
        if (!from || !text || message.key.fromMe) continue;
        void this.listener?.({ id: message.key.id ?? `${from}-${Date.now()}`, from, text, receivedAt: new Date() });
      }
    });
    socket.ev.on("connection.update", ({ connection, lastDisconnect }) => {
      if (connection !== "close" || this.reconnecting) return;
      const code = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) return;
      this.reconnecting = true;
      setTimeout(() => { this.reconnecting = false; void this.connect(); }, 2_000);
    });
  }
  async disconnect() { this.socket?.end(undefined); this.socket = undefined; }
  async sendText(to: string, text: string) { if (!this.socket) throw new Error("WhatsApp no está conectado"); await this.socket.sendMessage(to, { text }); }
}
