// Common date-range presets used across every report page.
// Returns { from, to } as 'YYYY-MM-DD' strings, or '' for "all time" (no bound).
//
// All presets are computed in the business timezone so that "today",
// "this week", etc. reflect the business's local calendar day.

import { todayLocal, currentYearMonth, currentYear, currentDayOfWeek, resolveTz } from './timezone.js';

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Build a 'YYYY-MM-DD' string from year/month/day numbers.
 */
function ymd(y, m, d) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/**
 * Subtract `days` from a 'YYYY-MM-DD' string and return a new 'YYYY-MM-DD'.
 */
function subtractDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - days);
  return ymd(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

/**
 * Get last day of a month (28–31).
 */
function lastDayOfMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * getPresetRange — returns { from, to } as 'YYYY-MM-DD' strings.
 *
 * @param {string} preset  — one of the preset keys
 * @param {string} [tz]    — IANA timezone (defaults to business default)
 */
export function getPresetRange(preset, tz) {
  tz = resolveTz(tz);
  const today = todayLocal(tz);
  const { year, month } = currentYearMonth(tz);

  switch (preset) {
    case 'today': {
      return { from: today, to: today };
    }
    case 'yesterday': {
      const s = subtractDays(today, 1);
      return { from: s, to: s };
    }
    case 'last_7_days': {
      return { from: subtractDays(today, 6), to: today };
    }
    case 'last_30_days': {
      return { from: subtractDays(today, 29), to: today };
    }
    case 'this_week': {
      const dow = currentDayOfWeek(tz); // 0 = Sunday
      return { from: subtractDays(today, dow), to: today };
    }
    case 'this_month': {
      return { from: ymd(year, month, 1), to: today };
    }
    case 'last_month': {
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const lastDay = lastDayOfMonth(prevYear, prevMonth);
      return { from: ymd(prevYear, prevMonth, 1), to: ymd(prevYear, prevMonth, lastDay) };
    }
    case 'this_year': {
      return { from: ymd(year, 1, 1), to: today };
    }
    case 'last_year': {
      const ly = year - 1;
      return { from: ymd(ly, 1, 1), to: ymd(ly, 12, 31) };
    }
    case 'all_time':
    default:
      return { from: '', to: '' };
  }
}

export const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'this_week', label: 'This week' },
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'this_year', label: 'This year' },
  { key: 'all_time', label: 'All time' },
];

// Exact preset set requested for the Dashboard filter. "Custom range" isn't
// a button here — typing dates directly into the from/to inputs that sit
// alongside these buttons (see ReportFilters) covers that case.
export const DASHBOARD_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last_7_days', label: '7 Days' },
  { key: 'last_30_days', label: '30 Days' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'this_year', label: 'This Year' },
  { key: 'last_year', label: 'Last Year' },
];
