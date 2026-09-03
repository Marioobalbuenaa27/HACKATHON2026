import type { PrismaClient } from "@prisma/client";

async function enviarEmail(destinatario: string, payload: Record<string, unknown>) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.warn(`[notificaciones] RESEND_API_KEY no configurada; omitido ${destinatario}`); return; }
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "Turnero JP <turnos@example.com>", to: [destinatario], subject: String(payload.asunto ?? "Actualización de turno"), text: `Tu turno fue actualizado. Identificador: ${String(payload.turnoId ?? "")}` }) });
  if (!response.ok) throw new Error(`EMAIL_${response.status}`);
}

export async function procesarNotificaciones(db: PrismaClient, limite = 50) {
  const eventos = await db.eventoNotificable.findMany({ where: { estado: "PENDIENTE" }, orderBy: { createdAt: "asc" }, take: limite });
  let entregados = 0; let fallidos = 0;
  for (const evento of eventos) {
    try { await enviarEmail(evento.destinatario, evento.payload as Record<string, unknown>); await db.eventoNotificable.update({ where: { id: evento.id }, data: { estado: "ENTREGADO", procesadoAt: new Date() } }); entregados++; }
    catch { await db.eventoNotificable.update({ where: { id: evento.id }, data: { estado: "FALLIDO", procesadoAt: new Date() } }); fallidos++; }
  }
  return { procesados: eventos.length, entregados, fallidos };
}