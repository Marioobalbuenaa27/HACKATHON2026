export interface IncomingMessage {
  id: string;
  from: string;
  text: string;
  receivedAt: Date;
}

export interface MessagingProvider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendText(to: string, text: string): Promise<void>;
  onMessage(listener: (message: IncomingMessage) => Promise<void>): void;
}

export interface Category { id: string; name: string; emergency: boolean; }
export interface Specialty { id: string; name: string; }
export interface Slot { id: string; specialtyName: string; startsAt: Date; professionalName?: string; }
export interface Lookup { phone: string; document?: string; }
export interface AppointmentResult { status: "FOUND" | "NOT_FOUND" | "OUT_OF_SCOPE"; summary?: string; }

export interface AppointmentGateway {
  categories(): Promise<Category[]>;
  specialties(categoryId: string): Promise<Specialty[]>;
  firstSlot(input: { categoryId: string; specialtyId: string; phone: string }): Promise<Slot | null>;
  lookup(input: Lookup): Promise<AppointmentResult>;
  cancel(input: Lookup): Promise<AppointmentResult>;
}
