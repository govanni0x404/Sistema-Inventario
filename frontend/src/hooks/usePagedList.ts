import { useEffect, useMemo, useState } from "react";

const DEFAULT_PAGE_SIZE = 10;

export function usePagedList<T>(items: T[], pageSize = DEFAULT_PAGE_SIZE, resetKey?: unknown) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  // Un nuevo filtro/búsqueda siempre vuelve a la página 1.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setPage(1), [resetKey]);

  // Si igual la lista se queda corta (p. ej. tras borrar un registro), no te varés en una página vacía.
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  const pageItems = useMemo(() => items.slice((page - 1) * pageSize, page * pageSize), [items, page, pageSize]);

  return { page, setPage, pageItems, totalItems: items.length, pageSize };
}
