import { useAuth } from '../context/AuthContext.jsx';
import { formatNow } from '../lib/timezone.js';
import './ReportHeader.css';

function formatRange(from, to) {
  if (!from && !to) return 'All time';
  if (from && to && from === to) return from;
  if (from && to) return `${from} — ${to}`;
  if (from) return `From ${from}`;
  return `Through ${to}`;
}

export default function ReportHeader({ title, subtitle, from, to }) {
  const { business, profile } = useAuth();
  const generatedAt = formatNow(business?.time_zone, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const addressLine = [business?.city, business?.state, business?.country].filter(Boolean).join(', ');
  const contactLine = [business?.contact_number, business?.website_link].filter(Boolean).join('  ·  ');

  return (
    <div className="report-header">
      <div className="report-header-top">
        <div>
          <div className="report-eyebrow">Business Report</div>
          <div className="report-business-name">{business?.business_name || 'Your Business'}</div>
          {addressLine && <div className="muted report-business-meta">{addressLine}</div>}
          {contactLine && <div className="muted report-business-meta">{contactLine}</div>}
        </div>
        <button className="btn btn-secondary btn-sm no-print" onClick={() => window.print()}>Print / Save PDF</button>
      </div>

      <div className="report-title-block">
        <h1 className="report-title">{title}</h1>
        {subtitle && <p className="muted report-subtitle">{subtitle}</p>}
      </div>

      <div className="report-meta-row">
        <span><span className="report-meta-label">Period</span> {formatRange(from, to)}</span>
        <span className="muted">
          <span className="report-meta-label">Generated</span> {generatedAt}
          {profile?.first_name ? ` by ${profile.first_name} ${profile.last_name || ''}`.trim() : ''}
        </span>
      </div>
    </div>
  );
}
