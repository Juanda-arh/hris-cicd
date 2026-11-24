import { useMemo, useState } from 'react';

export default function usePagination(items, pageSize = 6) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const pageItems = useMemo(() => items.slice((page - 1) * pageSize, page * pageSize), [items, page, pageSize]);
  return { page: Math.min(page, totalPages), setPage, totalPages, pageItems };
}
