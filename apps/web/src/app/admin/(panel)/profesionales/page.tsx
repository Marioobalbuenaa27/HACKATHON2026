import { exigirAccesoSeccion } from "@/lib/session/guard-pagina";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProfesionalesTabla } from "@/components/admin/secciones/ProfesionalesTabla";

export default async function ProfesionalesPage() {
  const { puedeEditar } = await exigirAccesoSeccion("profesionales");
  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        titulo="Profesionales"
        descripcion="Personal que atiende turnos, sus especialidades y su acceso al panel."
      />
      <ProfesionalesTabla puedeEditar={puedeEditar} />
    </div>
  );
}
