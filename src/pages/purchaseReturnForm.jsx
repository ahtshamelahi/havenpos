import { useEffect, useState, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';
import { fetchAllBatched } from '../lib/fetchUtils.js';

export default function PurchaseReturns() {
  const { business } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [purchases, setPurchases] = useState({});
  const [items, setItems] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!business?.id) return;
    setLoading(true);
    const [{ data: returnRows }, { data: purchaseRows }] = await Promise.all([
      fetchAllBatched(() => supabase.from('purchase_returns').select('*').eq('business_id', business.id).order('created_at', { ascending: false })),
      fetchAllBatched(() => supabase.from('purchases').select('id, supplier_id, contacts(name)').eq('business_id', business.id)),
    ]);
    setRows(returnRows || []);
    setPurchases(Object.fromEntries((purchaseRows || []).map((p) => [p.id, p])));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [business?.id]);

  const toggleExpand = async (returnId) => {
    if (expanded === returnId) { setExpanded(null); return; }
    setExpanded(returnId);
    if (!items[returnId]) {
      const { data } = await supabase
        .from('purchase_return_items')
        .select('*, purchase_items(product_id, products(name))')
        .eq('purchase_return_id', returnId);
      setItems((prev) => ({ ...prev, [returnId]: data || [] }));
    }
  };

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1>Purchase returns</h1>
          <p className="muted">Stock sent back to suppliers.</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/purchases')}>View all purchases</button>
      </div>

      <div className="card list-panel">
        <table className="data-table">
          <thead><tr><th></th><th>Date</th><th>Supplier</th><th>Reason</th><th>Amount</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="muted table-empty">Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={5} className="muted table-empty">No purchase returns yet.</td></tr>}
            {!loading && rows.map((r) => (
              <Fragment key={r.id}>
                <tr onClick={() => toggleExpand(r.id)} style={{ cursor: 'pointer' }}>
                  <td>{expanded === r.id ? '▾' : '▸'}</td>
                  <td>{r.return_date}</td>
                  <td>{purchases[r.purchase_id]?.contacts?.name || 'Cash / unspecified'}</td>
                  <td>{r.reason || '—'}</td>
                  <td>{business?.currency} {Number(r.total_amount).toFixed(2)}</td>
                </tr>
                {expanded === r.id && (
                  <tr>
                    <td colSpan={5} style={{ background: 'var(--navy-50)', padding: 0 }}>
                      <table className="data-table" style={{ margin: '4px 24px 12px' }}>
                        <thead><tr><th>Product</th><th>Qty returned</th><th>Amount</th></tr></thead>
                        <tbody>
                          {(items[r.id] || []).map((it) => (
                            <tr key={it.id}>
                              <td>{it.purchase_items?.products?.name || '—'}</td>
                              <td>
  {Math.max(0, Math.floor(Number(it.quantity_returned) || 0))}
</td>
                              <td>{business?.currency} {Number(it.amount).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}