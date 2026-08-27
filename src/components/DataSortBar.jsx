import './DataSortBar.css';

/**
 * DataSortBar — presentational control for useDataSort. Pass it the hook's
 * output directly; it doesn't know or care what module/table it's sorting.
 *
 * Usage:
 *   const sort = useDataSort(rows, salesSortFields);
 *   <DataSortBar {...sort} />
 */
export default function DataSortBar({
  fields = [],
  sortKey,
  sortDirection,
  setSortKey,
  toggleDirection,
  clearSort,
  label = 'Sort by',
  className = '',
}) {
  if (!fields.length) return null;

  return (
    <div className={`data-sort-bar ${className}`}>
      <span className="data-sort-label">{label}</span>

      <select
        className="data-sort-select"
        value={sortKey || ''}
        onChange={(e) => setSortKey(e.target.value || null)}
      >
        <option value="">None</option>
        {fields.map((f) => (
          <option key={f.key} value={f.key}>{f.label}</option>
        ))}
      </select>

      {sortKey && (
        <>
          <button
            type="button"
            className="data-sort-direction-btn"
            onClick={toggleDirection}
            title={sortDirection === 'asc' ? 'Ascending — click for descending' : 'Descending — click for ascending'}
          >
            {sortDirection === 'asc' ? '↑ Asc' : '↓ Desc'}
          </button>
          <button type="button" className="data-sort-clear-btn" onClick={clearSort}>
            Clear
          </button>
        </>
      )}
    </div>
  );
}
