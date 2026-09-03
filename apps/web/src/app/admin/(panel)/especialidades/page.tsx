import { exigirAccesoSeccion } from "@/lib/session/guard-pagina";
import { PageHeader } from "@/components/ui/PageHeader";
import { EspecialidadesTabla } from "@/components/admin/secciones/EspecialidadesTabla";

export default async function EspecialidadesPage() {
  const { puedeEditar } = await exigirAccesoSeccion("especialidades");
  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        titulo="Especialidades"
        descripcion="Áreas de atención del hospital y la duración de sus turnos."
      />
      <EspecialidadesTabla puedeEditar={puedeEditar} />
    </div>
  );
}
