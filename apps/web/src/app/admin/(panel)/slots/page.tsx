import { exigirAccesoSeccion } from "@/lib/session/guard-pagina";
import { PageHeader } from "@/components/ui/PageHeader";
import { SlotsPanel } from "@/components/admin/secciones/SlotsPanel";

export default async function SlotsPage() {
  const { puedeEditar } = await exigirAccesoSeccion("slots");
  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        titulo="Slots generados"
        descripcion="Turnos disponibles calculados a partir de las franjas y excepciones. Sobre ellos operan las fases siguientes."
      />
      <SlotsPanel puedeEditar={puedeEditar} />
    </div>
  );
}
