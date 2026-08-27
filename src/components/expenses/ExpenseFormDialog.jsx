import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  EXPENSE_PAYMENT_METHODS,
  buildExpensePayload,
  emptyExpenseForm,
  expenseToForm,
} from '../../lib/expenseUtils.js';

export default function ExpenseFormDialog({
  open,
  onClose,
  onSaved,
  business,
  expenseId = null,
}) {
  const isEdit = !!expenseId;
  const [form, setForm] = useState(emptyExpenseForm(business?.time_zone));
  const [locations, setLocations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !business?.id) return;

    setError('');
    setLoading(isEdit);

    Promise.all([
      supabase
        .from('locations')
        .select('id, name')
        .eq('business_id', business.id)
        .eq('is_active', true),
      supabase
        .from('expense_categories')
        .select('id, name')
        .eq('business_id', business.id)
        .order('name'),
    ]).then(([locRes, catRes]) => {
      setLocations(locRes.data || []);
      setCategories(catRes.data || []);
    });

    if (!isEdit) {
      setForm(emptyExpenseForm(business?.time_zone));
      setLoading(false);
      return;
    }

    supabase
      .from('expenses')
      .select('*')
      .eq('id', expenseId)
      .single()
      .then(({ data, error: fetchErr }) => {
        if (fetchErr) setError(fetchErr.message);
        else if (data) setForm(expenseToForm(data, business?.time_zone));
        setLoading(false);
      });
  }, [open, business?.id, expenseId, isEdit]);

  useEffect(() => {
    if (!open || isEdit || locations.length !== 1) return;
    setForm((current) => (
      current.location_id ? current : { ...current, location_id: locations[0].id }
    ));
  }, [open, isEdit, locations]);

  if (!open) return null;

  const update = (key) => (e) => {
    setError(''); // clear error as soon as user types
    setForm((current) => ({ ...current, [key]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!business?.id) {
      setError('Business data not loaded yet. Please wait and try again.');
      return;
    }

    if (!form.title?.trim()) {
      setError('Expense title is required.');
      return;
    }
    if (!form.location_id || !form.category_id || !form.amount) {
      setError('Location, category, and amount are required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = buildExpensePayload(form, business.id);

      if (isEdit) {
        const { error: err } = await supabase
          .from('expenses')
          .update(payload)
          .eq('id', expenseId);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('expenses').insert(payload);
        if (err) throw err;
      }

      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.message || 'Could not save this expense.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="expense-backdrop" onClick={() => !submitting && onClose?.()} aria-hidden="true" />
      <div className="expense-modal" role="dialog" aria-modal="true" aria-labelledby="expense-form-title">
        <div className="expense-modal-panel" onClick={(e) => e.stopPropagation()}>
          <div className="expense-modal-header">
            <div>
              <h2 id="expense-form-title">{isEdit ? 'Edit expense' : 'Add expense'}</h2>
              <p className="muted">Operational business expenses only — not inventory purchases.</p>
            </div>
            <button
              type="button"
              className="expense-close-btn"
              onClick={() => !submitting && onClose?.()}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {loading ? (
            <div className="expense-modal-body"><div className="muted">Loading…</div></div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="expense-modal-body">
                <div className="expense-form-grid">
                  <div className="field field-full">
                    <label>Expense title *</label>
                    <input
                      value={form.title}
                      onChange={update('title')}
                      placeholder="e.g. March office rent"
                      required
                    />
                  </div>

                  <div className="field">
                    <label>Category *</label>
                    <select value={form.category_id} onChange={update('category_id')} required>
                      <option value="">Select category…</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>Business location *</label>
                    <select value={form.location_id} onChange={update('location_id')} required>
                      <option value="">Select location…</option>
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>Expense date *</label>
                    <input type="date" value={form.expense_date} onChange={update('expense_date')} required />
                  </div>

                  <div className="field">
                    <label>Amount *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.amount}
                      onChange={update('amount')}
                      required
                    />
                  </div>

                  <div className="field">
                    <label>Payment method</label>
                    <select value={form.payment_method} onChange={update('payment_method')}>
                      <option value="">Select method…</option>
                      {EXPENSE_PAYMENT_METHODS.map((method) => (
                        <option key={method} value={method}>{method}</option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>Status</label>
                    <select value={form.status} onChange={update('status')}>
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>Vendor (optional)</label>
                    <input value={form.vendor} onChange={update('vendor')} placeholder="Vendor or payee name" />
                  </div>

                  <div className="field">
                    <label>Reference number</label>
                    <input value={form.reference_number} onChange={update('reference_number')} placeholder="Invoice / receipt ref" />
                  </div>

                  <div className="field field-full">
                    <label>Notes</label>
                    <textarea
                      rows={3}
                      value={form.note}
                      onChange={update('note')}
                      placeholder="Additional details for this expense"
                    />
                  </div>

                  <div className="field field-full">
                    <label>Attachment</label>
                    <div className="expense-upload-zone">
                      <strong>Upload receipt or invoice</strong>
                      File upload will connect when document storage is enabled.
                      <input type="file" disabled style={{ display: 'none' }} />
                    </div>
                  </div>
                </div>

                {error && <div className="error-text" style={{ marginTop: 12 }}>{error}</div>}
              </div>

              <div className="expense-modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => onClose?.()} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add expense'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}