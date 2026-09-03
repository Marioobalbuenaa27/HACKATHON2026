import { exigirAccesoSeccion } from "@/lib/session/guard-pagina";
import { PageHeader } from "@/components/ui/PageHeader";
import { CategoriasTabla } from "@/components/admin/secciones/CategoriasTabla";

export default async function CategoriasPage() {
  const { puedeEditar } = await exigirAccesoSeccion("categorias");
  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        titulo="Categorías de problema"
        descripcion="Motivos de consulta en lenguaje común y a qué especialidad resuelven."
      />
      <CategoriasTabla puedeEditar={puedeEditar} />
    </div>
  );
}
