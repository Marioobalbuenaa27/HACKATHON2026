/* Smoke test manual de los flujos de Fase 2 contra turnero_test. Ejecutar:
   npx dotenv -e .env.test -- npx tsx tests/smoke-fase2.ts                     */
import { db } from "@/lib/db";
import { crearTurnoInterno, cambiarEstadoTurno, registrarDemandaEspontanea, marcarAusenciaProfesional, cancelarTurno, desplazarTurno } from "@/lib/operacion";
import { fechaHoraARaUTC, hoyEnAR, sumarDias } from "@/lib/fechas";

const ok = (c: boolean, m: string) => { if (!c) { console.error("❌", m); process.exitCode = 1; } else console.log("✅", m); };

async function main() {
  await db.$executeRawUnsafe(`TRUNCATE TABLE "turnero_test"."auditoria","turnero_test"."evento_notificable","turnero_test"."caso_reprogramacion","turnero_test"."demanda_espontanea","turnero_test"."ausencia_profesional_dia","turnero_test"."turno","turnero_test"."paciente","turnero_test"."slot","turnero_test"."excepcion_agenda","turnero_test"."franja_agenda","turnero_test"."categoria_especialidad","turnero_test"."categoria_problema","turnero_test"."profesional_especialidad","turnero_test"."profesional","turnero_test"."especialidad","turnero_test"."sala","turnero_test"."usuario","turnero_test"."parametro_sistema" RESTART IDENTITY CASCADE`);

  const admin = await db.usuario.create({ data: { nombre: "A", email: `a${Date.now()}@h.test`, rol: "ADMIN", passwordHash: "x" } });
  const esp = await db.especialidad.create({ data: { nombre: "Pediatría", duracionTurnoMin: 30 } });
  const sala = await db.sala.create({ data: { identificador: `C${Date.now()}` } });
  const prof = await db.profesional.create({ data: { nombre: "P", apellido: "P", matricula: `M${Date.now()}`, especialidades: { create: [{ especialidadId: esp.id }] } } });
  const catNormal = await db.categoriaProblema.create({ data: { nombre: "Control", prioridadBase: "NORMAL", derivarAGuardia: false, especialidades: { create: [{ especialidadId: esp.id }] } } });
  const catGuardia = await db.categoriaProblema.create({ data: { nombre: "Ahogo", prioridadBase: "NORMAL", derivarAGuardia: true } });

  const f1 = sumarDias(hoyEnAR(), 3), f2 = sumarDias(hoyEnAR(), 4);
  const mkSlot = (f: string, h: string) => db.slot.create({ data: { profesionalId: prof.id, especialidadId: esp.id, salaId: sala.id, fecha: new Date(`${f}T00:00:00Z`), horaInicio: h, horaFin: "10:00", inicioUtc: fechaHoraARaUTC(f, h), finUtc: fechaHoraARaUTC(f, "10:00"), estado: "DISPONIBLE", origen: "FRANJA", origenId: "x" } });
  const s1 = await mkSlot(f1, "09:00"), s2 = await mkSlot(f2, "09:00"), s3 = await mkSlot(f1, "09:30");

  const actor = { usuarioId: admin.id, rol: "ADMIN" as const, profesionalId: null };
  const persona = { nombre: "Juan Perez", dni: "40111222", fechaNacimiento: "2018-05-01" };
  const resp = { nombre: "Ana", dni: "30111222", vinculo: "MADRE", telefono: "1122334455" };

  // 1. Reserva manual + Paciente
  const t1 = await crearTurnoInterno(db, actor, { slotId: s1.id, categoriaId: catNormal.id, paciente: persona, responsable: resp });
  const pac = await db.paciente.findUnique({ where: { dni: "40111222" } });
  ok(!!pac && t1.pacienteId === pac.id, "crearTurnoInterno crea/enlaza Paciente");
  ok((await db.slot.findUnique({ where: { id: s1.id } }))!.estado === "OCUPADO", "slot pasa a OCUPADO");

  // 2. Estado AUSENTE incrementa contador
  await cambiarEstadoTurno(db, actor, t1.id, "AUSENTE");
  ok((await db.paciente.findUnique({ where: { id: pac!.id } }))!.contadorAusencias === 1, "AUSENTE incrementa contadorAusencias");

  // 3. Demanda espontánea -> guardia
  const d1 = await registrarDemandaEspontanea(db, actor, { categoriaId: catGuardia.id, profesionalId: prof.id, especialidadId: esp.id, respuestas: { q: "si" }, paciente: persona, responsable: resp });
  ok(d1.turno === null && d1.demanda.derivadaAGuardia, "demanda categoría guardia no crea turno");

  // 4. Demanda -> sobreturno
  const d2 = await registrarDemandaEspontanea(db, actor, { categoriaId: catNormal.id, profesionalId: prof.id, especialidadId: esp.id, respuestas: { q: "x" }, paciente: { ...persona, dni: "40999888" }, responsable: resp });
  ok(!!d2.turno && d2.turno.tipo === "SOBRETURNO" && d2.turno.slotId === null, "demanda normal crea sobreturno sin slot");

  // 5. Desplazamiento: <24h rechazado sobre el origen
  const near = await mkSlot(hoyEnAR(), "09:00");
  const tNear = await crearTurnoInterno(db, actor, { slotId: near.id, categoriaId: catNormal.id, paciente: { ...persona, dni: "40777666" }, responsable: resp });
  let err = ""; try { await desplazarTurno(db, actor, tNear.id, s3.id, "m"); } catch (e) { err = (e as Error).message; }
  ok(err === "MENOS_DE_24_HORAS", "desplazamiento <24h del origen -> MENOS_DE_24_HORAS");

  // 6. Desplazamiento válido
  const t3 = await crearTurnoInterno(db, actor, { slotId: s3.id, categoriaId: catNormal.id, paciente: { ...persona, dni: "40555444" }, responsable: resp });
  const dsp = await desplazarTurno(db, actor, t3.id, s2.id, "cambio");
  ok(!!dsp.turno && dsp.turno.pacienteId === (await db.paciente.findUnique({ where: { dni: "40555444" } }))!.id, "turno desplazado conserva pacienteId");

  // 7. Cancelación
  const c = await cancelarTurno(db, actor, dsp.turno.id, "no viene");
  ok(c.estado === "CANCELADO", "cancelarTurno -> CANCELADO");

  // 8. Ausencia de profesional -> BLOQUEO + slots BLOQUEADO + AUSENCIA_YA_REGISTRADA
  const libre = await mkSlot(f1, "08:00");
  const r = await marcarAusenciaProfesional(db, actor, { profesionalId: prof.id, fecha: f1, motivo: "enfermo" });
  ok((await db.slot.findUnique({ where: { id: libre.id } }))!.estado === "BLOQUEADO", "ausencia bloquea slots DISPONIBLE de la fecha");
  ok((await db.excepcionAgenda.count({ where: { profesionalId: prof.id, tipo: "BLOQUEO" } })) === 1, "ausencia crea excepción BLOQUEO");
  let err2 = ""; try { await marcarAusenciaProfesional(db, actor, { profesionalId: prof.id, fecha: f1, motivo: "x" }); } catch (e) { err2 = (e as Error).message; }
  ok(err2 === "AUSENCIA_YA_REGISTRADA", "segunda ausencia -> AUSENCIA_YA_REGISTRADA");
  ok(r.turnosAReprogramar >= 0, "marcarAusencia devuelve turnosAReprogramar");

  await db.$disconnect();
  console.log(process.exitCode ? "\n💥 FALLARON checks" : "\n🎉 TODOS LOS CHECKS OK");
}
main().catch((e) => { console.error(e); process.exit(1); });
