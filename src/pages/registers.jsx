import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';
import { formatTimestamp } from '../lib/timezone.js';

import PrintReportHeader from '../components/PrintReportHeader.jsx';

export default function Registers() {
  const { business } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locationFilter, setLocationFilter] = useState('');
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    if (!business?.id) return;
    supabase
      .from('locations')
      .select('id, name')
      .eq('business_id', business.id)
      .then(({ data }) => setLocations(data || []));
  }, [business?.id]);

  useEffect(() => {
    if (!business?.id) return;
    setLoading(true);

    let query = supabase
      .from('registers')
      .select('*, locations(name), users(first_name, last_name)')
      .eq('business_id', business.id)
      .order('opened_at', { ascending: false });

    if (locationFilter) query = query.eq('location_id', Number(locationFilter));

    query.then(({ data }) => {
      setRows(data || []);
      setLoading(false);
    });
  }, [business?.id, locationFilter]);

  const cur = business?.currency || '';

  return (
    <AppLayout>
      <div className="page-header no-print">
        <div>
          <h1>Registers</h1>
          <p className="muted">
            Cash drawer open/close history for {business?.business_name}.
            Each row is one user's session — the same location can appear
            more than once if multiple cashiers each ran their own drawer
            there.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--navy-border)' }}
          >
            <option value="">All locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <button className="btn btn-secondary" onClick={() => window.print()}>🖨 Print</button>
        </div>
      </div>

      <PrintReportHeader
        title="Registers History"
        filters={[
          { label: 'Location', value: locationFilter ? locations.find(l => String(l.id) === locationFilter)?.name : 'All Locations' },
        ]}
      />

      <div className="card list-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Location</th>
              <th>Opened by</th>
              <th>Opened at</th>
              <th>Closed at</th>
              <th>Opening cash</th>
              <th>Closing cash</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={9} className="muted table-empty">Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={9} className="muted table-empty">No registers yet.</td></tr>
            )}
            {!loading && rows.map((r) => (
              <tr key={r.id}>
                <td>#{r.id}</td>
                <td>{r.locations?.name || '—'}</td>
                <td>{`${r.users?.first_name || ''} ${r.users?.last_name || ''}`.trim() || '—'}</td>
                <td>{formatTimestamp(r.opened_at, business?.time_zone)}</td>
                <td>{r.closed_at ? formatTimestamp(r.closed_at, business?.time_zone) : '—'}</td>
                <td>{cur} {Number(r.opening_cash).toFixed(2)}</td>
                <td>{r.closing_cash != null ? `${cur} ${Number(r.closing_cash).toFixed(2)}` : '—'}</td>
                <td>
                  <span className={`badge ${r.status === 'open' ? 'badge-success' : 'badge-info'}`}>
                    {r.status}
                  </span>
                </td>
                <td className="table-actions">
                  <Link to={`/registers/${r.id}`} className="btn btn-ghost btn-sm">
                    View report
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
