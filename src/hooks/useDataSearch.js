import { useCallback, useMemo, useState } from 'react';

/**
 * useDataSearch — generic, reusable free-text search across any array of
 * records. Completely independent from useDataSort — neither knows the
 * other exists. Chain them in whichever order makes sense for your page.
 *
 * @param {Array} data - the rows to search. Never mutated.
 * @param {Array<string | ((row) => any)>} fields
 *   Each entry is either:
 *     - a string: a direct property name on the row (`row[field]`)
 *     - a function: `(row) => value`, for nested/computed values
 *   A row matches if ANY field's value contains the query (OR logic).
 * @param {{ initialQuery?: string }} [options]
 *
 * @returns {{
 *   filteredData: Array,
 *   query: string,
 *   setQuery: (q: string) => void,
 *   clearSearch: () => void,
 *   isActive: boolean,   // true when there's a non-empty query
 * }}
 */
export default function useDataSearch(data, fields, options = {}) {
  const { initialQuery = '' } = options;
  const [query, setQuery] = useState(initialQuery);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredData = useMemo(() => {
    const list = Array.isArray(data) ? data.slice() : []; // never mutate the source array
    if (!normalizedQuery) return list;

    return list.filter((row) =>
      (fields || []).some((field) => {
        const value = typeof field === 'function' ? field(row) : row?.[field];
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(normalizedQuery);
      })
    );
  }, [data, fields, normalizedQuery]);

  const clearSearch = useCallback(() => setQuery(''), []);

  return {
    filteredData,
    query,
    setQuery,
    clearSearch,
    isActive: normalizedQuery.length > 0,
  };
}
