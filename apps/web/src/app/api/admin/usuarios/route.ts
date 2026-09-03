// /api/admin/usuarios — FR-5, FR-8, FR-9, FR-12. Sólo ADMIN.

import { esUniqueViolation, jsonError, jsonOk, leerJson, rutaAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { esGuardaFallida, exigirRoles } from "@/lib/sesion";
import { paginado } from "@/lib/catalogo";
import { parseBool } from "@/lib/api";
import { crearUsuarioSchema } from "@/lib/validaciones";
import { generarPasswordTemporal, hashPassword } from "@/lib/password";
import { registrarAuditoria } from "@/lib/auditoria";

const vista = (u: {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
  profesional?: { id: string } | null;
}) => ({
  id: u.id,
  nombre: u.nombre,
  email: u.email,
  rol: u.rol,
  activo: u.activo,
  profesionalId: u.profesional?.id ?? null,
});

export const GET = rutaAdmin(async (req) => {
  const g = await exigirRoles("ADMIN");
  if (esGuardaFallida(g)) return g.response;

  const sp = new URL(req.url).searchParams;
  const where = parseBool(sp.get("incluirInactivos")) ? {} : { activo: true };
  const data = await paginado(
    () => db.usuario.count({ where }),
    (skip, take) =>
      db.usuario.findMany({
        where,
        orderBy: { nombre: "asc" },
        skip,
        take,
        include: { profesional: { select: { id: true } } },
      }),
    sp,
  );
  return jsonOk({ ...data, items: data.items.map(vista) });
});

export const POST = rutaAdmin(async (req) => {
  const g = await exigirRoles("ADMIN");
  if (esGuardaFallida(g)) return g.response;

  const parsed = await leerJson(req, crearUsuarioSchema);
  if (!parsed.ok) return parsed.response;
  const { nombre, email, rol } = parsed.data;

  const existe = await db.usuario.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (existe) return jsonError(409, "EMAIL_DUPLICADO", "Ya existe un usuario con ese email.");

  const passwordTemporal = generarPasswordTemporal();
  const passwordHash = await hashPassword(passwordTemporal);

  try {
    const creado = await db.$transaction(async (tx) => {
      const u = await tx.usuario.create({
        data: { nombre, email: email.toLowerCase(), rol, passwordHash, passwordActualizadaAt: new Date() },
      });
      await registrarAuditoria(tx, {
        actorId: g.actor.usuarioId,
        accion: "CREAR",
        entidad: "usuario",
        entidadId: u.id,
        despues: { nombre: u.nombre, email: u.email, rol: u.rol, activo: u.activo },
      });
      return u;
    });
    return jsonOk(
      { id: creado.id, nombre: creado.nombre, email: creado.email, rol: creado.rol, activo: true, passwordTemporal },
      201,
    );
  } catch (e) {
    if (esUniqueViolation(e)) return jsonError(409, "EMAIL_DUPLICADO", "Ya existe un usuario con ese email.");
    throw e;
  }
});
