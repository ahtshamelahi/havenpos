import './SortableHeader.css';

export default function SortableHeader({
  label,
  sortKey,
  currentSortKey,
  sortDirection,
  toggleSortKey,
  className = '',
}) {
  const isActive = currentSortKey === sortKey;

  return (
    <th
      className={`sortable-header ${
        isActive ? 'sortable-header-active' : ''
      } ${className}`}
      onClick={() => toggleSortKey(sortKey)}
    >
      <div className="sortable-header-content">
        <span>{label}</span>

        <span
          className={`sortable-arrow ${
            isActive && sortDirection ? 'active' : ''
          }`}
        >
          {isActive && sortDirection === 'asc'
            ? '↑'
            : isActive && sortDirection === 'desc'
              ? '↓'
              : '↕'}
        </span>
      </div>
    </th>
  );
}