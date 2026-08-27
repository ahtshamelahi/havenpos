import { useState } from 'react';
import { PRESETS, getPresetRange } from '../lib/dateRanges.js';
import './ReportFilters.css';

/**
 * Unified filter bar for report pages.
 *
 * - Period, Location, and any number of `extraFilters` are all rendered as
 *   real <select> dropdowns (no behavior/query logic changes — this only
 *   changes how the filters are presented).
 * - A "chip" row underneath always shows which filters are currently
 *   applied, so it's clear at a glance what the report is scoped to.
 * - Pass `showDateRange={false}` for reports that don't use a date range
 *   (e.g. a live "as of now" stock report) to only show location/extra
 *   filters.
 *
 * onChange is called as onChange(newRange, presetKey). presetKey is one of
 * the values in `presets`, or 'custom' when the person types dates in
 * directly. Existing callers that only cared about the range object can
 * ignore the second argument.
 */
export default function ReportFilters({
  from,
  to,
  onChange = () => {},
  presets = PRESETS,
  activePreset = 'this_month',
  locations,
  locationId,
  onLocationChange,
  extraFilters = [],
  showDateRange = true,
  tz,
}) {
  const [customOpen, setCustomOpen] = useState(activePreset === 'custom');

  const isCustom = customOpen || activePreset === 'custom';

  const handlePresetSelect = (e) => {
    const key = e.target.value;
    if (key === 'custom') {
      setCustomOpen(true);
      return;
    }
    setCustomOpen(false);
    onChange(getPresetRange(key, tz), key);
  };

  const periodLabel = () => {
    if (isCustom) {
      if (from && to) return `${from} – ${to}`;
      if (from) return `From ${from}`;
      if (to) return `Through ${to}`;
      return 'Custom range';
    }
    const match = presets.find((p) => p.key === activePreset);
    return match ? match.label : 'All time';
  };

  const locationLabel = () => {
    if (!locations || !locationId) return null;
    const loc = locations.find((l) => String(l.id) === String(locationId));
    return loc ? loc.name : null;
  };

  const chips = [];
  if (showDateRange) chips.push({ key: 'period', label: periodLabel() });
  const locLabel = locationLabel();
  if (locLabel) chips.push({ key: 'location', label: locLabel });
  extraFilters.forEach((f) => {
    const opt = f.options.find((o) => String(o.value) === String(f.value));
    if (opt && opt.value !== '' && opt.value !== 'all') {
      chips.push({ key: f.key, label: opt.label });
    }
  });

  return (
    <div className="card no-print filter-bar">
      <div className="filter-bar-controls">
        {showDateRange && (
          <div className="filter-field">
            <label className="filter-field-label" htmlFor="filter-period">Period</label>
            <select
              id="filter-period"
              className="filter-select"
              value={isCustom ? 'custom' : activePreset}
              onChange={handlePresetSelect}
            >
              {presets.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
              <option value="custom">Custom range…</option>
            </select>
          </div>
        )}

        {showDateRange && isCustom && (
          <div className="filter-field filter-field-dates">
            <label className="filter-field-label" htmlFor="filter-from">From</label>
            <input
              id="filter-from"
              type="date"
              className="filter-date"
              value={from}
              onChange={(e) => onChange({ from: e.target.value, to }, 'custom')}
            />
            <label className="filter-field-label" htmlFor="filter-to">To</label>
            <input
              id="filter-to"
              type="date"
              className="filter-date"
              value={to}
              onChange={(e) => onChange({ from, to: e.target.value }, 'custom')}
            />
          </div>
        )}

        {locations && (
          <div className="filter-field">
            <label className="filter-field-label" htmlFor="filter-location">Location</label>
            <select
              id="filter-location"
              className="filter-select"
              value={locationId}
              onChange={(e) => onLocationChange(e.target.value)}
            >
              <option value="">All locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
        )}

        {extraFilters.map((f) => (
          <div className="filter-field" key={f.key}>
            <label className="filter-field-label" htmlFor={`filter-${f.key}`}>{f.label}</label>
            <select
              id={`filter-${f.key}`}
              className="filter-select"
              value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
            >
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {chips.length > 0 && (
        <div className="filter-chips">
          <span className="filter-chips-label">Applied:</span>
          {chips.map((c) => (
            <span className="filter-chip" key={c.key}>{c.label}</span>
          ))}
        </div>
      )}
    </div>
  );
}
