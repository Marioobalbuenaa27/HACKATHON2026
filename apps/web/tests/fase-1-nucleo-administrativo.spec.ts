/**
 * Suite de la Fase 1 — Núcleo administrativo (Turnero JP).
 * 45 acceptance criteria + 19 edge cases del spec
 * docs/specs/fase-1-nucleo-administrativo.md, implementados contra los Route
 * Handlers de /api/admin/** y la función pura de cálculo de slots.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Prisma } from "@prisma/client";

import { db, usarSesion } from "./setup";
import { actuarComo, actuarComoRol, crearUsuarioDB, crearEspecialidadDB, crearSalaDB, crearProfesionalDB, llamar, sembrarParametros, fallarUnaVez, PASSWORD_OK } from "./helpers";
import { _resetRateLimit, registrarLoginFallido } from "@/lib/rate-limit";
import { hoyEnAR, sumarDias, diaSemanaDeFecha } from "@/lib/fechas";
import { calcularSlots } from "@/lib/slots/calcular";

import { POST as login } from "@/app/api/admin/auth/login/route";
import { POST as logout } from "@/app/api/admin/auth/logout/route";
import { GET as me } from "@/app/api/admin/auth/me/route";
import { POST as crearUsuario } from "@/app/api/admin/usuarios/route";
import { PATCH as editarUsuario } from "@/app/api/admin/usuarios/[id]/route";
import { GET as listarEsp, POST as crearEsp } from "@/app/api/admin/especialidades/route";
import { PATCH as editarEsp } from "@/app/api/admin/especialidades/[id]/route";
import { POST as crearProf } from "@/app/api/admin/profesionales/route";
import { PATCH as editarProf } from "@/app/api/admin/profesionales/[id]/route";
import { GET as listarCat, POST as crearCat } from "@/app/api/admin/categorias/route";
import { PATCH as editarCat } from "@/app/api/admin/categorias/[id]/route";
import { PUT as mapearCat } from "@/app/api/admin/categorias/[id]/especialidades/route";
import { POST as crearSala } from "@/app/api/admin/salas/route";
import { GET as listarOS, POST as crearOS } from "@/app/api/admin/obras-sociales/route";
import { POST as crearFranja } from "@/app/api/admin/franjas/route";
import { DELETE as borrarFranja } from "@/app/api/admin/franjas/[id]/route";
import { POST as crearExcepcion } from "@/app/api/admin/excepciones/route";
import { GET as listarSlots } from "@/app/api/admin/slots/route";
import { POST as generarSlotsHTTP } from "@/app/api/admin/slots/generar/route";
import { GET as getParametros, PATCH as patchParametros } from "@/app/api/admin/parametros/route";
import { GET as getAuditoria } from "@/app/api/admin/auditoria/route";
import { PATCH as patchAuditoria, DELETE as deleteAuditoria } from "@/app/api/admin/auditoria/[id]/route";

beforeEach(() => _resetRateLimit());

// Helpers de armado
async function agendaBase(dur = 15) {
  const esp = await crearEspecialidadDB({ duracionTurnoMin: dur });
  const sala = await crearSalaDB();
  const prof = await crearProfesionalDB([esp.id]);
  return { esp, sala, prof };
}
const proximoDia = (dia: string) => {
  let f = hoyEnAR();
  for (let i = 0; i < 8; i++) {
    if (diaSemanaDeFecha(f) === dia) return f;
    f = sumarDias(f, 1);
  }
  return f;
};

// ───────────────────────── Autenticación ─────────────────────────

describe("Autenticación y roles", () => {
  it("AC-1: Login exitoso [FR-1, FR-4]", async () => {
    const u = await crearUsuarioDB({ email: "coord@hospital.test", rol: "COORDINACION", nombre: "Coord" });
    const r = await llamar(login, { body: { email: "coord@hospital.test", password: PASSWORD_OK } });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ usuarioId: u.id, nombre: "Coord", rol: "COORDINACION" });
    expect(JSON.stringify(r.body)).not.toMatch(/passwordHash|argon2/i);
    expect(r.setCookie).toMatch(/authjs\.session-token=/);
    expect(r.setCookie?.toLowerCase()).toContain("httponly");
    expect(r.setCookie?.toLowerCase()).toContain("samesite=lax");
  });

  it("AC-2: Login con contraseña incorrecta [FR-2, FR-3]", async () => {
    await crearUsuarioDB({ email: "coord@hospital.test", rol: "COORDINACION" });
    const r = await llamar(login, { body: { email: "coord@hospital.test", password: "otra-clave-99" } });
    expect(r.status).toBe(401);
    expect(r.body.error).toBe("CREDENCIALES_INVALIDAS");
    expect(r.setCookie).toBeNull();
  });

  it("AC-3: Login de usuario inactivo [FR-2]", async () => {
    await crearUsuarioDB({ email: "coord@hospital.test", rol: "COORDINACION", activo: false });
    const r = await llamar(login, { body: { email: "coord@hospital.test", password: PASSWORD_OK } });
    expect(r.status).toBe(401);
    expect(r.body.error).toBe("CREDENCIALES_INVALIDAS");
  });

  it("AC-4: Acceso sin sesión bloqueado [FR-6, NFR-S1]", async () => {
    const r = await llamar(listarEsp, {});
    expect(r.status).toBe(401);
    expect(r.body.error).toBe("NO_AUTENTICADO");
  });

  it("AC-5: Acceso con rol no autorizado [FR-7, NFR-S7]", async () => {
    await actuarComoRol("PROFESIONAL");
    const r = await llamar(crearEsp, { body: { nombre: "X", duracionTurnoMin: 15 } });
    expect(r.status).toBe(403);
    expect(r.body.error).toBe("NO_AUTORIZADO");
    expect(await db.especialidad.count()).toBe(0);
  });

  it("AC-6: Rate limiting de login [NFR-S2]", async () => {
    await crearUsuarioDB({ email: "coord@hospital.test", rol: "COORDINACION" });
    for (let i = 0; i < 5; i++) registrarLoginFallido("1.2.3.4", "coord@hospital.test");
    const r = await llamar(login, {
      body: { email: "coord@hospital.test", password: PASSWORD_OK },
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    expect(r.status).toBe(429);
    expect(r.body.error).toBe("DEMASIADOS_INTENTOS");
  });

  it("AC-7: Alta de usuario por ADMIN y reset de contraseña [FR-8, FR-5, FR-12]", async () => {
    await actuarComoRol("ADMIN");
    const r = await llamar(crearUsuario, { body: { nombre: "Nueva Recep", email: "nueva@hospital.test", rol: "RECEPCION" } });
    expect(r.status).toBe(201);
    expect(r.body.passwordTemporal).toBeTypeOf("string");
    expect(JSON.stringify(r.body)).not.toMatch(/passwordHash|argon2/i);

    usarSesion(null);
    const l = await llamar(login, { body: { email: "nueva@hospital.test", password: r.body.passwordTemporal } });
    expect(l.status).toBe(200);
    expect(l.body.rol).toBe("RECEPCION");
  });

  it("AC-8: ADMIN no puede autodesactivarse [FR-10]", async () => {
    const u = await crearUsuarioDB({ rol: "ADMIN" });
    await crearUsuarioDB({ rol: "ADMIN" }); // otro admin, para descartar ULTIMO_ADMIN
    actuarComo({ usuarioId: u.id, rol: "ADMIN" });
    const r = await llamar(editarUsuario, { body: { activo: false }, params: { id: u.id } });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe("OPERACION_SOBRE_SI_MISMO");
    expect((await db.usuario.findUnique({ where: { id: u.id } }))?.activo).toBe(true);
  });

  it("AC-9: Desactivar cuenta cierra su sesión y no borra el usuario [FR-9, FR-11, NFR-S4]", async () => {
    await actuarComoRol("ADMIN");
    const u2 = await crearUsuarioDB({ rol: "RECEPCION", email: "u2@hospital.test" });
    const r = await llamar(editarUsuario, { body: { activo: false }, params: { id: u2.id } });
    expect(r.status).toBe(200);

    // Petición autenticada de U2 -> 401 (me revalida contra la DB).
    actuarComo({ usuarioId: u2.id, rol: "RECEPCION" });
    expect((await llamar(me, {})).status).toBe(401);

    // No puede volver a loguearse.
    usarSesion(null);
    expect((await llamar(login, { body: { email: "u2@hospital.test", password: PASSWORD_OK } })).status).toBe(401);

    // El registro sigue existiendo.
    expect(await db.usuario.findUnique({ where: { id: u2.id } })).not.toBeNull();
  });

  it("AC-10: Logout invalida la sesión [FR-11]", async () => {
    await actuarComoRol("ADMIN");
    const r = await llamar(logout, {});
    expect(r.status).toBe(204);
    expect(r.setCookie).toMatch(/authjs\.session-token=;|Max-Age=0/i);

    usarSesion(null);
    expect((await llamar(me, {})).status).toBe(401);
  });

  it("EC-1: Email inválido en login -> 400 VALIDACION sin tocar credenciales", async () => {
    const r = await llamar(login, { body: { email: "no-es-email", password: PASSWORD_OK } });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("VALIDACION");
  });

  it("EC-3: Sin sesión en el store -> 401 NO_AUTENTICADO", async () => {
    usarSesion(null);
    const r = await llamar(me, {});
    expect(r.status).toBe(401);
    expect(r.body.error).toBe("NO_AUTENTICADO");
  });
});

// ───────────────────────── Especialidades ─────────────────────────

describe("ABM especialidades", () => {
  it("AC-11: Alta de especialidad [FR-13, FR-24]", async () => {
    await actuarComoRol("ADMIN");
    const r = await llamar(crearEsp, { body: { nombre: "Cardiología infantil", duracionTurnoMin: 20 } });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ nombre: "Cardiología infantil", duracionTurnoMin: 20, activa: true });
  });

  it("AC-12: Especialidad con nombre duplicado [FR-24]", async () => {
    await actuarComoRol("ADMIN");
    await crearEspecialidadDB({ nombre: "Cardiología infantil" });
    const r = await llamar(crearEsp, { body: { nombre: "cardiología INFANTIL", duracionTurnoMin: 30 } });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe("NOMBRE_DUPLICADO");
  });

  it("AC-13: Duración de turno inválida [FR-13]", async () => {
    await actuarComoRol("ADMIN");
    const r = await llamar(crearEsp, { body: { nombre: "Test", duracionTurnoMin: 22 } });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("VALIDACION");
    expect(r.body.details.duracionTurnoMin).toBeDefined();
  });

  it("AC-22: No se desactiva una especialidad usada por una franja activa [FR-21]", async () => {
    const { esp, prof, sala } = await agendaBase();
    await db.franjaAgenda.create({
      data: {
        profesionalId: prof.id, diaSemana: "LUNES", horaInicio: "08:00", horaFin: "09:00",
        especialidadId: esp.id, salaId: sala.id, vigenciaDesde: new Date("2026-01-01T00:00:00Z"),
      },
    });
    await actuarComoRol("ADMIN");
    const r = await llamar(editarEsp, { body: { activa: false }, params: { id: esp.id } });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe("ENTIDAD_EN_USO");
    expect(r.body.details.franjas).toHaveLength(1);
  });

  it("AC-23: Entidades desactivadas se excluyen del listado por defecto [FR-22]", async () => {
    await db.obraSocial.create({ data: { nombre: "OS9", activa: false } });
    await actuarComoRol("ADMIN");
    const visible = await llamar(listarOS, {});
    expect(visible.body.items.find((o: { nombre: string }) => o.nombre === "OS9")).toBeUndefined();
    const todas = await llamar(listarOS, { query: { incluirInactivas: "true" } });
    expect(todas.body.items.find((o: { nombre: string }) => o.nombre === "OS9")).toBeDefined();
  });

  it("EC-2: JSON malformado -> 400 JSON_INVALIDO", async () => {
    await actuarComoRol("ADMIN");
    const r = await llamar(crearEsp, { raw: "{ no es json" });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("JSON_INVALIDO");
  });

  it("EC-4: Nombre duplicado por carrera -> 409 NOMBRE_DUPLICADO", async () => {
    await actuarComoRol("ADMIN");
    const a = await llamar(crearEsp, { body: { nombre: "Nefro", duracionTurnoMin: 15 } });
    const b = await llamar(crearEsp, { body: { nombre: "Nefro", duracionTurnoMin: 15 } });
    expect(a.status).toBe(201);
    expect(b.status).toBe(409);
    expect(b.body.error).toBe("NOMBRE_DUPLICADO");
  });

  it("EC-5: Caída de PostgreSQL -> 503 BASE_DE_DATOS_NO_DISPONIBLE", async () => {
    await actuarComoRol("ADMIN");
    const err = new Prisma.PrismaClientKnownRequestError("db down", { code: "P1001", clientVersion: "x" });
    fallarUnaVez(db.especialidad, "count", err);
    fallarUnaVez(db.especialidad, "findMany", err);
    const r = await llamar(listarEsp, {});
    expect(r.status).toBe(503);
    expect(r.body.error).toBe("BASE_DE_DATOS_NO_DISPONIBLE");
  });

  it("EC-11: Cambiar duración marca franjas inconsistentes [EC-11]", async () => {
    const { esp, prof, sala } = await agendaBase(15);
    const franja = await db.franjaAgenda.create({
      data: {
        profesionalId: prof.id, diaSemana: "LUNES", horaInicio: "08:00", horaFin: "09:00",
        especialidadId: esp.id, salaId: sala.id, vigenciaDesde: new Date("2026-01-01T00:00:00Z"),
      },
    });
    await actuarComoRol("ADMIN");
    await llamar(editarEsp, { body: { duracionTurnoMin: 25 }, params: { id: esp.id } });
    expect((await db.franjaAgenda.findUnique({ where: { id: franja.id } }))?.inconsistente).toBe(true);

    await actuarComoRol("COORDINACION");
    const g = await llamar(generarSlotsHTTP, { body: { profesionalId: prof.id } });
    expect(g.body.franjasInconsistentesOmitidas).toContain(franja.id);
    expect(await db.slot.count({ where: { profesionalId: prof.id } })).toBe(0);
  });

  it("EC-17: Paginación fuera de rango se normaliza", async () => {
    await actuarComoRol("ADMIN");
    await crearEspecialidadDB();
    const r = await llamar(listarEsp, { query: { page: "999", pageSize: "500" } });
    expect(r.status).toBe(200);
    expect(r.body.pageSize).toBe(100);
    expect(r.body.items).toHaveLength(0);
  });
});

// ───────────────────────── Profesionales ─────────────────────────

describe("ABM profesionales", () => {
  it("AC-14: Alta de profesional con especialidad [FR-14]", async () => {
    const esp = await crearEspecialidadDB({ nombre: "Pediatría general" });
    await actuarComoRol("COORDINACION");
    const r = await llamar(crearProf, {
      body: { nombre: "Ana", apellido: "López", matricula: "MP-1", especialidadIds: [esp.id] },
    });
    expect(r.status).toBe(201);
    expect(r.body.especialidadIds).toEqual([esp.id]);
  });

  it("AC-15: Profesional sin especialidad rechazado [FR-14]", async () => {
    await actuarComoRol("COORDINACION");
    const r = await llamar(crearProf, { body: { nombre: "A", apellido: "B", matricula: "MP-2", especialidadIds: [] } });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("VALIDACION");
    expect(r.body.details.especialidadIds).toBeDefined();
  });

  it("AC-16: Un usuario PROFESIONAL no puede vincularse a dos profesionales [FR-15]", async () => {
    const esp = await crearEspecialidadDB();
    const u5 = await crearUsuarioDB({ rol: "PROFESIONAL", email: "u5@hospital.test" });
    await crearProfesionalDB([esp.id], { usuarioId: u5.id, matricula: "MP-P1" });
    const p2 = await crearProfesionalDB([esp.id], { matricula: "MP-P2" });
    await actuarComoRol("COORDINACION");
    const r = await llamar(editarProf, { body: { usuarioId: u5.id }, params: { id: p2.id } });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe("USUARIO_YA_VINCULADO");
  });

  it("EC-18: Matrícula de profesional duplicada -> 409 MATRICULA_DUPLICADA", async () => {
    const esp = await crearEspecialidadDB();
    await crearProfesionalDB([esp.id], { matricula: "MP-DUP" });
    await actuarComoRol("COORDINACION");
    const r = await llamar(crearProf, {
      body: { nombre: "A", apellido: "B", matricula: "mp-dup", especialidadIds: [esp.id] },
    });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe("MATRICULA_DUPLICADA");
  });
});

// ───────────────────────── Categorías ─────────────────────────

describe("ABM categorías y mapeo", () => {
  it("AC-17: Alta de categoría de problema [FR-16]", async () => {
    await actuarComoRol("ADMIN");
    const r = await llamar(crearCat, {
      body: { nombre: "Tos y mocos hace varios días", prioridadBase: "NORMAL", derivarAGuardia: false },
    });
    expect(r.status).toBe(201);
    expect(r.body.nombre).toBe("Tos y mocos hace varios días");
  });

  it("AC-18: Mapeo categoría → especialidad muchos a muchos [FR-17]", async () => {
    const e1 = await crearEspecialidadDB();
    const e2 = await crearEspecialidadDB();
    const cat = await db.categoriaProblema.create({ data: { nombre: "C1", prioridadBase: "NORMAL" } });
    await actuarComoRol("ADMIN");
    const r = await llamar(mapearCat, {
      body: [{ especialidadId: e1.id }, { especialidadId: e2.id, nota: "Si además hay fiebre" }],
      params: { id: cat.id },
    });
    expect(r.status).toBe(200);
    expect(r.body.especialidades).toHaveLength(2);
    expect(r.body.especialidades.find((x: { especialidadId: string }) => x.especialidadId === e2.id).nota).toBe("Si además hay fiebre");
  });

  it("AC-19: Categoría 'derivar a guardia' no admite mapeos [FR-18]", async () => {
    const e1 = await crearEspecialidadDB();
    const c2 = await db.categoriaProblema.create({ data: { nombre: "C2", prioridadBase: "NORMAL", derivarAGuardia: true } });
    await actuarComoRol("ADMIN");
    const r = await llamar(mapearCat, { body: [{ especialidadId: e1.id }], params: { id: c2.id } });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe("CATEGORIA_DERIVA_A_GUARDIA");
  });

  it("AC-20: No se puede marcar derivarAGuardia con mapeos existentes [FR-18]", async () => {
    const e1 = await crearEspecialidadDB();
    const c3 = await db.categoriaProblema.create({
      data: { nombre: "C3", prioridadBase: "NORMAL", especialidades: { create: [{ especialidadId: e1.id }] } },
    });
    await actuarComoRol("ADMIN");
    const r = await llamar(editarCat, { body: { derivarAGuardia: true }, params: { id: c3.id } });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe("CATEGORIA_TIENE_MAPEOS");
  });

  it("AC-24: Reordenar categorías [FR-23]", async () => {
    const c1 = await db.categoriaProblema.create({ data: { nombre: "C1", prioridadBase: "NORMAL", orden: 1 } });
    const c2 = await db.categoriaProblema.create({ data: { nombre: "C2", prioridadBase: "NORMAL", orden: 2 } });
    await actuarComoRol("ADMIN");
    await llamar(editarCat, { body: { orden: 0 }, params: { id: c2.id } });
    const r = await llamar(listarCat, {});
    const ids = r.body.items.map((c: { id: string }) => c.id);
    expect(ids.indexOf(c2.id)).toBeLessThan(ids.indexOf(c1.id));
  });

  it("EC-19: Mapeo con especialidad inexistente/inactiva -> 400 VALIDACION", async () => {
    const inactiva = await crearEspecialidadDB({ activa: false });
    const cat = await db.categoriaProblema.create({ data: { nombre: "C1", prioridadBase: "NORMAL" } });
    await actuarComoRol("ADMIN");
    const r = await llamar(mapearCat, { body: [{ especialidadId: inactiva.id }], params: { id: cat.id } });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("VALIDACION");
    expect(JSON.stringify(r.body.details)).toContain(inactiva.id);
  });
});

// ───────────────────────── Salas / obras sociales ─────────────────────────

describe("ABM salas y obras sociales", () => {
  it("AC-21: Alta de sala y de obra social [FR-19, FR-20]", async () => {
    await actuarComoRol("COORDINACION");
    const s = await llamar(crearSala, { body: { identificador: "Consultorio 4", ubicacion: "PB ala este" } });
    expect(s.status).toBe(201);
    expect(s.body).toMatchObject({ identificador: "Consultorio 4", activa: true });

    await actuarComoRol("ADMIN");
    const o = await llamar(crearOS, { body: { nombre: "OSDE" } });
    expect(o.status).toBe(201);
    expect(o.body).toMatchObject({ nombre: "OSDE", activa: true });
  });
});

// ───────────────────────── Franjas ─────────────────────────

describe("Franjas de agenda", () => {
  it("AC-25: Alta de franja de agenda válida [FR-25, FR-26]", async () => {
    const { esp, prof, sala } = await agendaBase(15);
    await actuarComoRol("COORDINACION");
    const r = await llamar(crearFranja, {
      body: {
        profesionalId: prof.id, diaSemana: "LUNES", horaInicio: "08:00", horaFin: "12:00",
        especialidadId: esp.id, salaId: sala.id, vigenciaDesde: hoyEnAR(),
      },
    });
    expect(r.status).toBe(201);
    expect(r.body.diaSemana).toBe("LUNES");
  });

  it("AC-26: Franja con fin anterior al inicio [FR-26]", async () => {
    await actuarComoRol("COORDINACION");
    const r = await llamar(crearFranja, {
      body: {
        profesionalId: "x", diaSemana: "LUNES", horaInicio: "12:00", horaFin: "08:00",
        especialidadId: "x", salaId: "x", vigenciaDesde: hoyEnAR(),
      },
    });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("VALIDACION");
    expect(r.body.details.horaFin).toBeDefined();
  });

  it("AC-27: Franja con duración no múltiplo de la duración de turno [FR-26]", async () => {
    const { esp, prof, sala } = await agendaBase(20);
    await actuarComoRol("COORDINACION");
    const r = await llamar(crearFranja, {
      body: {
        profesionalId: prof.id, diaSemana: "LUNES", horaInicio: "08:00", horaFin: "08:30",
        especialidadId: esp.id, salaId: sala.id, vigenciaDesde: hoyEnAR(),
      },
    });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("VALIDACION");
  });

  it("AC-28: Franjas solapadas del mismo profesional [FR-27]", async () => {
    const { esp, prof, sala } = await agendaBase(60);
    const f1 = await db.franjaAgenda.create({
      data: {
        profesionalId: prof.id, diaSemana: "LUNES", horaInicio: "08:00", horaFin: "12:00",
        especialidadId: esp.id, salaId: sala.id, vigenciaDesde: new Date("2026-01-01T00:00:00Z"),
      },
    });
    await actuarComoRol("COORDINACION");
    const r = await llamar(crearFranja, {
      body: {
        profesionalId: prof.id, diaSemana: "LUNES", horaInicio: "11:00", horaFin: "13:00",
        especialidadId: esp.id, salaId: sala.id, vigenciaDesde: "2026-06-01",
      },
    });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe("FRANJA_SOLAPADA");
    expect(r.body.details.franjaId).toBe(f1.id);
  });

  it("EC-9: vigenciaHasta anterior a vigenciaDesde -> 400 VALIDACION", async () => {
    await actuarComoRol("COORDINACION");
    const r = await llamar(crearFranja, {
      body: {
        profesionalId: "x", diaSemana: "LUNES", horaInicio: "08:00", horaFin: "12:00",
        especialidadId: "x", salaId: "x", vigenciaDesde: "2026-06-01", vigenciaHasta: "2026-01-01",
      },
    });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("VALIDACION");
  });

  it("EC-10: Franja que cruza la medianoche -> 400 VALIDACION", async () => {
    await actuarComoRol("COORDINACION");
    const r = await llamar(crearFranja, {
      body: {
        profesionalId: "x", diaSemana: "LUNES", horaInicio: "22:00", horaFin: "02:00",
        especialidadId: "x", salaId: "x", vigenciaDesde: hoyEnAR(),
      },
    });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("VALIDACION");
  });

  it("EC-6: Borrar una franja elimina sus slots DISPONIBLE", async () => {
    const { esp, prof, sala } = await agendaBase(60);
    const lunes = proximoDia("LUNES");
    const franja = await db.franjaAgenda.create({
      data: {
        profesionalId: prof.id, diaSemana: "LUNES", horaInicio: "08:00", horaFin: "10:00",
        especialidadId: esp.id, salaId: sala.id, vigenciaDesde: new Date(`${hoyEnAR()}T00:00:00Z`),
      },
    });
    await actuarComoRol("COORDINACION");
    await llamar(generarSlotsHTTP, { body: { profesionalId: prof.id } });
    expect(await db.slot.count({ where: { profesionalId: prof.id } })).toBeGreaterThan(0);
    void lunes;
    await llamar(borrarFranja, { params: { id: franja.id } });
    expect(await db.slot.count({ where: { profesionalId: prof.id, estado: "DISPONIBLE" } })).toBe(0);
  });
});

// ───────────────────────── Excepciones ─────────────────────────

describe("Excepciones de agenda", () => {
  async function agendaConSlots() {
    const { esp, prof, sala } = await agendaBase(60);
    await db.franjaAgenda.create({
      data: {
        profesionalId: prof.id, diaSemana: "LUNES", horaInicio: "08:00", horaFin: "12:00",
        especialidadId: esp.id, salaId: sala.id, vigenciaDesde: new Date(`${hoyEnAR()}T00:00:00Z`),
      },
    });
    await actuarComoRol("COORDINACION");
    await llamar(generarSlotsHTTP, { body: { profesionalId: prof.id } });
    return { esp, prof, sala, lunes: proximoDia("LUNES") };
  }

  it("AC-29: Bloqueo elimina slots DISPONIBLE y conserva los ocupados como huérfanos [FR-28, FR-32, FR-39]", async () => {
    const { prof, lunes } = await agendaConSlots();
    const slots = await db.slot.findMany({ where: { profesionalId: prof.id, fecha: new Date(`${lunes}T00:00:00Z`) } });
    expect(slots.length).toBeGreaterThan(0);
    // Marcar uno como ocupado (BLOQUEADO) para verificar que se conserva huérfano.
    await db.slot.update({ where: { id: slots[0].id }, data: { estado: "BLOQUEADO" } });

    const r = await llamar(crearExcepcion, {
      body: { profesionalId: prof.id, fecha: lunes, tipo: "BLOQUEO", motivo: "Licencia" },
    });
    expect(r.status).toBe(201);

    const restantes = await db.slot.findMany({ where: { profesionalId: prof.id, fecha: new Date(`${lunes}T00:00:00Z`) } });
    expect(restantes.every((s) => s.estado !== "DISPONIBLE")).toBe(true);
    expect(restantes.find((s) => s.id === slots[0].id)?.huerfano).toBe(true);
  });

  it("AC-30: Excepción de apertura genera slots [FR-30, FR-34]", async () => {
    const { esp, prof, sala } = await agendaBase(60);
    const sabado = proximoDia("SABADO");
    await actuarComoRol("COORDINACION");
    const r = await llamar(crearExcepcion, {
      body: {
        profesionalId: prof.id, fecha: sabado, tipo: "APERTURA",
        horaInicio: "09:00", horaFin: "12:00", especialidadId: esp.id, salaId: sala.id, motivo: "Extra",
      },
    });
    expect(r.status).toBe(201);
    const slots = await db.slot.findMany({ where: { profesionalId: prof.id, fecha: new Date(`${sabado}T00:00:00Z`) } });
    expect(slots.length).toBe(3);
    expect(slots.every((s) => s.origen === "APERTURA")).toBe(true);
  });

  it("AC-31: Apertura solapada con franja vigente [FR-31]", async () => {
    const { esp, prof, sala } = await agendaBase(60);
    const lunes = proximoDia("LUNES");
    await db.franjaAgenda.create({
      data: {
        profesionalId: prof.id, diaSemana: "LUNES", horaInicio: "08:00", horaFin: "12:00",
        especialidadId: esp.id, salaId: sala.id, vigenciaDesde: new Date(`${hoyEnAR()}T00:00:00Z`),
      },
    });
    await actuarComoRol("COORDINACION");
    const r = await llamar(crearExcepcion, {
      body: {
        profesionalId: prof.id, fecha: lunes, tipo: "APERTURA",
        horaInicio: "10:00", horaFin: "13:00", especialidadId: esp.id, salaId: sala.id, motivo: "x",
      },
    });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe("APERTURA_SOLAPADA");
  });

  it("EC-7: Apertura con duración no múltiplo -> 400 VALIDACION", async () => {
    const { esp, prof, sala } = await agendaBase(20);
    const sabado = proximoDia("SABADO");
    await actuarComoRol("COORDINACION");
    const r = await llamar(crearExcepcion, {
      body: {
        profesionalId: prof.id, fecha: sabado, tipo: "APERTURA",
        horaInicio: "09:00", horaFin: "09:30", especialidadId: esp.id, salaId: sala.id, motivo: "x",
      },
    });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("VALIDACION");
  });

  it("EC-8: Bloqueo en fecha sin franja -> 201 sin efecto", async () => {
    const { prof } = await agendaBase();
    const sabado = proximoDia("SABADO");
    await actuarComoRol("COORDINACION");
    const r = await llamar(crearExcepcion, {
      body: { profesionalId: prof.id, fecha: sabado, tipo: "BLOQUEO", motivo: "x" },
    });
    expect(r.status).toBe(201);
    expect(await db.slot.count({ where: { profesionalId: prof.id } })).toBe(0);
  });
});

// ───────────────────────── Generación de slots ─────────────────────────

describe("Generación de slots", () => {
  async function conFranja(dia: string, horaInicio: string, horaFin: string, dur: number) {
    const { esp, prof, sala } = await agendaBase(dur);
    await db.franjaAgenda.create({
      data: {
        profesionalId: prof.id, diaSemana: dia as never, horaInicio, horaFin,
        especialidadId: esp.id, salaId: sala.id, vigenciaDesde: new Date("2026-01-01T00:00:00Z"),
      },
    });
    return { esp, prof, sala };
  }

  it("AC-32: Generación de slots desde una franja [FR-33..FR-36]", async () => {
    const { prof } = await conFranja("LUNES", "08:00", "09:00", 15);
    await actuarComoRol("COORDINACION");
    await llamar(generarSlotsHTTP, { body: { profesionalId: prof.id } });

    const lunes = proximoDia("LUNES");
    const slots = await db.slot.findMany({
      where: { profesionalId: prof.id, fecha: new Date(`${lunes}T00:00:00Z`) },
      orderBy: { horaInicio: "asc" },
    });
    expect(slots.map((s) => s.horaInicio)).toEqual(["08:00", "08:15", "08:30", "08:45"]);
    expect(slots.every((s) => s.estado === "DISPONIBLE" && s.origen === "FRANJA")).toBe(true);
  });

  it("AC-33: Resto final menor a la duración se descarta [FR-35]", async () => {
    const { prof } = await conFranja("MARTES", "08:00", "08:50", 20);
    await actuarComoRol("COORDINACION");
    await llamar(generarSlotsHTTP, { body: { profesionalId: prof.id } });
    const martes = proximoDia("MARTES");
    const slots = await db.slot.findMany({ where: { profesionalId: prof.id, fecha: new Date(`${martes}T00:00:00Z`) } });
    expect(slots.map((s) => s.horaInicio).sort()).toEqual(["08:00", "08:20"]);
  });

  it("AC-34: Generación idempotente [FR-38]", async () => {
    const { prof } = await conFranja("LUNES", "08:00", "09:00", 15);
    await actuarComoRol("COORDINACION");
    await llamar(generarSlotsHTTP, { body: { profesionalId: prof.id } });
    const antes = await db.slot.findMany({ where: { profesionalId: prof.id }, orderBy: { inicioUtc: "asc" } });
    const r = await llamar(generarSlotsHTTP, { body: { profesionalId: prof.id } });
    expect(r.body.creados).toBe(0);
    expect(r.body.eliminados).toBe(0);
    const despues = await db.slot.findMany({ where: { profesionalId: prof.id }, orderBy: { inicioUtc: "asc" } });
    expect(despues.map((s) => s.id)).toEqual(antes.map((s) => s.id));
  });

  it("AC-35: Unicidad de slot [FR-37]", async () => {
    const { esp, prof, sala } = await conFranja("LUNES", "08:00", "09:00", 15);
    const lunes = proximoDia("LUNES");
    await db.slot.create({
      data: {
        profesionalId: prof.id, especialidadId: esp.id, salaId: sala.id,
        fecha: new Date(`${lunes}T00:00:00Z`), horaInicio: "08:00", horaFin: "08:15",
        inicioUtc: new Date(`${lunes}T11:00:00Z`), finUtc: new Date(`${lunes}T11:15:00Z`),
        estado: "DISPONIBLE", origen: "FRANJA", origenId: "seed",
      },
    });
    await actuarComoRol("COORDINACION");
    const r = await llamar(generarSlotsHTTP, { body: { profesionalId: prof.id } });
    expect(r.status).toBe(200);
    const dupes = await db.slot.count({
      where: { profesionalId: prof.id, fecha: new Date(`${lunes}T00:00:00Z`), horaInicio: "08:00" },
    });
    expect(dupes).toBe(1);

    await expect(
      db.slot.create({
        data: {
          profesionalId: prof.id, especialidadId: esp.id, salaId: sala.id,
          fecha: new Date(`${lunes}T00:00:00Z`), horaInicio: "08:00", horaFin: "08:15",
          inicioUtc: new Date(`${lunes}T11:00:00Z`), finUtc: new Date(`${lunes}T11:15:00Z`),
          estado: "DISPONIBLE", origen: "FRANJA", origenId: "otro",
        },
      }),
    ).rejects.toThrow();
  });

  it("AC-36: No se generan slots en el pasado ni para inactivos [FR-41]", async () => {
    const { prof: p1 } = await conFranja("LUNES", "08:00", "09:00", 15);
    await db.profesional.update({ where: { id: p1.id }, data: { activo: false } });
    const { prof: p2 } = await conFranja("LUNES", "08:00", "09:00", 15);

    await actuarComoRol("COORDINACION");
    await llamar(generarSlotsHTTP, {});

    expect(await db.slot.count({ where: { profesionalId: p1.id } })).toBe(0);
    expect(await db.slot.count({ where: { profesionalId: p2.id } })).toBeGreaterThan(0);
    const hoy = new Date(`${hoyEnAR()}T00:00:00Z`);
    expect(await db.slot.count({ where: { fecha: { lt: hoy } } })).toBe(0);
  });

  it("AC-37: Generación manual devuelve resumen y queda registrada [FR-40, FR-42]", async () => {
    const { prof } = await conFranja("LUNES", "08:00", "09:00", 15);
    const actor = await actuarComoRol("COORDINACION");
    const r = await llamar(generarSlotsHTTP, { body: { profesionalId: prof.id } });
    expect(r.body).toMatchObject({ profesionales: 1 });
    expect(r.body.creados).toBeGreaterThan(0);
    expect(r.body.corridaId).toBeTypeOf("string");

    const corrida = await db.corridaGeneracion.findUnique({ where: { id: r.body.corridaId } });
    expect(corrida?.disparador).toBe("MANUAL");
    expect(corrida?.actorId).toBe(actor.id);
  });

  it("AC-43: Transaccionalidad de la generación por profesional [NFR-R1]", async () => {
    await conFranja("LUNES", "08:00", "09:00", 15);
    await conFranja("MARTES", "08:00", "09:00", 15);

    // La primera transacción (primer profesional) falla; el resto delega al método real.
    fallarUnaVez(db, "$transaction", new Error("fallo simulado"));

    await actuarComoRol("COORDINACION");
    const r = await llamar(generarSlotsHTTP, {});
    expect(r.status).toBe(200);

    const conSlots = await db.profesional.findMany({ include: { _count: { select: { slots: true } } } });
    const conAlgo = conSlots.filter((p) => p._count.slots > 0);
    expect(conAlgo.length).toBe(1); // el que falló quedó sin slots parciales
  });

  it("AC-44: Cálculo de slots aislado y testeable [NFR-M2]", () => {
    const slots = calcularSlots({
      profesionalId: "P1",
      franjas: [
        {
          id: "F1", profesionalId: "P1", diaSemana: "LUNES", horaInicio: "08:00", horaFin: "09:00",
          especialidadId: "E1", salaId: "S1", vigenciaDesde: "2026-01-01", vigenciaHasta: null,
          activa: true, inconsistente: false,
        },
      ],
      excepciones: [],
      duracionPorEspecialidad: { E1: 15 },
      desde: "2026-09-07", // lunes
      hasta: "2026-09-07",
    });
    expect(slots.map((s) => s.horaInicio)).toEqual(["08:00", "08:15", "08:30", "08:45"]);
    expect(slots[0]).toMatchObject({ origen: "FRANJA", fecha: "2026-09-07", horaFin: "08:15" });
  });

  it("AC-45: Franjas y slots respetan la zona horaria [NFR-R4]", async () => {
    const { prof } = await conFranja("LUNES", "08:00", "09:00", 60);
    await actuarComoRol("COORDINACION");
    await llamar(generarSlotsHTTP, { body: { profesionalId: prof.id } });
    const lunes = proximoDia("LUNES");
    const slot = await db.slot.findFirst({
      where: { profesionalId: prof.id, fecha: new Date(`${lunes}T00:00:00Z`), horaInicio: "08:00" },
    });
    expect(slot?.inicioUtc.toISOString()).toBe(`${lunes}T11:00:00.000Z`);
  });

  it("EC-12: Reducir ventana_generacion_dias elimina slots fuera de la nueva ventana", async () => {
    const { prof } = await conFranja("LUNES", "08:00", "09:00", 60);
    await sembrarParametros();
    await actuarComoRol("COORDINACION");
    await llamar(generarSlotsHTTP, { body: { profesionalId: prof.id } });
    const total45 = await db.slot.count({ where: { profesionalId: prof.id } });

    await db.parametroSistema.update({ where: { clave: "ventana_generacion_dias" }, data: { valor: 10 } });
    await llamar(generarSlotsHTTP, { body: { profesionalId: prof.id } });
    const total10 = await db.slot.count({ where: { profesionalId: prof.id } });
    expect(total10).toBeLessThan(total45);
    const limite = new Date(`${sumarDias(hoyEnAR(), 10)}T00:00:00Z`);
    expect(await db.slot.count({ where: { profesionalId: prof.id, fecha: { gt: limite } } })).toBe(0);
  });

  it("EC-14: Corrida concurrente se saltea por el lock [NFR-R3]", async () => {
    await db.corridaGeneracion.create({
      data: { disparador: "JOB", estado: "OK", iniciadaAt: new Date(), finalizadaAt: null },
    });
    await actuarComoRol("COORDINACION");
    const r = await llamar(generarSlotsHTTP, {});
    const corrida = await db.corridaGeneracion.findUnique({ where: { id: r.body.corridaId } });
    expect(corrida?.estado).toBe("SALTADA");
  });

  it("EC-20: Generación sin franjas ni excepciones -> 200 creados 0", async () => {
    await actuarComoRol("COORDINACION");
    const r = await llamar(generarSlotsHTTP, {});
    expect(r.status).toBe(200);
    expect(r.body.creados).toBe(0);
  });

  it("GET /slots devuelve los slots generados con filtros [FR-36]", async () => {
    const { prof } = await conFranja("LUNES", "08:00", "09:00", 15);
    await actuarComoRol("COORDINACION");
    await llamar(generarSlotsHTTP, { body: { profesionalId: prof.id } });
    const r = await llamar(listarSlots, { query: { profesionalId: prof.id, estado: "DISPONIBLE" } });
    expect(r.status).toBe(200);
    expect(r.body.items.length).toBeGreaterThan(0);
    expect(r.body.items.every((s: { estado: string }) => s.estado === "DISPONIBLE")).toBe(true);
  });
});

// ───────────────────────── Parámetros ─────────────────────────

describe("Parámetros del sistema", () => {
  it("AC-38: Edición de parámetros del sistema [FR-43]", async () => {
    await sembrarParametros();
    await actuarComoRol("ADMIN");
    const r = await llamar(patchParametros, { body: { ventana_reserva_dias: 21 } });
    expect(r.status).toBe(200);
    expect(r.body.ventana_reserva_dias).toBe(21);
    const g = await llamar(getParametros, {});
    expect(g.body.ventana_reserva_dias).toBe(21);
  });

  it("AC-39: Parámetro fuera de rango [FR-43]", async () => {
    await actuarComoRol("ADMIN");
    const r = await llamar(patchParametros, { body: { antelacion_minima_horas: -1 } });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("VALIDACION");
  });
});

// ───────────────────────── Auditoría ─────────────────────────

describe("Auditoría", () => {
  it("AC-40: Auditoría de operaciones sensibles [FR-44, FR-45]", async () => {
    const { esp, prof, sala } = await agendaBase(60);
    const coord = await actuarComoRol("COORDINACION");
    const f = await llamar(crearFranja, {
      body: {
        profesionalId: prof.id, diaSemana: "MIERCOLES", horaInicio: "08:00", horaFin: "12:00",
        especialidadId: esp.id, salaId: sala.id, vigenciaDesde: hoyEnAR(),
      },
    });
    expect(f.status).toBe(201);

    await actuarComoRol("ADMIN");
    const r = await llamar(getAuditoria, { query: { entidad: "franja" } });
    const reg = r.body.items.find((a: { entidadId: string }) => a.entidadId === f.body.id);
    expect(reg).toBeDefined();
    expect(reg.accion).toBe("CREAR");
    expect(reg.entidad).toBe("franja");
    expect(reg.actorId).toBe(coord.id);
    expect(new Date(reg.timestamp).toISOString()).toBe(reg.timestamp);
  });

  it("AC-41: Registros de auditoría inmutables [FR-46, NFR-S7]", async () => {
    const p = await llamar(patchAuditoria, { params: { id: "A1" } });
    const d = await llamar(deleteAuditoria, { params: { id: "A1" } });
    expect(p.status).toBe(405);
    expect(d.status).toBe(405);
  });
});

// ───────────────────────── Usuarios: último admin ─────────────────────────

describe("Reglas de usuarios", () => {
  it("EC-16: No se puede desactivar el único ADMIN activo", async () => {
    const admin = await crearUsuarioDB({ rol: "ADMIN" });
    const otro = await crearUsuarioDB({ rol: "COORDINACION" });
    actuarComo({ usuarioId: otro.id, rol: "ADMIN" }); // actúa como admin pero NO es el target
    // Nota: para probar ULTIMO_ADMIN sin toparse con OPERACION_SOBRE_SI_MISMO,
    // el actor debe ser distinto del target y el sistema debe quedar sin admins.
    const r = await llamar(editarUsuario, { body: { activo: false }, params: { id: admin.id } });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe("ULTIMO_ADMIN");
  });

  it("EC-15: Profesional vinculado a usuario que luego se desactiva sigue activo", async () => {
    const esp = await crearEspecialidadDB();
    const u = await crearUsuarioDB({ rol: "PROFESIONAL", email: "prof-vinc@hospital.test" });
    const prof = await crearProfesionalDB([esp.id], { usuarioId: u.id });
    await actuarComoRol("ADMIN");
    await llamar(editarUsuario, { body: { activo: false }, params: { id: u.id } });
    const p = await db.profesional.findUnique({ where: { id: prof.id } });
    expect(p?.activo).toBe(true);
    expect(p?.usuarioId).toBe(u.id);
  });
});

// ───────────────────────── Seed ─────────────────────────

describe("Datos semilla", () => {
  it("AC-42: Seed idempotente y guard de producción [FR-47, FR-48]", { timeout: 180_000 }, async () => {
    const { sembrar, assertNoProd } = await import("../prisma/seed");

    const c1 = await sembrar();
    expect(c1.usuarios).toBe(4);
    expect(c1.especialidades).toBeGreaterThanOrEqual(8);
    expect(c1.salas).toBeGreaterThanOrEqual(6);
    expect(c1.obrasSociales).toBeGreaterThanOrEqual(8);

    const c2 = await sembrar();
    expect(c2).toEqual(c1); // sin duplicados

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SEED_ALLOW_PROD", "");
    expect(() => assertNoProd()).toThrow();
    vi.unstubAllEnvs();
  });
});
