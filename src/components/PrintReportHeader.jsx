import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { formatNow } from '../lib/timezone.js';

/**
 * PrintReportHeader — visible when printing OR when .pdf-export-mode is active.
 *
 * Props:
 *   title       {string}  — Report title e.g. "Profit & Loss Report"
 *   filters     {Array}   — [{ label: string, value: string }] active filters
 *   location    {string}  — Optional: selected location name (overrides filter)
 */
export default function PrintReportHeader({ title, filters = [], location }) {
  const { business, profile } = useAuth();

  const generatedAt = formatNow(business?.time_zone, {
    year:   'numeric',
    month:  'long',
    day:    'numeric',
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const dateOnly = formatNow(business?.time_zone, {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
  });
  const timeOnly = formatNow(business?.time_zone, { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const addressParts = [
    business?.address_line_1,
    business?.city,
    business?.state,
    business?.country,
  ].filter(Boolean);
  const addressLine = addressParts.join(', ');
  const contactLine = [business?.contact_number, business?.email]
    .filter(Boolean)
    .join('  ·  ');

  const generatedBy = profile?.first_name
    ? `${profile.first_name} ${profile.last_name || ''}`.trim()
    : null;

  // Resolve location display: prefer explicit prop, then look inside filters
  const locationDisplay =
    location ||
    filters.find((f) => f.label === 'Location')?.value ||
    'All Locations';

  return (
    <div className="prh-root">
      {/* ── Top row: business info LEFT, generated time RIGHT ── */}
      <div className="prh-top">
        <div className="prh-biz">
          <div className="prh-eyebrow" style={{ fontWeight: 800, fontSize: '13px', color: '#1e3a5f', letterSpacing: '0.08em', textTransform: 'uppercase' }}>PASHA TRADERS APP</div>
          <div className="prh-biz-name">{business?.business_name || 'Pasha Traders'}</div>
          {addressLine && <div className="prh-biz-meta">{addressLine}</div>}
          {contactLine && <div className="prh-biz-meta">{contactLine}</div>}
        </div>

        <div className="prh-meta-right">
          <div className="prh-date-label">Generated On</div>
          <div className="prh-generated-at">{dateOnly}</div>
          <div className="prh-generated-time">{timeOnly}</div>
          {generatedBy && (
            <div className="prh-generated-by">By {generatedBy}</div>
          )}
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="prh-divider" />

      {/* ── Report title + report type badge ── */}
      <div className="prh-title-row">
        <span className="prh-report-type">REPORT</span>
        <h1 className="prh-title">{title}</h1>
      </div>

      {/* ── Info row: location + timestamp ── */}
      <div className="prh-info-row">
        <div className="prh-info-item">
          <span className="prh-info-icon">📍</span>
          <span className="prh-info-label">Location:</span>
          <span className="prh-info-value">{locationDisplay}</span>
        </div>
        <div className="prh-info-item">
          <span className="prh-info-icon">🕐</span>
          <span className="prh-info-label">Exported:</span>
          <span className="prh-info-value">{generatedAt}</span>
        </div>
      </div>

      {/* ── Active filters chips ── */}
      {filters.length > 0 && (
        <div className="prh-filters-row">
          <span className="prh-filters-label">Active Filters:</span>
          {filters.map((f, i) => (
            <span key={i} className="prh-filter-chip">
              <span className="prh-chip-label">{f.label}:</span>{' '}
              <span className="prh-chip-value">{f.value}</span>
            </span>
          ))}
        </div>
      )}

      <style>{`
        /* Hidden by default — shown on print or when body has .pdf-export-mode */
        .prh-root {
          display: none;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          border: 1px solid #d1d5db;
          border-top: 5px solid #1e3a5f;
          border-radius: 6px;
          padding: 16px 20px 14px;
          margin-bottom: 18px;
          background: #fff;
          page-break-inside: avoid;
          page-break-after: avoid;
        }
        @media print {
          .prh-root { display: block !important; }
        }
        /* Shown during PDF export */
        .pdf-export-mode .prh-root {
          display: block !important;
        }

        /* ── Layout ── */
        .prh-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }
        .prh-biz { flex: 1; }
        .prh-eyebrow {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #6b7280;
          margin-bottom: 3px;
        }
        .prh-biz-name {
          font-size: 20px;
          font-weight: 800;
          color: #1e3a5f;
          line-height: 1.2;
        }
        .prh-biz-meta {
          font-size: 11px;
          color: #6b7280;
          margin-top: 2px;
        }

        /* ── Right meta (date/time/user) ── */
        .prh-meta-right { text-align: right; flex-shrink: 0; }
        .prh-date-label {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #9ca3af;
          margin-bottom: 1px;
        }
        .prh-generated-at {
          font-size: 12px;
          font-weight: 700;
          color: #1e3a5f;
        }
        .prh-generated-time {
          font-size: 13px;
          font-weight: 800;
          color: #1e3a5f;
          margin-top: 1px;
        }
        .prh-generated-by {
          font-size: 10px;
          color: #6b7280;
          margin-top: 3px;
        }

        /* ── Divider ── */
        .prh-divider {
          height: 1px;
          background: #e5e7eb;
          margin: 10px 0 10px;
        }

        /* ── Title ── */
        .prh-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .prh-report-type {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.1em;
          background: #1e3a5f;
          color: #fff;
          padding: 2px 7px;
          border-radius: 3px;
          text-transform: uppercase;
          flex-shrink: 0;
        }
        .prh-title {
          font-size: 18px;
          font-weight: 700;
          color: #111827;
          margin: 0;
          padding: 0;
        }

        /* ── Info row (location + timestamp) ── */
        .prh-info-row {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 8px;
          padding: 8px 10px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 5px;
        }
        .prh-info-item {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
        }
        .prh-info-icon { font-size: 13px; }
        .prh-info-label {
          font-weight: 700;
          color: #374151;
        }
        .prh-info-value { color: #1e3a5f; font-weight: 600; }

        /* ── Filter chips ── */
        .prh-filters-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          align-items: center;
          margin-top: 6px;
        }
        .prh-filters-label {
          font-size: 11px;
          font-weight: 700;
          color: #374151;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-right: 2px;
        }
        .prh-filter-chip {
          font-size: 11px;
          background: #f3f4f6;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          padding: 2px 8px;
          color: #374151;
        }
        .prh-chip-label { font-weight: 600; color: #1e3a5f; }
        .prh-chip-value { color: #374151; }
      `}</style>
    </div>
  );
}
