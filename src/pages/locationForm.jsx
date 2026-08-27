import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SettingsLayout from '../components/SettingsLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';

const emptyForm = { name: '', address: '', city: '', country: '', is_active: true };

export default function LocationForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { business } = useAuth();

  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit) return;
    supabase.from('locations').select('*').eq('id', id).single().then(({ data }) => {
      if (data) setForm({ ...emptyForm, ...data });
      setLoading(false);
    });
  }, [isEdit, id]);

  const update = (key) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name) { setError('Location name is required.'); return; }

    setSubmitting(true);
    try {
      const payload = {
        business_id: business.id,
        name: form.name,
        address: form.address || null,
        city: form.city || null,
        country: form.country || null,
        is_active: form.is_active,
      };
      if (isEdit) {
        const { error: err } = await supabase.from('locations').update(payload).eq('id', id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('locations').insert(payload);
        if (err) throw err;
      }
      navigate('/settings/locations');
    } catch (err) {
      setError(err.message || 'Could not save this location.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <SettingsLayout><div className="muted">Loading…</div></SettingsLayout>;

  return (
    <SettingsLayout title={isEdit ? 'Edit Location' : 'Add Location'} subtitle="Staff, products, and stock can be assigned to this location.">
      <form onSubmit={handleSubmit} className="settings-form">
        <section className="settings-card">
          <div className="settings-card-header">
            <h2>Location Details</h2>
          </div>
          <div className="settings-card-body">
            <div className="settings-grid">
              <div className="settings-field">
                <label>Name *</label>
                <input className="settings-input" value={form.name} onChange={update('name')} required />
              </div>
              <div className="settings-field">
                <label>City</label>
                <input className="settings-input" value={form.city} onChange={update('city')} />
              </div>
              <div className="settings-field">
                <label>Country</label>
                <input className="settings-input" value={form.country} onChange={update('country')} />
              </div>
              <div className="settings-field" style={{ gridColumn: '1 / -1' }}>
                <label>Address</label>
                <input className="settings-input" value={form.address} onChange={update('address')} />
              </div>
              <div className="settings-field" style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500 }}>
                  <input 
                    type="checkbox" 
                    checked={form.is_active} 
                    onChange={update('is_active')} 
                    style={{ width: 16, height: 16, accentColor: 'var(--navy-800)' }}
                  /> 
                  Active location
                </label>
              </div>
            </div>
          </div>
        </section>

        {error && <div className="error-text">{error}</div>}

        <div className="settings-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/settings/locations')}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add location'}</button>
        </div>
      </form>
    </SettingsLayout>
  );
}
