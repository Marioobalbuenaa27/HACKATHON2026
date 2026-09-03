import { exigirAccesoSeccion } from "@/lib/session/guard-pagina";
import { PageHeader } from "@/components/ui/PageHeader";
import { FranjasTabla } from "@/components/admin/secciones/FranjasTabla";

export default async function FranjasPage() {
  const { puedeEditar } = await exigirAccesoSeccion("franjas");
  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        titulo="Franjas de agenda"
        descripcion="Bloques semanales recurrentes en los que un profesional atiende. Definen los slots."
      />
      <FranjasTabla puedeEditar={puedeEditar} />
    </div>
  );
}
