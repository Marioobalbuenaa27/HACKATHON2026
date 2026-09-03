// PATCH /api/admin/usuarios/:id — FR-8, FR-9, FR-10, FR-11, AC-8, AC-9, EC-16.

import { jsonError, jsonOk, leerJson, rutaAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { esGuardaFallida, exigirRoles } from "@/lib/sesion";
import { editarUsuarioSchema } from "@/lib/validaciones";
import { registrarAuditoria } from "@/lib/auditoria";
import type { AccionAuditada } from "@prisma/client";

export const PATCH = rutaAdmin(async (req, ctx) => {
  const g = await exigirRoles("ADMIN");
  if (esGuardaFallida(g)) return g.response;

  const { id } = await ctx.params;
  const parsed = await leerJson(req, editarUsuarioSchema);
  if (!parsed.ok) return parsed.response;
  const cambios = parsed.data;

  const actual = await db.usuario.findUnique({ where: { id } });
  if (!actual) return jsonError(404, "NO_ENCONTRADO", "Usuario inexistente.");

  const esSiMismo = id === g.actor.usuarioId;
  const seDesactiva = cambios.activo === false && actual.activo;
  const cambiaSuRol = cambios.rol !== undefined && cambios.rol !== actual.rol;

  // FR-10: un ADMIN no puede autodesactivarse ni cambiar su propio rol.
  if (esSiMismo && (seDesactiva || cambiaSuRol)) {
    return jsonError(409, "OPERACION_SOBRE_SI_MISMO", "No podés desactivar tu cuenta ni cambiar tu propio rol.");
  }

  // EC-16: no dejar el sistema sin ningún ADMIN activo.
  const pierdeAdmin = actual.rol === "ADMIN" && actual.activo && (seDesactiva || (cambiaSuRol && cambios.rol !== "ADMIN"));
  if (pierdeAdmin) {
    const otrosAdmins = await db.usuario.count({ where: { rol: "ADMIN", activo: true, id: { not: id } } });
    if (otrosAdmins === 0) {
      return jsonError(409, "ULTIMO_ADMIN", "No podés dejar el sistema sin un administrador activo.");
    }
  }

  const upd = await db.$transaction(async (tx) => {
    const u = await tx.usuario.update({ where: { id }, data: cambios });
    let accion: AccionAuditada = "EDITAR";
    if (seDesactiva) accion = "DESACTIVAR";
    else if (cambios.activo === true && !actual.activo) accion = "ACTIVAR";
    await registrarAuditoria(tx, {
      actorId: g.actor.usuarioId,
      accion,
      entidad: "usuario",
      entidadId: id,
      antes: { nombre: actual.nombre, rol: actual.rol, activo: actual.activo },
      despues: { nombre: u.nombre, rol: u.rol, activo: u.activo },
    });
    return u;
  });

  return jsonOk({ id: upd.id, nombre: upd.nombre, email: upd.email, rol: upd.rol, activo: upd.activo });
});
