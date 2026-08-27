import './Pagination.css';

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  firstItemIndex,
  lastItemIndex,
  goToPage,
  nextPage,
  previousPage,
  hasNextPage,
  hasPreviousPage,
}) {
  if (totalItems === 0) {
    return null;
  }

  const getPageNumbers = () => {
    const pages = [];

    if (totalPages <= 7) {
      for (
        let page = 1;
        page <= totalPages;
        page++
      ) {
        pages.push(page);
      }

      return pages;
    }

    pages.push(1);

    if (currentPage > 4) {
      pages.push('ellipsis-left');
    }

    const startPage = Math.max(
      2,
      currentPage - 1
    );

    const endPage = Math.min(
      totalPages - 1,
      currentPage + 1
    );

    for (
      let page = startPage;
      page <= endPage;
      page++
    ) {
      pages.push(page);
    }

    if (currentPage < totalPages - 3) {
      pages.push('ellipsis-right');
    }

    pages.push(totalPages);

    return pages;
  };

  return (
    <div className="pagination-wrapper">
      <div className="pagination-summary">
        Showing{' '}
        <strong>
          {firstItemIndex}
        </strong>
        –
        <strong>
          {lastItemIndex}
        </strong>{' '}
        of{' '}
        <strong>
          {totalItems}
        </strong>
      </div>

      <div className="pagination-controls">
        <button
          type="button"
          className="pagination-button"
          onClick={previousPage}
          disabled={!hasPreviousPage}
        >
          Previous
        </button>

        {getPageNumbers().map(
          (page, index) => {
            if (
              page ===
              'ellipsis-left' ||
              page ===
              'ellipsis-right'
            ) {
              return (
                <span
                  key={`${page}-${index}`}
                  className="pagination-ellipsis"
                >
                  …
                </span>
              );
            }

            return (
              <button
                type="button"
                key={page}
                className={`pagination-button pagination-page ${
                  currentPage === page
                    ? 'pagination-page-active'
                    : ''
                }`}
                onClick={() =>
                  goToPage(page)
                }
              >
                {page}
              </button>
            );
          }
        )}

        <button
          type="button"
          className="pagination-button"
          onClick={nextPage}
          disabled={!hasNextPage}
        >
          Next
        </button>
      </div>
    </div>
  );
}