import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';
import PrintReportHeader from '../components/PrintReportHeader.jsx';
import { computeRegisterSummary } from '../lib/registerUtils.js';
import { downloadPDF, buildPdfFilename } from '../utils/pdfGenerator.js';
import { CloseRegisterModal } from '../components/pos/RegisterModals.jsx';
import { formatTimestamp } from '../lib/timezone.js';

export default function RegisterReport({ registerId, hideLayout, isSidebarView, onRegisterClosed }) {
  const { id: paramId } = useParams();
  const id = registerId || paramId;
  const navigate = useNavigate();
  const { business } = useAuth();

  const [register, setRegister] = useState(null);
  const [locationName, setLocationName] = useState('');
  const [userName, setUserName] = useState('');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeSubmitting, setCloseSubmitting] = useState(false);

  useEffect(() => {
    if (!business?.id || !id) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');

      const { data: registerRow, error: regErr } = await supabase
        .from('registers')
        .select('*, locations(name), users(first_name, last_name)')
        .eq('id', id)
        .eq('business_id', business.id)
        .single();

      if (regErr || !registerRow) {
        if (!cancelled) {
          setError(regErr?.message || 'Register not found.');
          setLoading(false);
        }
        return;
      }

      // Everything below is scoped ONLY by register_id — nothing about
      // this report is stored on the registers row itself.
      const [{ data: sales }, { data: sellReturns }, { data: expenses }] = await Promise.all([
        supabase.from('sales').select('*').eq('register_id', id),
        supabase.from('sell_returns').select('*').eq('register_id', id),
        supabase.from('expenses').select('*').eq('register_id', id),
      ]);

      const saleIds = (sales || []).map((s) => s.id);
      let saleItems = [];
      if (saleIds.length > 0) {
        const { data: itemRows } = await supabase
          .from('sale_items')
          .select('*, products(name, sku)')
          .in('sale_id', saleIds);
        saleItems = itemRows || [];
      }

      if (cancelled) return;

      setRegister(registerRow);
      setLocationName(registerRow.locations?.name || '—');
      setUserName(
        `${registerRow.users?.first_name || ''} ${registerRow.users?.last_name || ''}`.trim() || '—'
      );

      setSummary(
        computeRegisterSummary({
          register: registerRow,
          sales: sales || [],
          sellReturns: sellReturns || [],
          expenses: expenses || [],
          saleItems,
        })
      );

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [business?.id, id]);

  const cur = business?.currency || '';
  const fmt = (n) => `${cur} ${Number(n || 0).toFixed(2)}`;

  if (loading) {
    const content = <div className="muted">Loading register report…</div>;
    return hideLayout ? content : <AppLayout>{content}</AppLayout>;
  }
  if (error) {
    const content = <div className="error-text">{error}</div>;
    return hideLayout ? content : <AppLayout>{content}</AppLayout>;
  }
  if (!register || !summary) return null;

  const diffColor =
    summary.cashDifference == null
      ? 'var(--navy-900)'
      : summary.cashDifference === 0
        ? 'var(--success)'
        : summary.cashDifference < 0
          ? 'var(--danger)'
          : 'var(--warning)';

  const content = (
    <div id="register-report-content">
      <div className="page-header no-print">
        <div>
          <h1>Register Report — #{register.id}</h1>
          <p className="muted">{locationName} · {userName}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => window.print()}>🖨 Print</button>
          <button
            className="btn btn-secondary"
            onClick={() => {
              const filename = buildPdfFilename('Register_Report', `Reg_${register.id}`);
              downloadPDF('register-report-content', filename);
            }}
          >
            📄 Save PDF
          </button>
          {isSidebarView && register.status === 'open' && (
            <button
              className="btn btn-danger"
              onClick={() => setShowCloseModal(true)}
            >
              Close Register
            </button>
          )}
          {!hideLayout && (
            <button className="btn btn-secondary" onClick={() => navigate('/registers')}>Back to Registers</button>
          )}
        </div>
      </div>

      <PrintReportHeader
        title={`Register Report #${register.id}`}
        filters={[
          { label: 'Location', value: locationName },
          { label: 'Opened by', value: userName },
          { label: 'Status', value: register.status },
        ]}
      />

      <div className="card" style={{ padding: '12px 16px', marginBottom: 16 }}>
        <div className="summary-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          <div className="summary-card" style={{ padding: '8px 12px', boxShadow: 'none' }}>
            <div className="summary-card-label" style={{ marginBottom: 4 }}>Opened</div>
            <div className="summary-card-value" style={{ fontSize: 14 }}>
              {formatTimestamp(register.opened_at, business?.time_zone)}
            </div>
          </div>
          <div className="summary-card" style={{ padding: '8px 12px', boxShadow: 'none' }}>
            <div className="summary-card-label" style={{ marginBottom: 4 }}>Closed</div>
            <div className="summary-card-value" style={{ fontSize: 14 }}>
              {register.closed_at ? formatTimestamp(register.closed_at, business?.time_zone) : 'Still open'}
            </div>
          </div>
          <div className="summary-card" style={{ padding: '8px 12px', boxShadow: 'none' }}>
            <div className="summary-card-label" style={{ marginBottom: 4 }}>User</div>
            <div className="summary-card-value" style={{ fontSize: 14 }}>{userName}</div>
          </div>
          <div className="summary-card" style={{ padding: '8px 12px', boxShadow: 'none' }}>
            <div className="summary-card-label" style={{ marginBottom: 4 }}>Location</div>
            <div className="summary-card-value" style={{ fontSize: 14 }}>{locationName}</div>
          </div>
        </div>
      </div>

      <div className="summary-grid" style={{ marginBottom: 16, gap: 10 }}>
        <div className="summary-card" style={{ padding: '10px 14px' }}>
          <div className="summary-card-label" style={{ marginBottom: 4 }}>Total Sales</div>
          <div className="summary-card-value" style={{ fontSize: 18 }}>{fmt(summary.totalSales)}</div>
        </div>
        <div className="summary-card summary-card-danger" style={{ padding: '10px 14px' }}>
          <div className="summary-card-label" style={{ marginBottom: 4 }}>Total Refund</div>
          <div className="summary-card-value" style={{ fontSize: 18 }}>{fmt(summary.totalRefund)}</div>
        </div>
        <div className="summary-card summary-card-success" style={{ padding: '10px 14px' }}>
          <div className="summary-card-label" style={{ marginBottom: 4 }}>Total Payment</div>
          <div className="summary-card-value" style={{ fontSize: 18 }}>{fmt(summary.totalPayment)}</div>
        </div>
        <div className="summary-card summary-card-warning" style={{ padding: '10px 14px' }}>
          <div className="summary-card-label" style={{ marginBottom: 4 }}>Credit Sales</div>
          <div className="summary-card-value" style={{ fontSize: 18 }}>{fmt(summary.creditSales)}</div>
        </div>
        <div className="summary-card summary-card-info" style={{ padding: '10px 14px' }}>
          <div className="summary-card-label" style={{ marginBottom: 4 }}>Total Expense</div>
          <div className="summary-card-value" style={{ fontSize: 18 }}>{fmt(summary.totalExpense)}</div>
        </div>
        <div className="summary-card" style={{ padding: '10px 14px' }}>
          <div className="summary-card-label" style={{ marginBottom: 4 }}>Cash Sales</div>
          <div className="summary-card-value" style={{ fontSize: 18 }}>{fmt(summary.cashSales)}</div>
        </div>
        <div className="summary-card" style={{ padding: '10px 14px' }}>
          <div className="summary-card-label" style={{ marginBottom: 4 }}>Card Sales</div>
          <div className="summary-card-value" style={{ fontSize: 18 }}>{fmt(summary.cardSales)}</div>
        </div>
        <div className="summary-card" style={{ padding: '10px 14px' }}>
          <div className="summary-card-label" style={{ marginBottom: 4 }}>Other Tender</div>
          <div className="summary-card-value" style={{ fontSize: 18 }}>{fmt(summary.otherTenderSales)}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        {/* Payment Methods breakdown */}
        <div className="card" style={{ padding: 20, flex: '1 1 320px' }}>
          <h2 style={{ fontSize: 15, marginBottom: 12 }}>Payment Methods</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '5px 0', color: 'var(--text-secondary)' }}>💵 Cash</td>
                <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 600 }}>{fmt(summary.cashSales)}</td>
              </tr>
              <tr>
                <td style={{ padding: '5px 0', color: 'var(--text-secondary)' }}>💳 Card</td>
                <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 600 }}>{fmt(summary.cardSales)}</td>
              </tr>
              {summary.otherTenderSales > 0 && (
                <tr>
                  <td style={{ padding: '5px 0', color: 'var(--text-secondary)' }}>🏦 Other</td>
                  <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 600 }}>{fmt(summary.otherTenderSales)}</td>
                </tr>
              )}
              {summary.creditSales > 0 && (
                <tr>
                  <td style={{ padding: '5px 0', color: 'var(--text-secondary)' }}>🔖 Credit / Due</td>
                  <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 600 }}>{fmt(summary.creditSales)}</td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="totals-grand" style={{ marginTop: 8, maxWidth: 'none', marginLeft: 0 }}>
            <span>Total Collected</span>
            <span>{fmt(summary.totalPayment)}</span>
          </div>
          {summary.totalRefund > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--danger)', marginTop: 6 }}>
              <span>- Refunds</span>
              <span style={{ fontWeight: 600 }}>{fmt(summary.totalRefund)}</span>
            </div>
          )}
        </div>

        {/* Cash Drawer reconciliation */}
        <div className="card" style={{ padding: 20, flex: '1 1 280px' }}>
          <h2 style={{ fontSize: 15, marginBottom: 12 }}>Cash Drawer</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '4px 0', color: 'var(--text-secondary)' }}>Opening cash</td>
                <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>{fmt(summary.openingCash)}</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 0', color: 'var(--text-secondary)' }}>+ Cash sales</td>
                <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>{fmt(summary.cashSales)}</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 0', color: 'var(--text-secondary)' }}>- Cash refunds</td>
                <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>{fmt(summary.cashRefunds)}</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 0', color: 'var(--text-secondary)' }}>- Cash expenses</td>
                <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>{fmt(summary.cashExpenses)}</td>
              </tr>
            </tbody>
          </table>

          <div className="totals-grand" style={{ marginTop: 8, maxWidth: 'none', marginLeft: 0 }}>
            <span>Expected cash</span>
            <span>{fmt(summary.expectedCash)}</span>
          </div>

          {summary.actualClosingCash != null && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
                <span>Actual closing cash</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{fmt(summary.actualClosingCash)}</span>
              </div>
              <div
                className="totals-grand"
                style={{ marginTop: 4, maxWidth: 'none', marginLeft: 0, color: diffColor }}
              >
                <span>Cash difference</span>
                <span>{summary.cashDifference > 0 ? '+' : ''}{fmt(summary.cashDifference)}</span>
              </div>
            </>
          )}

          {register.status === 'open' && (
            <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
              Register is still open — figures will keep changing until it's closed.
            </p>
          )}
        </div>
      </div>


      <div className="card list-panel">
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-light)', fontWeight: 700 }}>
          Products sold ({summary.productsSold.length})
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product</th>
              <th>Quantity</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {summary.productsSold.length === 0 && (
              <tr>
                <td colSpan={4} className="muted table-empty">
                  No products sold in this register session.
                </td>
              </tr>
            )}
            {summary.productsSold.map((p) => (
              <tr key={p.product_id}>
                <td>{p.sku}</td>
                <td>{p.name}</td>
                <td>{p.quantity}</td>
                <td>{fmt(p.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <>
      {hideLayout ? content : <AppLayout>{content}</AppLayout>}
      {showCloseModal && register && (
        <CloseRegisterModal
          register={register}
          business={business}
          submitting={closeSubmitting}
          onCancel={() => setShowCloseModal(false)}
          onConfirm={async (amt) => {
            setCloseSubmitting(true);
            try {
              await supabase
                .from('registers')
                .update({
                  closing_cash: Number(amt) || 0,
                  status: 'closed',
                  closed_at: new Date().toISOString(),
                })
                .eq('id', register.id);
              setShowCloseModal(false);
              if (onRegisterClosed) onRegisterClosed();
              else navigate(`/registers/${register.id}`);
            } catch (err) {
              alert(err.message || 'Could not close register.');
            } finally {
              setCloseSubmitting(false);
            }
          }}
        />
      )}
    </>
  );
}
