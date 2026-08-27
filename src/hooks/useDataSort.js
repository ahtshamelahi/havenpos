import { useCallback, useMemo, useState } from 'react';

/**
 * useDataSort — generic, reusable sorting for any array of records.
 *
 * Click cycle:
 *   1st click  → ascending
 *   2nd click → descending
 *   3rd click → no sorting
 */

export default function useDataSort(data, fields, options = {}) {
  const {
    defaultKey = null,
    defaultDirection = 'asc',
  } = options;

  const [sortKey, setSortKeyState] = useState(defaultKey);
  const [sortDirection, setSortDirectionState] = useState(
    defaultKey ? defaultDirection : null
  );

  const fieldsByKey = useMemo(
    () =>
      Object.fromEntries(
        (fields || []).map((field) => [field.key, field])
      ),
    [fields]
  );

  /**
   * Select a sorting field.
   * Selecting a new field always starts with ASC.
   */
  const setSortKey = useCallback((key) => {
    if (!key) {
      setSortKeyState(null);
      setSortDirectionState(null);
      return;
    }

    setSortKeyState(key);
    setSortDirectionState('asc');
  }, []);

  /**
   * Set direction manually.
   */
  const setSortDirection = useCallback((direction) => {
    if (direction === 'asc' || direction === 'desc') {
      setSortDirectionState(direction);
    } else {
      setSortDirectionState(null);
    }
  }, []);

  /**
   * Toggle between ASC and DESC.
   */
  const toggleDirection = useCallback(() => {
    setSortDirectionState((prev) => {
      if (prev === 'asc') return 'desc';
      return 'asc';
    });
  }, []);

  /**
   * 3-click cycle:
   *
   * Different field → ASC
   * Same field:
   *   ASC  → DESC
   *   DESC → NONE
   *   NONE → ASC
   */
  const toggleSortKey = useCallback((key) => {
    setSortKeyState((prevKey) => {
      if (prevKey !== key) {
        setSortDirectionState('asc');
        return key;
      }

      setSortDirectionState((prevDirection) => {
        if (prevDirection === 'asc') return 'desc';

        if (prevDirection === 'desc') {
          return null;
        }

        return 'asc';
      });

      return prevKey;
    });
  }, []);

  /**
   * Clear sorting.
   */
  const clearSort = useCallback(() => {
    setSortKeyState(null);
    setSortDirectionState(null);
  }, []);

  /**
   * Apply sorting only when direction is ASC or DESC.
   */
  const sortedData = useMemo(() => {
    const list = Array.isArray(data) ? data.slice() : [];

    const field = sortKey ? fieldsByKey[sortKey] : null;

    // No sorting
    if (!field || !sortDirection) {
      return list;
    }

    const dirMultiplier = sortDirection === 'desc' ? -1 : 1;

    list.sort((a, b) =>
      dirMultiplier *
      compareValues(
        resolveValue(field, a),
        resolveValue(field, b),
        field.type
      )
    );

    return list;
  }, [
    data,
    sortKey,
    sortDirection,
    fieldsByKey,
  ]);

  return {
    sortedData,
    sortKey,
    sortDirection,
    setSortKey,
    setSortDirection,
    toggleDirection,
    toggleSortKey,
    clearSort,
    fields,
  };
}


function resolveValue(field, row) {
  if (typeof field.getValue === 'function') {
    return field.getValue(row);
  }

  return row ? row[field.key] : undefined;
}


function isEmpty(value) {
  return (
    value === null ||
    value === undefined ||
    value === ''
  );
}


function compareValues(a, b, type = 'text') {
  const aEmpty = isEmpty(a);
  const bEmpty = isEmpty(b);

  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  if (type === 'number') {
    const an = Number(a);
    const bn = Number(b);

    const aNaN = Number.isNaN(an);
    const bNaN = Number.isNaN(bn);

    if (aNaN && bNaN) return 0;
    if (aNaN) return 1;
    if (bNaN) return -1;

    return an - bn;
  }

  if (type === 'date') {
    const ad =
      a instanceof Date
        ? a.getTime()
        : new Date(a).getTime();

    const bd =
      b instanceof Date
        ? b.getTime()
        : new Date(b).getTime();

    const aInvalid = Number.isNaN(ad);
    const bInvalid = Number.isNaN(bd);

    if (aInvalid && bInvalid) return 0;
    if (aInvalid) return 1;
    if (bInvalid) return -1;

    return ad - bd;
  }

  return String(a).localeCompare(
    String(b),
    undefined,
    {
      sensitivity: 'base',
      numeric: true,
    }
  );
}