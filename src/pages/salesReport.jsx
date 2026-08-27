import { useEffect, useMemo, useState } from 'react';
import AppLayout from '../components/AppLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';
import { fetchAllBatched } from '../lib/fetchUtils.js';
import { PRESETS, getPresetRange } from '../lib/dateRanges.js';
import PrintReportHeader from '../components/PrintReportHeader.jsx';
import { downloadPDF, buildPdfFilename } from '../utils/pdfGenerator.js';

/* ─────────────────────────────────────────────────────────────
   Shared scoped styles — injected once, self-contained.
   ───────────────────────────────────────────────────────────── */
const CSS = `
  .sr-wrapper {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: -8px;
  }
  .sr-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    background: var(--white);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    padding: 8px 14px;
    box-shadow: var(--shadow-sm);
  }
  .sr-toolbar-left { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
  .sr-toolbar-right { display:flex; align-items:center; gap:8px; }
  .sr-title { font-size:18px; font-weight:700; color:var(--navy-900); margin-right:8px; }

  .sr-preset-pills { display:flex; gap:4px; flex-wrap:wrap; }
  .sr-pill {
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    border: 1px solid var(--navy-border);
    background: var(--white);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.12s ease;
    white-space: nowrap;
  }
  .sr-pill:hover { background: var(--navy-50); color: var(--navy-900); }
  .sr-pill.active { background: var(--navy-800); color: var(--white); border-color: var(--navy-800); }

  .sr-filter-item { display:flex; align-items:center; gap:4px; }
  .sr-filter-item label { font-size:11px; font-weight:600; color:var(--text-secondary); }
  .sr-select, .sr-date {
    padding: 5px 8px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--navy-border);
    font-size: 12px;
    background: var(--white);
    outline: none;
  }

  .sr-panels {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .sr-panel {
    background: var(--white);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-light);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }
  .sr-panel-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border-light);
  }
  .sr-panel-icon {
    width: 28px; height: 28px;
    border-radius: var(--radius-sm);
    display: flex; align-items: center; justify-content: center;
    font-size: 15px;
  }
  .sr-panel-icon.purchase { background: var(--info-bg); }
  .sr-panel-icon.sale     { background: var(--success-bg); }
  .sr-panel-title { font-size: 14px; font-weight: 700; color: var(--navy-900); }
  .sr-panel-body { padding: 10px 14px; }

  .sr-metrics { display: flex; flex-direction: column; gap: 0; }
  .sr-metric-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px dashed var(--navy-50);
  }
  .sr-metric-row:last-child { border-bottom: none; padding-bottom: 4px; }
  .sr-metric-label { font-size: 13px; color: var(--text-secondary); }
  .sr-metric-value { font-size: 13px; font-weight: 700; color: var(--text-primary); }
  .sr-metric-value.danger { color: var(--danger); }
  .sr-metric-value.warning { color: var(--warning); }
  .sr-metric-value.success { color: var(--success); }

  .sr-divider {
    height: 1px;
    background: var(--border-light);
    margin: 8px 0;
  }
  .sr-total-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 10px;
    background: var(--navy-50);
    border-radius: var(--radius-sm);
    margin-top: 6px;
  }
  .sr-total-label { font-size: 13px; font-weight: 700; color: var(--navy-900); }
  .sr-total-value { font-size: 15px; font-weight: 800; color: var(--navy-900); }

  .sr-skeleton { height: 16px; background: var(--navy-50); border-radius:4px; margin:8px 0; animation: srpulse 1.4s ease infinite; }
  @keyframes srpulse { 0%,100%{opacity:1} 50%{opacity:.45} }

  @media (max-width: 768px) {
    .sr-panels { grid-template-columns: 1fr; }
    .sr-toolbar { flex-direction: column; align-items: flex-start; }
    .sr-toolbar-right { width: 100%; justify-content: flex-end; }
  }
  @media print {
    .no-print { display: none !important; }
    .sr-panel { box-shadow: none; border: 1px solid #ddd; }
    .sr-panels { grid-template-columns: 1fr 1fr; gap: 16px; }
  }
`;

export default function SalesPurchasesReport() {
  const { business } = useAuth();

  /* ── Filters ── */
  const [activePreset, setActivePreset] = useState('this_month');
  const [range, setRange] = useState(getPresetRange('this_month', business?.time_zone));
  const [locationId, setLocationId] = useState('');
  const [locations, setLocations] = useState([]);

  /* ── Raw data ── */
  const [sales, setSales] = useState([]);
  const [sellReturns, setSellReturns] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [purchaseReturns, setPurchaseReturns] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ── Load locations once ── */
  useEffect(() => {
    if (!business?.id) return;
    supabase
      .from('locations')
      .select('id, name')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .then(({ data }) => setLocations(data || []));
  }, [business?.id]);

  /* ── Load transactional data whenever filters change ── */
  useEffect(() => {
    if (!business?.id) return;
    setLoading(true);

    const applyDateLoc = (q, dateCol) => {
      if (range.from) q = q.gte(dateCol, range.from);
      if (range.to) q = q.lte(dateCol, range.to);
      if (locationId) q = q.eq('location_id', Number(locationId));
      return q;
    };

    Promise.all([
      fetchAllBatched(() =>
        applyDateLoc(
          supabase
            .from('sales')
            .select('id, grand_total, tax_amount, due_amount, status')
            .eq('business_id', business.id)
            .in('status', ['confirmed', 'shipped', 'returned', 'partially_returned']),
          'sale_date'
        )
      ),
      // sell_returns has no location_id or grand_total column of its own —
      // pull the location through the parent sale instead, and use the
      // correct amount column (total_amount).
      fetchAllBatched(() => {
        let q = supabase
          .from('sell_returns')
          .select('id, total_amount, return_date, sale_id, sales(location_id)')
          .eq('business_id', business.id);
        if (range.from) q = q.gte('return_date', range.from);
        if (range.to) q = q.lte('return_date', range.to);
        return q;
      }),
      fetchAllBatched(() =>
        applyDateLoc(
          supabase
            .from('purchases')
            .select('id, grand_total, tax_amount, due_amount, purchase_status, location_id')
            .eq('business_id', business.id)
            .eq('purchase_status', 'received'),
          'purchase_date'
        )
      ),
      // purchase_returns has no location_id of its own — pull it through
      // the parent purchase instead, same pattern as sell_returns above.
      fetchAllBatched(() => {
        let q = supabase
          .from('purchase_returns')
          .select('id, total_amount, return_date, purchase_id, purchases(location_id)')
          .eq('business_id', business.id);
        if (range.from) q = q.gte('return_date', range.from);
        if (range.to) q = q.lte('return_date', range.to);
        return q;
      }),
    ]).then(([salesRes, sellRetRes, purchRes, purchRetRes]) => {
      setSales(salesRes.data || []);

      const sellReturnsFiltered = (sellRetRes.data || []).filter((sr) => {
        if (!locationId) return true;
        return String(sr.sales?.location_id) === String(locationId);
      });
      setSellReturns(sellReturnsFiltered);

      setPurchases(purchRes.data || []);

      const purchaseReturnsFiltered = (purchRetRes.data || []).filter((pr) => {
        if (!locationId) return true;
        return String(pr.purchases?.location_id) === String(locationId);
      });
      setPurchaseReturns(purchaseReturnsFiltered);

      setLoading(false);
    });
  }, [business?.id, range, locationId]);

  const handlePreset = (key) => {
    setActivePreset(key);
    if (key !== 'custom') setRange(getPresetRange(key, business?.time_zone));
  };

  /* ── Computed summaries ── */
  const s = useMemo(() => {
    const totalSales = sales.reduce((a, r) => a + Number(r.grand_total || 0), 0);
    const salesTax = sales.reduce((a, r) => a + Number(r.tax_amount || 0), 0);
    const salesIncTax = totalSales; // grand_total already includes tax
    const totalSellReturn = sellReturns.reduce((a, r) => a + Number(r.total_amount || 0), 0);
    const saleDue = sales.reduce((a, r) => a + Number(r.due_amount || 0), 0);

    const totalPurchases = purchases.reduce((a, r) => a + Number(r.grand_total || 0), 0);
    const purchaseTax = purchases.reduce((a, r) => a + Number(r.tax_amount || 0), 0);
    const purchaseIncTax = totalPurchases; // grand_total already includes tax
    const totalPurchaseReturn = purchaseReturns.reduce((a, r) => a + Number(r.total_amount || 0), 0);
    const purchaseDue = purchases.reduce((a, r) => a + Number(r.due_amount || 0), 0);

    return {
      totalSales, salesTax, salesIncTax, totalSellReturn, saleDue,
      totalPurchases, purchaseTax, purchaseIncTax, totalPurchaseReturn, purchaseDue,
    };
  }, [sales, sellReturns, purchases, purchaseReturns]);

  const cur = business?.currency || '';
  const fmt = (n) => `${cur} ${Number(n).toFixed(2)}`;

  const Skeleton = () => (
    <>
      <div className="sr-skeleton" style={{ width: '80%' }} />
      <div className="sr-skeleton" style={{ width: '60%' }} />
      <div className="sr-skeleton" style={{ width: '70%' }} />
      <div className="sr-skeleton" style={{ width: '50%' }} />
    </>
  );

  return (
    <AppLayout>
      <style>{CSS}</style>

      <div className="sr-wrapper">
        {/* ── Standardized Print Header (print-only) ── */}
        <PrintReportHeader
          title="Sales & Purchase Report"
          filters={[
            {
              label: 'Period',
              value: activePreset === 'custom'
                ? `${range.from || 'Start'} to ${range.to || 'End'}`
                : (PRESETS.find(p => p.key === activePreset)?.label || activePreset),
            },
            {
              label: 'Location',
              value: locations.find(l => String(l.id) === String(locationId))?.name || 'All Locations',
            },
          ]}
        />
        {/* ── Toolbar ── */}
        <div className="sr-toolbar no-print">
          <div className="sr-toolbar-left">
            <span className="sr-title">Sales &amp; Purchase Report</span>

            {/* Date preset pills */}
            <div className="sr-preset-pills">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  className={`sr-pill ${activePreset === p.key ? 'active' : ''}`}
                  onClick={() => handlePreset(p.key)}
                >
                  {p.label}
                </button>
              ))}
              <button
                className={`sr-pill ${activePreset === 'custom' ? 'active' : ''}`}
                onClick={() => handlePreset('custom')}
              >
                Custom
              </button>
            </div>

            {/* Custom date pickers */}
            {activePreset === 'custom' && (
              <div className="sr-filter-item">
                <input
                  type="date"
                  className="sr-date"
                  value={range.from || ''}
                  onChange={(e) => setRange({ from: e.target.value, to: range.to })}
                />
                <span className="muted" style={{ fontSize: 11 }}>–</span>
                <input
                  type="date"
                  className="sr-date"
                  value={range.to || ''}
                  onChange={(e) => setRange({ from: range.from, to: e.target.value })}
                />
              </div>
            )}

            {/* Location filter */}
            {locations.length > 0 && (
              <div className="sr-filter-item">
                <label htmlFor="sr-loc">Location</label>
                <select
                  id="sr-loc"
                  className="sr-select"
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                >
                  <option value="">All locations</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="sr-toolbar-right">
            <button className="btn btn-secondary btn-sm" onClick={() => window.print()} style={{ marginRight: '8px' }}>
              🖨️ Print
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                const period = activePreset === 'custom'
                  ? `${range.from || 'Start'} to ${range.to || 'End'}`
                  : (PRESETS.find(p => p.key === activePreset)?.label || activePreset);
                const locName = locations.find(l => String(l.id) === String(locationId))?.name || 'All Locations';
                downloadPDF(buildPdfFilename('Sales And Purchase Report', [{ value: period }, { value: locName }]));
              }}
            >
              📄 Save PDF
            </button>
          </div>
        </div>

        {/* ── Side-by-side Panels ── */}
        <div className="sr-panels">

          {/* PURCHASE PANEL */}
          <div className="sr-panel">
            <div className="sr-panel-head">
              <div className="sr-panel-icon purchase">📦</div>
              <span className="sr-panel-title">Purchase Report</span>
            </div>
            <div className="sr-panel-body">
              {loading ? <Skeleton /> : (
                <div className="sr-metrics">
                  <div className="sr-metric-row">
                    <span className="sr-metric-label">Total Purchase</span>
                    <span className="sr-metric-value">{fmt(s.totalPurchases)}</span>
                  </div>
                  <div className="sr-metric-row">
                    <span className="sr-metric-label">Purchase Including Tax</span>
                    <span className="sr-metric-value">{fmt(s.purchaseIncTax)}</span>
                  </div>
                  <div className="sr-metric-row">
                    <span className="sr-metric-label">Tax Amount</span>
                    <span className="sr-metric-value warning">{fmt(s.purchaseTax)}</span>
                  </div>
                  <div className="sr-metric-row">
                    <span className="sr-metric-label">Total Purchase Return (inc. tax)</span>
                    <span className="sr-metric-value danger">- {fmt(s.totalPurchaseReturn)}</span>
                  </div>
                  <div className="sr-metric-row">
                    <span className="sr-metric-label">Purchase Due</span>
                    <span className="sr-metric-value danger">{fmt(s.purchaseDue)}</span>
                  </div>
                  <div className="sr-divider" />
                  <div className="sr-total-row">
                    <span className="sr-total-label">Net Purchase</span>
                    <span className="sr-total-value">
                      {fmt(s.totalPurchases - s.totalPurchaseReturn)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SALES PANEL */}
          <div className="sr-panel">
            <div className="sr-panel-head">
              <div className="sr-panel-icon sale">💵</div>
              <span className="sr-panel-title">Sales Report</span>
            </div>
            <div className="sr-panel-body">
              {loading ? <Skeleton /> : (
                <div className="sr-metrics">
                  <div className="sr-metric-row">
                    <span className="sr-metric-label">Total Sales</span>
                    <span className="sr-metric-value">{fmt(s.totalSales)}</span>
                  </div>
                  <div className="sr-metric-row">
                    <span className="sr-metric-label">Sale Including Tax</span>
                    <span className="sr-metric-value">{fmt(s.salesIncTax)}</span>
                  </div>
                  <div className="sr-metric-row">
                    <span className="sr-metric-label">Tax Amount</span>
                    <span className="sr-metric-value warning">{fmt(s.salesTax)}</span>
                  </div>
                  <div className="sr-metric-row">
                    <span className="sr-metric-label">Total Sell Return (inc. tax)</span>
                    <span className="sr-metric-value danger">- {fmt(s.totalSellReturn)}</span>
                  </div>
                  <div className="sr-metric-row">
                    <span className="sr-metric-label">Sale Due</span>
                    <span className="sr-metric-value danger">{fmt(s.saleDue)}</span>
                  </div>
                  <div className="sr-divider" />
                  <div className="sr-total-row">
                    <span className="sr-total-label">Net Sales</span>
                    <span className="sr-total-value success" style={{ color: 'var(--success)' }}>
                      {fmt(s.totalSales - s.totalSellReturn)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}