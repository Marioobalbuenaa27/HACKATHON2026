/**
 * Seed idempotente — catálogo ficticio realista para desarrollo.
 * Contrato: docs/specs/fase-1-nucleo-administrativo.md (FR-47, FR-48, AC-42).
 *
 * - Idempotente: se puede correr N veces sin duplicar ni fallar (usa upsert).
 * - Guard de producción: aborta si NODE_ENV=production y SEED_ALLOW_PROD !== "true".
 */
import { PrismaClient, Rol, PrioridadBase, DiaSemana } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { PARAMETROS_DEFAULT } from "../src/lib/parametros";

const db = new PrismaClient();

const DEV_PASSWORD = "turnero-dev-1234"; // >= 10 chars (NFR-S3); solo desarrollo

// --- Guard de producción (FR-48) ---
function assertNoProd() {
  if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PROD !== "true") {
    throw new Error(
      "Seed abortado: NODE_ENV=production. Definir SEED_ALLOW_PROD=true para forzar.",
    );
  }
}

const USUARIOS = [
  { nombre: "Admin TI", email: "admin@hospital.test", rol: Rol.ADMIN },
  { nombre: "Coordinación Agendas", email: "coordinacion@hospital.test", rol: Rol.COORDINACION },
  { nombre: "Recepción Admisión", email: "recepcion@hospital.test", rol: Rol.RECEPCION },
  { nombre: "Dra. Profesional Demo", email: "profesional@hospital.test", rol: Rol.PROFESIONAL },
];

const ESPECIALIDADES = [
  { nombre: "Pediatría general", duracionTurnoMin: 15 },
  { nombre: "Cardiología infantil", duracionTurnoMin: 30 },
  { nombre: "Neumonología infantil", duracionTurnoMin: 20 },
  { nombre: "Dermatología pediátrica", duracionTurnoMin: 15 },
  { nombre: "Gastroenterología infantil", duracionTurnoMin: 20 },
  { nombre: "Neurología infantil", duracionTurnoMin: 30 },
  { nombre: "Otorrinolaringología", duracionTurnoMin: 15 },
  { nombre: "Oftalmología infantil", duracionTurnoMin: 15 },
  { nombre: "Traumatología infantil", duracionTurnoMin: 20 },
  { nombre: "Endocrinología infantil", duracionTurnoMin: 30 },
  { nombre: "Salud mental infantil", duracionTurnoMin: 45 },
  { nombre: "Nutrición infantil", duracionTurnoMin: 30 },
];

const NOMBRES = ["María", "Juan", "Laura", "Diego", "Sofía", "Martín", "Carla", "Pablo", "Lucía", "Federico"];
const APELLIDOS = ["González", "Rodríguez", "Fernández", "López", "Martínez", "Pérez", "Gómez", "Díaz", "Romero", "Sosa"];

const SALAS = [
  { identificador: "Consultorio 1", ubicacion: "PB ala este" },
  { identificador: "Consultorio 2", ubicacion: "PB ala este" },
  { identificador: "Consultorio 3", ubicacion: "PB ala oeste" },
  { identificador: "Consultorio 4", ubicacion: "1º piso" },
  { identificador: "Consultorio 5", ubicacion: "1º piso" },
  { identificador: "Consultorio 6", ubicacion: "1º piso" },
  { identificador: "Consultorio 7", ubicacion: "2º piso" },
  { identificador: "Box de curaciones", ubicacion: "PB, junto a guardia" },
];

const OBRAS_SOCIALES = [
  "OSDE", "Swiss Medical", "Galeno", "IOMA", "PAMI", "OSDEPYM",
  "Unión Personal", "OSECAC", "Medifé", "Sancor Salud",
];

// 15-20 categorías; prioridadBase y derivarAGuardia según decisiones-mvp.
const CATEGORIAS: Array<{
  nombre: string;
  prioridadBase: PrioridadBase;
  derivarAGuardia: boolean;
  ayuda?: string;
  especialidades: string[];
}> = [
  { nombre: "Control de niño sano", prioridadBase: PrioridadBase.NORMAL, derivarAGuardia: false, especialidades: ["Pediatría general"] },
  { nombre: "Tos o mocos hace varios días", prioridadBase: PrioridadBase.NORMAL, derivarAGuardia: false, especialidades: ["Pediatría general", "Neumonología infantil"] },
  { nombre: "Fiebre de más de 3 días (sin dificultad para respirar)", prioridadBase: PrioridadBase.PRIORITARIO, derivarAGuardia: false, especialidades: ["Pediatría general"] },
  { nombre: "Dolor de oído", prioridadBase: PrioridadBase.NORMAL, derivarAGuardia: false, especialidades: ["Pediatría general", "Otorrinolaringología"] },
  { nombre: "Manchas o granos en la piel", prioridadBase: PrioridadBase.NORMAL, derivarAGuardia: false, especialidades: ["Dermatología pediátrica", "Pediatría general"] },
  { nombre: "Problemas para ver / control de anteojos", prioridadBase: PrioridadBase.NORMAL, derivarAGuardia: false, especialidades: ["Oftalmología infantil"] },
  { nombre: "Dolor de panza frecuente", prioridadBase: PrioridadBase.NORMAL, derivarAGuardia: false, especialidades: ["Gastroenterología infantil", "Pediatría general"] },
  { nombre: "No sube de peso / problemas de alimentación", prioridadBase: PrioridadBase.PRIORITARIO, derivarAGuardia: false, especialidades: ["Nutrición infantil", "Gastroenterología infantil"] },
  { nombre: "Soplo en el corazón / derivación de cardiología", prioridadBase: PrioridadBase.PRIORITARIO, derivarAGuardia: false, especialidades: ["Cardiología infantil"] },
  { nombre: "Dolores de cabeza repetidos", prioridadBase: PrioridadBase.NORMAL, derivarAGuardia: false, especialidades: ["Neurología infantil", "Pediatría general"] },
  { nombre: "Problemas de conducta / atención en la escuela", prioridadBase: PrioridadBase.NORMAL, derivarAGuardia: false, especialidades: ["Salud mental infantil"] },
  { nombre: "Control de crecimiento / talla baja", prioridadBase: PrioridadBase.NORMAL, derivarAGuardia: false, especialidades: ["Endocrinología infantil"] },
  { nombre: "Asma / broncoespasmo a repetición", prioridadBase: PrioridadBase.PRIORITARIO, derivarAGuardia: false, especialidades: ["Neumonología infantil"] },
  { nombre: "Ronca mucho / se agita al dormir", prioridadBase: PrioridadBase.NORMAL, derivarAGuardia: false, especialidades: ["Otorrinolaringología", "Neumonología infantil"] },
  { nombre: "Derivación por especialista (traigo orden)", prioridadBase: PrioridadBase.PREFERENCIAL, derivarAGuardia: false, especialidades: ["Pediatría general"] },
  { nombre: "Certificado de salud para escuela o club", prioridadBase: PrioridadBase.NORMAL, derivarAGuardia: false, especialidades: ["Pediatría general"] },
  // derivarAGuardia = true (>= 2, sin especialidades — FR-18)
  { nombre: "Dificultad para respirar / se pone morado", prioridadBase: PrioridadBase.NORMAL, derivarAGuardia: true, especialidades: [] },
  { nombre: "Golpe fuerte en la cabeza / caída de altura", prioridadBase: PrioridadBase.NORMAL, derivarAGuardia: true, especialidades: [] },
  { nombre: "Quemadura", prioridadBase: PrioridadBase.NORMAL, derivarAGuardia: true, especialidades: [] },
  { nombre: "Convulsión / pérdida de conocimiento", prioridadBase: PrioridadBase.NORMAL, derivarAGuardia: true, especialidades: [] },
];

export { assertNoProd };

export async function sembrar() {
  assertNoProd();
  const passwordHash = await hash(DEV_PASSWORD);

  // --- Parámetros del sistema (FR-43) ---
  for (const [clave, valor] of Object.entries(PARAMETROS_DEFAULT)) {
    await db.parametroSistema.upsert({
      where: { clave },
      update: {}, // no pisar valores ya ajustados por un admin
      create: { clave, valor },
    });
  }

  // --- Usuarios (FR-47: uno por rol) ---
  for (const u of USUARIOS) {
    await db.usuario.upsert({
      where: { email: u.email },
      update: { nombre: u.nombre, rol: u.rol },
      create: { ...u, passwordHash },
    });
  }

  // --- Especialidades ---
  const espByNombre = new Map<string, string>();
  for (const e of ESPECIALIDADES) {
    const row = await db.especialidad.upsert({
      where: { nombre: e.nombre },
      update: { duracionTurnoMin: e.duracionTurnoMin },
      create: e,
    });
    espByNombre.set(e.nombre, row.id);
  }

  // --- Salas ---
  for (const s of SALAS) {
    await db.sala.upsert({
      where: { identificador: s.identificador },
      update: { ubicacion: s.ubicacion },
      create: s,
    });
  }
  const salas = await db.sala.findMany({ orderBy: { identificador: "asc" } });

  // --- Obras sociales ---
  for (const nombre of OBRAS_SOCIALES) {
    await db.obraSocial.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }

  // --- Categorías + mapeo categoría → especialidad ---
  let orden = 0;
  for (const c of CATEGORIAS) {
    const cat = await db.categoriaProblema.upsert({
      where: { nombre: c.nombre },
      update: { prioridadBase: c.prioridadBase, derivarAGuardia: c.derivarAGuardia, orden },
      create: {
        nombre: c.nombre,
        prioridadBase: c.prioridadBase,
        derivarAGuardia: c.derivarAGuardia,
        ayuda: c.ayuda ?? null,
        orden,
      },
    });
    orden += 1;

    if (!c.derivarAGuardia && c.especialidades.length > 0) {
      await db.categoriaEspecialidad.createMany({
        data: c.especialidades
          .map((n) => espByNombre.get(n))
          .filter((id): id is string => Boolean(id))
          .map((especialidadId) => ({ categoriaId: cat.id, especialidadId })),
        skipDuplicates: true,
      });
    }
  }

  // --- Profesionales: 2-3 por especialidad ---
  let matriculaSeq = 100000;
  const profesionalesCreados: Array<{ id: string; especialidadId: string }> = [];
  for (const [nombreEsp, especialidadId] of espByNombre) {
    const cantidad = 2 + (matriculaSeq % 2); // 2 o 3
    for (let i = 0; i < cantidad; i++) {
      matriculaSeq += 1;
      const matricula = `MP-${matriculaSeq}`;
      const nombre = NOMBRES[matriculaSeq % NOMBRES.length];
      const apellido = APELLIDOS[(matriculaSeq * 7) % APELLIDOS.length];
      const prof = await db.profesional.upsert({
        where: { matricula },
        update: { nombre, apellido },
        create: { nombre, apellido, matricula },
      });
      await db.profesionalEspecialidad.createMany({
        data: [{ profesionalId: prof.id, especialidadId }],
        skipDuplicates: true,
      });
      profesionalesCreados.push({ id: prof.id, especialidadId });
    }
    void nombreEsp;
  }

  // Vincular el usuario PROFESIONAL demo al primer profesional de Pediatría general
  const usuarioProf = await db.usuario.findUnique({ where: { email: "profesional@hospital.test" } });
  const pediatriaId = espByNombre.get("Pediatría general")!;
  const primerPediatra = profesionalesCreados.find((p) => p.especialidadId === pediatriaId);
  if (usuarioProf && primerPediatra) {
    const yaVinculado = await db.profesional.findFirst({ where: { usuarioId: usuarioProf.id } });
    if (!yaVinculado) {
      await db.profesional.update({
        where: { id: primerPediatra.id },
        data: { usuarioId: usuarioProf.id },
      });
    }
  }

  // --- Franjas de agenda para >= la mitad de los profesionales (FR-47) ---
  const dias: DiaSemana[] = [DiaSemana.LUNES, DiaSemana.MARTES, DiaSemana.MIERCOLES, DiaSemana.JUEVES, DiaSemana.VIERNES];
  const vigenciaDesde = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  const mitad = Math.ceil(profesionalesCreados.length / 2);
  for (let i = 0; i < mitad; i++) {
    const prof = profesionalesCreados[i];
    const sala = salas[i % salas.length];
    const dia = dias[i % dias.length];
    const yaTiene = await db.franjaAgenda.findFirst({
      where: { profesionalId: prof.id, diaSemana: dia },
    });
    if (!yaTiene) {
      await db.franjaAgenda.create({
        data: {
          profesionalId: prof.id,
          diaSemana: dia,
          horaInicio: "08:00",
          horaFin: "12:00",
          especialidadId: prof.especialidadId,
          salaId: sala.id,
          vigenciaDesde,
        },
      });
    }
  }

  const counts = {
    usuarios: await db.usuario.count(),
    especialidades: await db.especialidad.count(),
    profesionales: await db.profesional.count(),
    categorias: await db.categoriaProblema.count(),
    mapeos: await db.categoriaEspecialidad.count(),
    salas: await db.sala.count(),
    obrasSociales: await db.obraSocial.count(),
    franjas: await db.franjaAgenda.count(),
  };
  console.log("Seed completo:", counts);
  return counts;
}

// Auto-ejecución sólo cuando se corre como script (`tsx prisma/seed.ts`),
// no cuando se importa desde un test.
const esScript = process.argv[1] && /seed\.(ts|js|mjs)$/.test(process.argv[1]);
if (esScript) {
  sembrar()
    .then(() => db.$disconnect())
    .catch(async (e) => {
      console.error(e);
      await db.$disconnect();
      process.exit(1);
    });
}
