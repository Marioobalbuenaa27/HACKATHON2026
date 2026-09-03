import { exigirAccesoSeccion } from "@/lib/session/guard-pagina";
import { PageHeader } from "@/components/ui/PageHeader";
import { ObrasSocialesTabla } from "@/components/admin/secciones/ObrasSocialesTabla";

export default async function ObrasSocialesPage() {
  const { puedeEditar } = await exigirAccesoSeccion("obras-sociales");
  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        titulo="Obras sociales"
        descripcion="Coberturas aceptadas por el hospital."
      />
      <ObrasSocialesTabla puedeEditar={puedeEditar} />
    </div>
  );
}
