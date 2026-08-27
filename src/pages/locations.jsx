import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SettingsLayout from '../components/SettingsLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';

export default function Locations() {
  const { business, profile } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    if (!business?.id) return;
    setLoading(true);
    const { data, error: err } = await supabase.from('locations').select('*').eq('business_id', business.id).order('name');
    if (err) setError(err.message);
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [business?.id]);

  const toggleActive = async (row) => {
    setError('');
    if (row.is_active) {
      const { count } = await supabase.from('stock_ledger').select('id', { count: 'exact', head: true }).eq('location_id', row.id);
      if ((count || 0) > 0 && !window.confirm('This location has stock history. Deactivating hides it from new sales/purchases but keeps past records. Continue?')) {
        return;
      }
    }
    const { error: err } = await supabase.from('locations').update({ is_active: !row.is_active }).eq('id', row.id);
    if (err) setError(err.message);
    else load();
  };

  return (
    <SettingsLayout title="Business Locations" subtitle="Manage places where you stock and sell products.">
      
      {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="settings-card">
        <div className="settings-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>All Locations</h2>
          {profile?.is_owner && <button className="btn btn-primary btn-sm" onClick={() => navigate('/settings/locations/new')}>+ Add location</button>}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>Name</th><th>Address</th><th>City</th><th>Country</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="muted table-empty">Loading…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={6} className="muted table-empty">No locations yet.</td></tr>}
              {!loading && rows.map((l) => (
                <tr key={l.id}>
                  <td>{l.name}</td>
                  <td>{l.address || '—'}</td>
                  <td>{l.city || '—'}</td>
                  <td>{l.country || '—'}</td>
                  <td>{l.is_active ? <span className="badge badge-success">Active</span> : <span className="badge badge-danger">Inactive</span>}</td>
                  <td className="table-actions">
                    {profile?.is_owner && <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/settings/locations/${l.id}`)}>Edit</button>}
                    {profile?.is_owner && <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(l)}>{l.is_active ? 'Deactivate' : 'Activate'}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </SettingsLayout>
  );
}
