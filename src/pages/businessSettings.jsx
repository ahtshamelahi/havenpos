import { useEffect, useState } from 'react';
import SettingsLayout from '../components/SettingsLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';

const TIME_ZONES = Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : ['Asia/Karachi'];

export default function BusinessSettings() {
  const { business, refreshProfile } = useAuth();

  const [form, setForm] = useState(null);
  const [hasTransactions, setHasTransactions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!business?.id) return;
    setForm({
      business_name: business.business_name || '',
      business_start_date: business.business_start_date || '',
      currency: business.currency || '',
      website_link: business.website_link || '',
      contact_number: business.contact_number || '',
      alternate_contact: business.alternate_contact || '',
      country: business.country || '',
      state: business.state || '',
      city: business.city || '',
      zip_code: business.zip_code || '',
      landmark: business.landmark || '',
      time_zone: business.time_zone || 'Asia/Karachi',
    });

    // Currency is locked once the business has any sale or purchase.
    Promise.all([
      supabase.from('sales').select('id', { count: 'exact', head: true }).eq('business_id', business.id),
      supabase.from('purchases').select('id', { count: 'exact', head: true }).eq('business_id', business.id),
    ]).then(([salesRes, purchasesRes]) => {
      setHasTransactions((salesRes.count || 0) > 0 || (purchasesRes.count || 0) > 0);
      setLoading(false);
    });
  }, [business]);

  const update = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setSaved(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = { ...form };
      if (hasTransactions) delete payload.currency;
      payload.business_start_date = payload.business_start_date || null;
      payload.website_link = payload.website_link || null;
      payload.alternate_contact = payload.alternate_contact || null;
      payload.state = payload.state || null;
      payload.zip_code = payload.zip_code || null;
      payload.landmark = payload.landmark || null;

      const { error: err } = await supabase.from('businesses').update(payload).eq('id', business.id);
      if (err) throw err;
      await refreshProfile();
      setSaved(true);
    } catch (err) {
      setError(err.message || 'Could not save business settings.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !form) return <SettingsLayout><div className="muted">Loading…</div></SettingsLayout>;

  return (
    <SettingsLayout title="Business Profile" subtitle="Manage your company details and core settings.">
      <form onSubmit={handleSubmit} className="settings-form">
        <section className="settings-card">
          <div className="settings-card-header">
            <h2>General Information</h2>
          </div>
          <div className="settings-card-body">
            <div className="settings-grid">
              <div className="settings-field"><label>Business name *</label><input className="settings-input" value={form.business_name} onChange={update('business_name')} required /></div>
              <div className="settings-field">
                <label>Currency {hasTransactions && <span className="muted" style={{ fontWeight: 400 }}>(locked)</span>}</label>
                <input className="settings-input" value={form.currency} onChange={update('currency')} disabled={hasTransactions} required />
              </div>
              <div className="settings-field"><label>Contact number *</label><input className="settings-input" value={form.contact_number} onChange={update('contact_number')} required /></div>
              <div className="settings-field"><label>Alternate contact</label><input className="settings-input" value={form.alternate_contact} onChange={update('alternate_contact')} /></div>
              <div className="settings-field"><label>Website</label><input className="settings-input" value={form.website_link} onChange={update('website_link')} placeholder="https://" /></div>
              <div className="settings-field"><label>Time zone *</label>
                <select className="settings-select" value={form.time_zone} onChange={update('time_zone')} required>
                  {TIME_ZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
              <div className="settings-field"><label>Business start date</label><input className="settings-input" type="date" value={form.business_start_date} onChange={update('business_start_date')} /></div>
            </div>
            {hasTransactions && (
              <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>
                Currency cannot be changed once sales or purchases exist, as all stored totals are denominated in it.
              </p>
            )}
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-header">
            <h2>Address & Location</h2>
          </div>
          <div className="settings-card-body">
            <div className="settings-grid">
              <div className="settings-field"><label>Country *</label><input className="settings-input" value={form.country} onChange={update('country')} required /></div>
              <div className="settings-field"><label>State</label><input className="settings-input" value={form.state} onChange={update('state')} /></div>
              <div className="settings-field"><label>City *</label><input className="settings-input" value={form.city} onChange={update('city')} required /></div>
              <div className="settings-field"><label>ZIP code</label><input className="settings-input" value={form.zip_code} onChange={update('zip_code')} /></div>
              <div className="settings-field"><label>Landmark</label><input className="settings-input" value={form.landmark} onChange={update('landmark')} /></div>
            </div>
          </div>
        </section>

        {error && <div className="error-text">{error}</div>}
        
        <div className="settings-actions">
          {saved && <span className="badge badge-success" style={{ marginRight: 'auto', padding: '6px 12px' }}>Changes saved successfully.</span>}
          <button type="button" className="btn btn-secondary" onClick={() => window.location.reload()}>Discard</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>
    </SettingsLayout>
  );
}
