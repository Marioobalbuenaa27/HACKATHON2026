import { exigirAccesoSeccion } from "@/lib/session/guard-pagina";
import { PageHeader } from "@/components/ui/PageHeader";
import { ExcepcionesTabla } from "@/components/admin/secciones/ExcepcionesTabla";

export default async function ExcepcionesPage() {
  const { puedeEditar } = await exigirAccesoSeccion("excepciones");
  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        titulo="Excepciones de agenda"
        descripcion="Bloqueos (no atiende) y aperturas (atiende fuera de sus franjas) para fechas puntuales."
      />
      <ExcepcionesTabla puedeEditar={puedeEditar} />
    </div>
  );
}
