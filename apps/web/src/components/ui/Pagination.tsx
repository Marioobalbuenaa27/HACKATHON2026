import { Button } from "./Button";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onPage }: PaginationProps) {
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;

  const desde = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const hasta = Math.min(page * pageSize, total);

  return (
    <nav
      className="flex items-center justify-between gap-space-sm py-space-xs"
      aria-label="Paginación"
    >
      <p className="text-body-sm text-on-surface-variant">
        {desde}–{hasta} de {total}
      </p>
      <div className="flex items-center gap-space-xs">
        <Button
          variante="outline"
          icono="chevron_left"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Anterior
        </Button>
        <span className="text-body-sm text-on-surface-variant">
          Página {page} de {totalPaginas}
        </span>
        <Button
          variante="outline"
          disabled={page >= totalPaginas}
          onClick={() => onPage(page + 1)}
        >
          Siguiente
          <span className="material-symbols-outlined text-[18px]" aria-hidden>
            chevron_right
          </span>
        </Button>
      </div>
    </nav>
  );
}
