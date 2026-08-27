import { useMemo, useState } from 'react';

export default function usePagination(
  items = [],
  itemsPerPage = 20
) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalItems = items.length;

  const totalPages = Math.max(
    1,
    Math.ceil(totalItems / itemsPerPage)
  );

  const safeCurrentPage = Math.min(
    currentPage,
    totalPages
  );

  const paginatedItems = useMemo(() => {
    const startIndex =
      (safeCurrentPage - 1) * itemsPerPage;

    const endIndex =
      startIndex + itemsPerPage;

    return items.slice(
      startIndex,
      endIndex
    );
  }, [
    items,
    safeCurrentPage,
    itemsPerPage,
  ]);

  const goToPage = (page) => {
    const pageNumber = Math.max(
      1,
      Math.min(page, totalPages)
    );

    setCurrentPage(pageNumber);
  };

  const nextPage = () => {
    if (safeCurrentPage < totalPages) {
      setCurrentPage(
        safeCurrentPage + 1
      );
    }
  };

  const previousPage = () => {
    if (safeCurrentPage > 1) {
      setCurrentPage(
        safeCurrentPage - 1
      );
    }
  };

  const firstItemIndex =
    totalItems === 0
      ? 0
      : (safeCurrentPage - 1) *
          itemsPerPage +
        1;

  const lastItemIndex =
    Math.min(
      safeCurrentPage * itemsPerPage,
      totalItems
    );

  return {
    currentPage: safeCurrentPage,
    totalPages,
    totalItems,
    paginatedItems,
    firstItemIndex,
    lastItemIndex,
    goToPage,
    nextPage,
    previousPage,
    hasNextPage:
      safeCurrentPage < totalPages,
    hasPreviousPage:
      safeCurrentPage > 1,
  };
}