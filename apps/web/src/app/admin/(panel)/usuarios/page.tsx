import { exigirAccesoSeccion } from "@/lib/session/guard-pagina";
import { PageHeader } from "@/components/ui/PageHeader";
import { UsuariosTabla } from "@/components/admin/secciones/UsuariosTabla";

export default async function UsuariosPage() {
  const { actor } = await exigirAccesoSeccion("usuarios");
  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        titulo="Usuarios del panel"
        descripcion="Altas, roles y contraseñas del personal que accede al sistema."
      />
      <UsuariosTabla actorId={actor.usuarioId} />
    </div>
  );
}
