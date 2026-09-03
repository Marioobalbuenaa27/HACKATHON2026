import type { AppointmentGateway, AppointmentResult, Category, Slot, Specialty } from "./contracts.js";

const categories: Category[] = [
  { id: "general", name: "Control pediátrico", emergency: false },
  { id: "respiratorio", name: "Problema respiratorio", emergency: false },
  { id: "urgencia", name: "Dificultad para respirar", emergency: true },
];
const specialties: Specialty[] = [{ id: "pediatria", name: "Pediatría general" }, { id: "neumo", name: "Neumonología infantil" }];

export class DemoAppointmentGateway implements AppointmentGateway {
  async categories() { return categories; }
  async specialties(categoryId: string) { return categoryId === "general" ? specialties.slice(0, 1) : categoryId === "respiratorio" ? specialties.slice(1) : []; }
  async firstSlot(input: { specialtyId: string }): Promise<Slot | null> { const specialty = specialties.find((x) => x.id === input.specialtyId); return specialty ? { id: "demo-slot", specialtyName: specialty.name, startsAt: new Date("2026-09-10T14:00:00Z"), professionalName: "Dra. Demo" } : null; }
  async lookup(): Promise<AppointmentResult> { return { status: "FOUND", summary: "Tu turno demo es el 10/09 a las 11:00." }; }
  async cancel(): Promise<AppointmentResult> { return { status: "FOUND", summary: "Tu turno demo fue cancelado." }; }
}
