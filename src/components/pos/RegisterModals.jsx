import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { computeRegisterSummary } from '../../lib/registerUtils.js';

/**
 * Shown when a location has no open register — required before POS Billing
 * will accept a sale. Reuses the existing .pos-modal / .pos-modal-form /
 * .field / .btn classes already defined in posBilling.css and index.css.
 */
export function OpenRegisterModal({ locationName, onConfirm, onCancel, submitting }) {
  const [openingCash, setOpeningCash] = useState('0');
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const amt = Number(openingCash);
    if (openingCash === '' || Number.isNaN(amt) || amt < 0) {
      setError('Enter a valid opening cash amount.');
      return;
    }
    setError('');
    onConfirm(amt);
  };

  return (
    <div className="pos-modal-backdrop">
      <div className="pos-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Open register — {locationName}</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: -6 }}>
          Count the cash currently in the drawer before you start selling.
        </p>

        <form onSubmit={submit} className="pos-modal-form">
          <div className="field">
            <label>Opening cash *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              autoFocus
              value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
            />
          </div>

          {error && <div className="error-text">{error}</div>}

          <div className="pos-modal-actions">
            {onCancel && (
              <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={submitting}>
                Cancel
              </button>
            )}
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Opening…' : 'Open register'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Shown when closing the current register. Live-calculates expected cash
 * from everything posted against this register_id so far, then asks for
 * the actual counted cash. The cash difference itself is only computed
 * once (on the Register Report) after closing_cash is saved.
 */
export function CloseRegisterModal({ register, business, onConfirm, onCancel, submitting }) {
  const [closingCash, setClosingCash] = useState('');
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      setLoadingSummary(true);

      const [{ data: sales }, { data: sellReturns }, { data: expenses }] = await Promise.all([
        supabase.from('sales').select('*').eq('register_id', register.id),
        supabase.from('sell_returns').select('*').eq('register_id', register.id),
        supabase.from('expenses').select('*').eq('register_id', register.id),
      ]);

      if (cancelled) return;

      setSummary(
        computeRegisterSummary({
          register,
          sales: sales || [],
          sellReturns: sellReturns || [],
          expenses: expenses || [],
          saleItems: [],
        })
      );
      setLoadingSummary(false);
    }

    loadSummary();
    return () => {
      cancelled = true;
    };
  }, [register]);

  const submit = (e) => {
    e.preventDefault();
    const amt = Number(closingCash);
    if (closingCash === '' || Number.isNaN(amt) || amt < 0) {
      setError('Enter a valid closing cash amount.');
      return;
    }
    setError('');
    onConfirm(amt);
  };

  const cur = business?.currency || '';
  const fmt = (n) => `${cur} ${Number(n || 0).toFixed(2)}`;

  return (
    <div className="pos-modal-backdrop">
      <div className="pos-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Close register</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: -6 }}>
          Opened {new Date(register.opened_at).toLocaleString()}
        </p>

        {loadingSummary || !summary ? (
          <div className="muted" style={{ padding: '12px 0' }}>
            Calculating summary…
          </div>
        ) : (
          <div style={{ marginTop: 10, marginBottom: 4 }}>
            {/* Payment breakdown */}
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
              Payment Methods
            </div>
            <div className="totals-summary" style={{ maxWidth: 'none', marginLeft: 0, marginBottom: 10 }}>
              <div><span>💵 Cash</span><span>{fmt(summary.cashSales)}</span></div>
              <div><span>💳 Card</span><span>{fmt(summary.cardSales)}</span></div>
              {summary.otherTenderSales > 0 && (
                <div><span>🏦 Other</span><span>{fmt(summary.otherTenderSales)}</span></div>
              )}
              {summary.creditSales > 0 && (
                <div><span>🔖 Credit / Due</span><span>{fmt(summary.creditSales)}</span></div>
              )}
            </div>
            <div className="totals-grand" style={{ maxWidth: 'none', marginLeft: 0, marginBottom: 10 }}>
              <span>Total Collected</span>
              <span>{fmt(summary.totalPayment)}</span>
            </div>

            {/* Cash drawer */}
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
              Cash Drawer
            </div>
            <div className="totals-summary" style={{ maxWidth: 'none', marginLeft: 0, marginBottom: 4 }}>
              <div><span>Opening cash</span><span>{fmt(summary.openingCash)}</span></div>
              <div><span>+ Cash sales</span><span>{fmt(summary.cashSales)}</span></div>
              <div><span>- Cash refunds</span><span>- {fmt(summary.cashRefunds)}</span></div>
              <div><span>- Cash expenses</span><span>- {fmt(summary.cashExpenses)}</span></div>
            </div>
            <div className="totals-grand" style={{ maxWidth: 'none', marginLeft: 0 }}>
              <span>Expected cash</span>
              <span>{fmt(summary.expectedCash)}</span>
            </div>
          </div>
        )}

        <form onSubmit={submit} className="pos-modal-form">
          <div className="field">
            <label>Actual closing cash (counted) *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              autoFocus
              value={closingCash}
              onChange={(e) => setClosingCash(e.target.value)}
            />
          </div>

          {error && <div className="error-text">{error}</div>}

          <div className="pos-modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Closing…' : 'Close register'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
