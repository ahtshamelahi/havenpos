import { useEffect, useState } from 'react';
import SettingsLayout from '../components/SettingsLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';

const emptyForm = {
  invoice_prefix: 'INV-',
  invoice_footer_note: '',
  invoice_terms: '',
  receipt_footer_note: 'Thank you for your business!',
  receipt_show_tax_breakdown: true,
};

export default function InvoiceReceiptSettings() {
  const { business, refreshProfile } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!business) return;
    setForm({ ...emptyForm, ...(business.settings || {}) });
    setLoading(false);
  }, [business]);

  const update = (key) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: val }));
    setSaved(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const mergedSettings = { ...(business.settings || {}), ...form };
      const { error: err } = await supabase.from('businesses').update({ settings: mergedSettings }).eq('id', business.id);
      if (err) throw err;
      await refreshProfile();
      setSaved(true);
    } catch (err) {
      setError(err.message || 'Could not save these settings.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <SettingsLayout><div className="muted">Loading…</div></SettingsLayout>;

  return (
    <SettingsLayout title="Invoice & Receipt Settings" subtitle="Configure text and defaults printed on your documents.">
      <form onSubmit={handleSubmit} className="settings-form">
        <section className="settings-card">
          <div className="settings-card-header">
            <h2>Invoices</h2>
          </div>
          <div className="settings-card-body">
            <div className="settings-grid">
              <div className="settings-field">
                <label>Invoice number prefix</label>
                <input className="settings-input" value={form.invoice_prefix} onChange={update('invoice_prefix')} placeholder="INV-" />
              </div>
              <div className="settings-field" style={{ gridColumn: '1 / -1' }}>
                <label>Footer note</label>
                <input className="settings-input" value={form.invoice_footer_note} onChange={update('invoice_footer_note')} placeholder="e.g. Payment due within 15 days" />
              </div>
              <div className="settings-field" style={{ gridColumn: '1 / -1' }}>
                <label>Terms & conditions</label>
                <input className="settings-input" value={form.invoice_terms} onChange={update('invoice_terms')} />
              </div>
            </div>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-header">
            <h2>POS Receipts</h2>
          </div>
          <div className="settings-card-body">
            <div className="settings-grid">
              <div className="settings-field" style={{ gridColumn: '1 / -1' }}>
                <label>Footer note</label>
                <input className="settings-input" value={form.receipt_footer_note} onChange={update('receipt_footer_note')} />
              </div>
              <div className="settings-field" style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500 }}>
                  <input 
                    type="checkbox" 
                    checked={form.receipt_show_tax_breakdown} 
                    onChange={update('receipt_show_tax_breakdown')} 
                    style={{ width: 16, height: 16, accentColor: 'var(--navy-800)' }}
                  /> 
                  Show tax breakdown on receipts
                </label>
              </div>
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
