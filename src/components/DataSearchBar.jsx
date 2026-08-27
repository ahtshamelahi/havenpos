import './DataSearchBar.css';

/**
 * DataSearchBar — presentational control for useDataSearch. Pass it the
 * hook's output directly; it doesn't know or care what module/table it's
 * searching.
 *
 * Usage:
 *   const search = useDataSearch(rows, salesSearchFields);
 *   <DataSearchBar query={search.query} setQuery={search.setQuery} clearSearch={search.clearSearch} />
 */
export default function DataSearchBar({
  query,
  setQuery,
  clearSearch,
  placeholder = 'Search…',
  className = '',
}) {
  return (
    <div className={`data-search-bar ${className}`}>
      <input
        type="text"
        className="data-search-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
      />
      {query && (
        <button
          type="button"
          className="data-search-clear-btn"
          onClick={clearSearch}
          aria-label="Clear search"
          title="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  );
}
