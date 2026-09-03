export type Step = "MENU" | "CONSENT" | "CATEGORY" | "SPECIALTY" | "LOOKUP" | "CANCEL";

export interface Conversation { phone: string; step: Step; data: Record<string, string>; expiresAt: Date; }

export interface ConversationStore {
  get(phone: string): Promise<Conversation | null>;
  save(conversation: Conversation): Promise<void>;
  remove(phone: string): Promise<void>;
}

export class MemoryConversationStore implements ConversationStore {
  private readonly conversations = new Map<string, Conversation>();
  async get(phone: string) { return this.conversations.get(phone) ?? null; }
  async save(conversation: Conversation) { this.conversations.set(conversation.phone, conversation); }
  async remove(phone: string) { this.conversations.delete(phone); }
}
