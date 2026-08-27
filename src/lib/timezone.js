/**
 * timezone.js — Business-timezone utilities for the POS application.
 *
 * All functions accept an IANA timezone string (e.g. 'Asia/Karachi').
 * They rely on the built-in Intl.DateTimeFormat API — zero dependencies.
 *
 * Design principles:
 *   • DB stores timestamptz in UTC — never touched.
 *   • DATE columns (sale_date, expense_date, …) are plain 'YYYY-MM-DD' strings.
 *   • Display: convert UTC → business TZ for the user.
 *   • Query boundaries: convert business-local date → UTC instant.
 *   • No per-row TZ conversion in SQL WHERE clauses.
 */

const DEFAULT_TZ = 'Asia/Karachi';

/**
 * Resolve a timezone, falling back to the Pakistan default.
 */
export function resolveTz(tz) {
  return tz || DEFAULT_TZ;
}

// ─── Internal helpers ────────────────────────────────────────

/**
 * Extract numeric date/time parts from a Date in a given timezone.
 * Returns { year, month, day, hour, minute, second }.
 */
function partsInTz(date, tz) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = {};
  for (const { type, value } of fmt.formatToParts(date)) {
    if (type === 'year') parts.year = Number(value);
    else if (type === 'month') parts.month = Number(value);
    else if (type === 'day') parts.day = Number(value);
    else if (type === 'hour') parts.hour = Number(value) % 24; // midnight = 24 in some locales
    else if (type === 'minute') parts.minute = Number(value);
    else if (type === 'second') parts.second = Number(value);
  }
  return parts;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Today's date as 'YYYY-MM-DD' in the business timezone.
 *
 * Replaces: new Date().toISOString().slice(0, 10)
 */
export function todayLocal(tz) {
  tz = resolveTz(tz);
  const p = partsInTz(new Date(), tz);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/**
 * Extract the 'YYYY-MM-DD' date from a timestamptz string,
 * interpreted in the business timezone.
 *
 * Replaces: isoString.slice(0, 10)  (which gives the UTC date)
 */
export function toLocalDate(isoString, tz) {
  if (!isoString) return '';
  tz = resolveTz(tz);
  const p = partsInTz(new Date(isoString), tz);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/**
 * Format a timestamptz for display in the business timezone.
 *
 * Replaces: new Date(ts).toLocaleString()
 */
export function formatTimestamp(isoString, tz) {
  if (!isoString) return '—';
  tz = resolveTz(tz);
  return new Date(isoString).toLocaleString(undefined, { timeZone: tz });
}

/**
 * Format a timestamptz as a short date in the business timezone.
 */
export function formatDate(isoString, tz) {
  if (!isoString) return '—';
  tz = resolveTz(tz);
  return new Date(isoString).toLocaleDateString(undefined, {
    timeZone: tz,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format "now" for display in the business timezone (e.g. report headers).
 */
export function formatNow(tz, options = {}) {
  tz = resolveTz(tz);
  const defaults = {
    timeZone: tz,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  return new Date().toLocaleString(undefined, { ...defaults, ...options });
}

/**
 * Convert a business-local date string ('YYYY-MM-DD') to a UTC ISO string
 * representing the START of that day in the business timezone.
 *
 * Example: startOfDayUTC('2026-08-22', 'Asia/Karachi')
 *          → '2026-08-21T19:00:00.000Z'  (midnight PKT = 7pm UTC previous day)
 *
 * Used for query boundaries: .gte('created_at', startOfDayUTC(date, tz))
 */
export function startOfDayUTC(dateStr, tz) {
  if (!dateStr) return null;
  tz = resolveTz(tz);
  // Build a date-time string that is unambiguously in the target timezone
  // by using the getTimezoneOffset approach via binary search.
  return localDateTimeToUTC(dateStr, '00:00:00.000', tz);
}

/**
 * Convert a business-local date string to a UTC ISO string
 * representing the END of that day (23:59:59.999) in the business timezone.
 *
 * Used for query boundaries: .lte('created_at', endOfDayUTC(date, tz))
 */
export function endOfDayUTC(dateStr, tz) {
  if (!dateStr) return null;
  tz = resolveTz(tz);
  return localDateTimeToUTC(dateStr, '23:59:59.999', tz);
}

/**
 * Get the current year and month in the business timezone.
 * Returns { year: number, month: number (1-indexed) }
 */
export function currentYearMonth(tz) {
  tz = resolveTz(tz);
  const p = partsInTz(new Date(), tz);
  return { year: p.year, month: p.month };
}

/**
 * Get the current year in the business timezone.
 */
export function currentYear(tz) {
  return currentYearMonth(tz).year;
}

/**
 * Get the day-of-week (0 = Sunday) for "now" in the business timezone.
 */
export function currentDayOfWeek(tz) {
  tz = resolveTz(tz);
  // Use Intl to get the weekday
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
  });
  const wd = fmt.format(new Date());
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd] ?? 0;
}

// ─── Internal: local datetime → UTC ─────────────────────────

/**
 * Given a date ('YYYY-MM-DD') and time ('HH:MM:SS.sss') in a specific
 * timezone, compute the equivalent UTC Date.
 *
 * Strategy: construct a UTC guess, measure the offset via Intl, adjust.
 * Handles DST transitions correctly.
 */
function localDateTimeToUTC(dateStr, timeStr, tz) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [timePart, msPart] = timeStr.split('.');
  const [hh, mm, ss] = timePart.split(':').map(Number);
  const ms = msPart ? Number(msPart) : 0;

  // Start with a UTC guess assuming offset = 0
  const utcGuess = new Date(Date.UTC(y, m - 1, d, hh, mm, ss, ms));

  // What is the local time in `tz` at utcGuess?
  const local = partsInTz(utcGuess, tz);

  // Difference (in minutes) between the desired local time and what we got
  const desiredMinutes = hh * 60 + mm;
  const gotMinutes = local.hour * 60 + local.minute;

  // Also handle date rollover
  const desiredDay = d;
  const gotDay = local.day;

  let dayDiffMin = 0;
  if (gotDay !== desiredDay) {
    // If gotDay is ahead, we guessed too late → subtract
    // Simple heuristic: if days differ by 1, that's ±1440 minutes
    if (gotDay > desiredDay || (gotDay === 1 && desiredDay > 27)) {
      dayDiffMin = 1440; // we're a day ahead
    } else {
      dayDiffMin = -1440; // we're a day behind
    }
  }

  const diffMinutes = (gotMinutes + dayDiffMin) - desiredMinutes;

  // Adjust: subtract the diff from the guess
  const adjusted = new Date(utcGuess.getTime() - diffMinutes * 60000);

  // Verify by re-checking (handles edge cases around DST transitions)
  const verify = partsInTz(adjusted, tz);
  if (verify.hour !== hh || verify.minute !== mm || verify.day !== d) {
    // Second correction pass
    const v2Minutes = verify.hour * 60 + verify.minute;
    let v2DayDiff = 0;
    if (verify.day !== d) {
      v2DayDiff = verify.day > d || (verify.day === 1 && d > 27) ? 1440 : -1440;
    }
    const diff2 = (v2Minutes + v2DayDiff) - desiredMinutes;
    return new Date(adjusted.getTime() - diff2 * 60000).toISOString();
  }

  return adjusted.toISOString();
}
