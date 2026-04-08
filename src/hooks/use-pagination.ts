"use client";

import { useState, useCallback } from "react";

interface UsePaginationOptions {
  pageSize?: number;
  initialPage?: number;
}

interface UsePaginationReturn {
  page: number;
  pageSize: number;
  offset: number;
  nextPage: () => void;
  prevPage: () => void;
  goToPage: (page: number) => void;
  resetPage: () => void;
}

export function usePagination({
  pageSize = 20,
  initialPage = 1,
}: UsePaginationOptions = {}): UsePaginationReturn {
  const [page, setPage] = useState(initialPage);

  const offset = (page - 1) * pageSize;

  const nextPage = useCallback(() => setPage((p) => p + 1), []);
  const prevPage = useCallback(() => setPage((p) => Math.max(1, p - 1)), []);
  const goToPage = useCallback((p: number) => setPage(Math.max(1, p)), []);
  const resetPage = useCallback(() => setPage(1), []);

  return { page, pageSize, offset, nextPage, prevPage, goToPage, resetPage };
}
