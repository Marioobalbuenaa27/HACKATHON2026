import { exigirAccesoSeccion } from "@/lib/session/guard-pagina";
import { PageHeader } from "@/components/ui/PageHeader";
import { AuditoriaTabla } from "@/components/admin/secciones/AuditoriaTabla";

export default async function AuditoriaPage() {
  await exigirAccesoSeccion("auditoria");
  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        titulo="Auditoría"
        descripcion="Registro inmutable de las operaciones sobre usuarios, franjas, excepciones y parámetros."
      />
      <AuditoriaTabla />
    </div>
  );
}
