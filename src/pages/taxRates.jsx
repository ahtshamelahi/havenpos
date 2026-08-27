import { useEffect, useState } from 'react';
import SettingsLayout from '../components/SettingsLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';

export default function TaxRates() {
  const { business } = useAuth();
  const [rows, setRows] = useState([]);
  const [name, setName] = useState('');
  const [rate, setRate] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editingRate, setEditingRate] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    if (!business?.id) return;
    setLoading(true);
    const { data, error: err } = await supabase.from('tax_rates').select('*').eq('business_id', business.id).order('id');
    if (err) setError(err.message);
    else setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [business?.id]);

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim() || rate === '') return;
    const numericRate = Number(rate);
    if (Number.isNaN(numericRate) || numericRate < 0 || numericRate > 100) {
      setError('Tax rate must be between 0 and 100.');
      return;
    }
    setError('');
    const { error: err } = await supabase.from('tax_rates').insert({ business_id: business.id, name: name.trim(), rate_percentage: numericRate });
    if (err) setError(err.message);
    else { setName(''); setRate(''); load(); }
  };

  const startEdit = (row) => { setEditingId(row.id); setEditingRate(row.rate_percentage); setError(''); };
  const cancelEdit = () => { setEditingId(null); setEditingRate(''); };

  const saveEdit = async (id) => {
    const numericRate = Number(editingRate);
    if (editingRate === '' || Number.isNaN(numericRate) || numericRate < 0 || numericRate > 100) {
      setError('Tax rate must be between 0 and 100.');
      return;
    }
    setError('');
    const { error: err } = await supabase.from('tax_rates').update({ rate_percentage: numericRate }).eq('id', id).eq('business_id', business.id);
    if (err) setError(err.message);
    else { cancelEdit(); load(); }
  };

  const deleteTaxRate = async (row) => {
    setError('');
    const { error: err } = await supabase.from('tax_rates').update({ is_active: false }).eq('id', row.id).eq('business_id', business.id);
    if (err) setError(err.message);
    else load();
  };

  const activateTaxRate = async (row) => {
    setError('');
    const { error: err } = await supabase.from('tax_rates').update({ is_active: true }).eq('id', row.id).eq('business_id', business.id);
    if (err) setError(err.message);
    else load();
  };

  return (
    <SettingsLayout title="Tax Rates" subtitle="Manage tax percentages available for products, purchases, and sales.">
      <div className="settings-card">
        <div className="settings-card-header">
          <form onSubmit={add} style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input 
              className="settings-input" 
              placeholder="Tax name (e.g. GST)" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              style={{ maxWidth: '240px' }}
            />
            <input 
              className="settings-input" 
              type="number" step="0.01" min="0" max="100" 
              placeholder="Rate %" 
              value={rate} 
              onChange={(e) => setRate(e.target.value)} 
              style={{ maxWidth: '120px' }}
            />
            <button className="btn btn-primary" type="submit">Add Tax Rate</button>
          </form>
          {error && <div className="error-text" style={{ marginTop: '12px' }}>{error}</div>}
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>ID</th>
                <th>Name</th>
                <th>Rate</th>
                <th>Status</th>
                <th style={{ width: '160px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="muted table-empty">Loading…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={5} className="muted table-empty">No tax rates yet.</td></tr>}
              {!loading && rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.name}</td>
                  <td>
                    {editingId === row.id ? (
                      <input 
                        className="settings-input" 
                        type="number" step="0.01" min="0" max="100" 
                        value={editingRate} 
                        onChange={(e) => setEditingRate(e.target.value)} 
                        style={{ width: '100px', padding: '6px' }}
                      />
                    ) : (
                      `${Number(row.rate_percentage).toFixed(2)}%`
                    )}
                  </td>
                  <td>
                    {row.is_active ? <span className="badge badge-success">Active</span> : <span className="badge badge-danger">Inactive</span>}
                  </td>
                  <td className="table-actions">
                    {editingId === row.id ? (
                      <>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => saveEdit(row.id)}>Save</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={cancelEdit}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(row)}>Edit</button>
                        {row.is_active ? (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => deleteTaxRate(row)}>Deactivate</button>
                        ) : (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => activateTaxRate(row)}>Activate</button>
                        )}
                      </>
                    )}
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