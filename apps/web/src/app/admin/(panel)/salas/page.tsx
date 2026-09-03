import { exigirAccesoSeccion } from "@/lib/session/guard-pagina";
import { PageHeader } from "@/components/ui/PageHeader";
import { SalasTabla } from "@/components/admin/secciones/SalasTabla";

export default async function SalasPage() {
  const { puedeEditar } = await exigirAccesoSeccion("salas");
  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        titulo="Salas / consultorios"
        descripcion="Espacios físicos donde se atienden los turnos. Son informativos, sin reserva de recurso."
      />
      <SalasTabla puedeEditar={puedeEditar} />
    </div>
  );
}
