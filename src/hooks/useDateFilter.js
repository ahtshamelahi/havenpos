import { useCallback, useMemo, useState } from 'react';
import { startOfDayUTC, endOfDayUTC, todayLocal, resolveTz, currentDayOfWeek, currentYearMonth } from '../lib/timezone.js';

/**
 * useDateFilter
 *
 * Reusable date-range filtering for arrays of records.
 *
 * Presets:
 * - all
 * - today
 * - yesterday
 * - this_week
 * - this_month
 * - this_year
 * - custom
 *
 * Usage:
 *
 * const dateFilter = useDateFilter(rows, {
 *   getDate: (row) => row.created_at,
 *   timezone: business?.time_zone,
 * });
 *
 * const filteredRows = dateFilter.filteredData;
 */
export default function useDateFilter(
  data,
  options = {}
) {
  const {
    getDate = (row) => row?.created_at,
    initialPreset = 'all',
    timezone,
  } = options;

  const tz = resolveTz(timezone);

  const [preset, setPreset] =
    useState(initialPreset);

  const [fromDate, setFromDate] =
    useState('');

  const [toDate, setToDate] =
    useState('');

  const getDateRange = useCallback(() => {
    if (preset === 'all') {
      return {
        start: null,
        end: null,
      };
    }

    const today = todayLocal(tz);

    const pad2 = (n) => String(n).padStart(2, '0');

    const subtractDays = (dateStr, days) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      dt.setDate(dt.getDate() - days);
      return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
    };

    // Compute the local-date boundaries based on preset
    let startDate = null; // 'YYYY-MM-DD' or null
    let endDate = null;

    if (preset === 'today') {
      startDate = today;
      endDate = today;
    } else if (preset === 'yesterday') {
      const y = subtractDays(today, 1);
      startDate = y;
      endDate = y;
    } else if (preset === 'this_week') {
      const dow = currentDayOfWeek(tz);
      startDate = subtractDays(today, dow);
      endDate = today;
    } else if (preset === 'this_month') {
      const { year, month } = currentYearMonth(tz);
      startDate = `${year}-${pad2(month)}-01`;
      endDate = today;
    } else if (preset === 'this_year') {
      const { year } = currentYearMonth(tz);
      startDate = `${year}-01-01`;
      endDate = today;
    } else if (preset === 'custom') {
      startDate = fromDate || null;
      endDate = toDate || null;
    }

    // Convert local-date boundaries to UTC instants for comparison
    // against timestamptz values from the database
    return {
      start: startDate
        ? new Date(startOfDayUTC(startDate, tz))
        : null,
      end: endDate
        ? new Date(endOfDayUTC(endDate, tz))
        : null,
    };
  }, [
    preset,
    fromDate,
    toDate,
    tz,
  ]);

  const filteredData = useMemo(() => {
    const list = Array.isArray(data)
      ? data.slice()
      : [];

    const {
      start,
      end,
    } = getDateRange();

    if (!start && !end) {
      return list;
    }

    return list.filter((row) => {
      const rawDate =
        getDate(row);

      if (!rawDate) {
        return false;
      }

      const rowDate =
        new Date(rawDate);

      if (
        Number.isNaN(
          rowDate.getTime()
        )
      ) {
        return false;
      }

      if (
        start &&
        rowDate < start
      ) {
        return false;
      }

      if (
        end &&
        rowDate > end
      ) {
        return false;
      }

      return true;
    });
  }, [
    data,
    getDate,
    getDateRange,
  ]);

  const selectPreset = useCallback(
    (value) => {
      setPreset(value);

      if (value !== 'custom') {
        setFromDate('');
        setToDate('');
      }
    },
    []
  );

  const clearDateFilter =
    useCallback(() => {
      setPreset('all');
      setFromDate('');
      setToDate('');
    }, []);

  return {
    filteredData,

    preset,
    setPreset: selectPreset,

    fromDate,
    setFromDate,

    toDate,
    setToDate,

    clearDateFilter,

    isActive:
      preset !== 'all',

    getDateRange,
  };
}