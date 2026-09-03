import { exigirAccesoSeccion } from "@/lib/session/guard-pagina";
import { PageHeader } from "@/components/ui/PageHeader";
import { ParametrosForm } from "@/components/admin/secciones/ParametrosForm";

export default async function ParametrosPage() {
  const { puedeEditar } = await exigirAccesoSeccion("parametros");
  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        titulo="Parámetros del sistema"
        descripcion="Ventanas de reserva y generación, antelación mínima, reserva temporal y retención de datos."
      />
      <ParametrosForm puedeEditar={puedeEditar} />
    </div>
  );
}
