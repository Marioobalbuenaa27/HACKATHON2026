"use client";

import { useState } from "react";
import { CrudTabla, type RenderFormArgs } from "@/components/admin/CrudTabla";
import { FormDialog } from "@/components/admin/FormDialog";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/http/cliente";
import { useSubmit } from "@/lib/http/hooks";
import { useToast } from "@/components/ui/Toast";
import {
  ETIQUETA_ROL,
  ROLES,
  type CrearUsuarioResponse,
  type ResetPasswordResponse,
  type Rol,
  type UsuarioListItem,
} from "@/lib/http/tipos";

const BASE = "/api/admin/usuarios";

function PasswordDialog({
  password,
  nombre,
  onClose,
}: {
  password: string;
  nombre: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(password);
      toast.exito("Contraseña copiada.");
    } catch {
      toast.error("No se pudo copiar. Copiala manualmente.");
    }
  };
  return (
    <Dialog
      abierto
      onClose={onClose}
      titulo="Contraseña temporal"
      descripcion={`Entregásela a ${nombre}. No se vuelve a mostrar.`}
      ancho="sm"
      acciones={<Button onClick={onClose}>Entendido</Button>}
    >
      <div className="flex items-center justify-between gap-space-sm rounded-lg bg-surface-container-low p-space-sm">
        <code className="text-body-lg tracking-wide text-on-surface">{password}</code>
        <Button variante="tonal" icono="content_copy" onClick={copiar}>
          Copiar
        </Button>
      </div>
    </Dialog>
  );
}

function UsuarioForm({
  fila,
  onClose,
  actorId,
  onPasswordGenerada,
}: RenderFormArgs<UsuarioListItem> & {
  actorId: string;
  onPasswordGenerada: (p: { password: string; nombre: string }) => void;
}) {
  const esEdicion = !!fila;
  const esYoMismo = fila?.id === actorId;
  const [nombre, setNombre] = useState(fila?.nombre ?? "");
  const [email, setEmail] = useState(fila?.email ?? "");
  const [rol, setRol] = useState<Rol>(fila?.rol ?? "RECEPCION");
  const [activo, setActivo] = useState(fila?.activo ?? true);

  const submit = useSubmit(
    async () => {
      if (esEdicion) {
        return api.patch(`${BASE}/${fila!.id}`, { nombre, rol, activo });
      }
      const creado = await api.post<CrearUsuarioResponse>(BASE, { nombre, email, rol });
      onPasswordGenerada({ password: creado.passwordTemporal, nombre: creado.nombre });
      return creado;
    },
    { invalida: [BASE], exito: esEdicion ? "Usuario actualizado." : "Usuario creado." },
  );

  const errorEmail =
    submit.campo("email") ??
    (submit.error?.code === "EMAIL_DUPLICADO" ? submit.error.message : undefined);

  return (
    <FormDialog
      abierto
      onClose={onClose}
      titulo={esEdicion ? "Editar usuario" : "Nuevo usuario"}
      onSubmit={submit.run}
      cargando={submit.cargando}
      ancho="sm"
    >
      <TextField
        label="Nombre"
        requerido
        autoFocus
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        error={submit.campo("nombre")}
        maxLength={120}
      />
      <TextField
        label="Correo electrónico"
        requerido
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errorEmail}
        disabled={esEdicion}
        hint={esEdicion ? "El correo no se puede cambiar." : undefined}
      />
      <Select
        label="Rol"
        opciones={ROLES.map((r) => ({ value: r, label: ETIQUETA_ROL[r] }))}
        value={rol}
        onChange={(e) => setRol(e.target.value as Rol)}
        error={submit.campo("rol")}
        disabled={esYoMismo}
        hint={esYoMismo ? "No podés cambiar tu propio rol." : undefined}
      />
      {esEdicion && (
        <Switch
          label="Cuenta activa"
          hint={
            esYoMismo
              ? "No podés desactivar tu propia cuenta."
              : "Al desactivarla se cierra su sesión y no puede volver a entrar."
          }
          checked={activo}
          onChange={setActivo}
          disabled={esYoMismo}
        />
      )}
    </FormDialog>
  );
}

export function UsuariosTabla({ actorId }: { actorId: string }) {
  const toast = useToast();
  const [pwd, setPwd] = useState<{ password: string; nombre: string } | null>(null);
  const [resetPara, setResetPara] = useState<UsuarioListItem | null>(null);
  const [reseteando, setReseteando] = useState(false);

  const resetear = async (u: UsuarioListItem) => {
    setReseteando(true);
    try {
      const r = await api.post<ResetPasswordResponse>(`${BASE}/${u.id}/reset-password`);
      setResetPara(null);
      setPwd({ password: r.passwordTemporal, nombre: u.nombre });
    } catch {
      toast.error("No se pudo restablecer la contraseña.");
    } finally {
      setReseteando(false);
    }
  };

  return (
    <>
      <CrudTabla<UsuarioListItem>
        basePath={BASE}
        campoActivo="activo"
        paramInactivas="incluirInactivos"
        puedeEditar
        sinToggleActivo
        entidadSingular="usuario"
        entidadFemenina={false}
        nombreDe={(f) => f.nombre}
        columnas={[
          {
            clave: "nombre",
            encabezado: "Usuario",
            celda: (f) => (
              <span className="flex flex-col">
                <span className="text-on-surface">{f.nombre}</span>
                <span className="text-body-sm text-on-surface-variant">{f.email}</span>
              </span>
            ),
          },
          { clave: "rol", encabezado: "Rol", celda: (f) => ETIQUETA_ROL[f.rol] },
          {
            clave: "vinculo",
            encabezado: "Profesional",
            celda: (f) =>
              f.profesionalId ? (
                <Badge tono="info" icono="link">
                  Vinculado
                </Badge>
              ) : (
                "—"
              ),
          },
        ]}
        accionesExtra={(f) => (
          <Button
            variante="text"
            icono="key"
            className="px-space-xs"
            onClick={() => setResetPara(f)}
          >
            Contraseña
          </Button>
        )}
        renderForm={(args) => (
          <UsuarioForm {...args} actorId={actorId} onPasswordGenerada={setPwd} />
        )}
      />

      {resetPara && (
        <Dialog
          abierto
          onClose={() => setResetPara(null)}
          titulo="Restablecer contraseña"
          ancho="sm"
          acciones={
            <>
              <Button variante="text" onClick={() => setResetPara(null)} disabled={reseteando}>
                Cancelar
              </Button>
              <Button
                variante="danger"
                cargando={reseteando}
                onClick={() => resetear(resetPara)}
              >
                Restablecer
              </Button>
            </>
          }
        >
          <p className="text-body-md text-on-surface-variant">
            Se generará una contraseña temporal nueva para <strong>{resetPara.nombre}</strong> y
            se cerrará su sesión actual.
          </p>
        </Dialog>
      )}

      {pwd && (
        <PasswordDialog password={pwd.password} nombre={pwd.nombre} onClose={() => setPwd(null)} />
      )}
    </>
  );
}
