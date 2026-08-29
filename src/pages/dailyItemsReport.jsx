import { useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '../components/AppLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';
import { fetchAllBatched } from '../lib/fetchUtils.js';
import { getPresetRange } from '../lib/dateRanges.js';
import { todayLocal } from '../lib/timezone.js';
import PrintReportHeader from '../components/PrintReportHeader.jsx';
import { downloadPDF, buildPdfFilename } from '../utils/pdfGenerator.js';
import useLocationScope from '../hooks/useLocationScope.js';

// ─── Presets ────────────────────────────────────────────────
const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_week', label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'custom_date', label: 'Custom Date' },
  { key: 'custom_range', label: 'Custom Range' },
];

// toStr is replaced by todayLocal in usage

function fmtDate(str) {
  if (!str) return '—';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtMoney(n, currency) {
  return `${currency || ''} ${Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`.trim();
}

// ─── Scoped CSS ──────────────────────────────────────────────
const CSS = `
  .dir-wrapper { display:flex; flex-direction:column; gap:14px; margin-top:-8px; }

  .dir-toolbar {
    display:flex; justify-content:space-between; align-items:center;
    flex-wrap:wrap; gap:10px;
    background:var(--white); border:1px solid var(--border-light);
    border-radius:var(--radius-md); padding:10px 16px; box-shadow:var(--shadow-sm);
  }
  .dir-toolbar-left  { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .dir-toolbar-right { display:flex; align-items:center; gap:8px; }
  .dir-title { font-size:18px; font-weight:700; color:var(--navy-900); margin-right:4px; }

  .dir-pills { display:flex; gap:4px; flex-wrap:wrap; }
  .dir-pill {
    padding:4px 11px; border-radius:20px; font-size:12px; font-weight:600;
    border:1px solid var(--navy-border); background:var(--white);
    color:var(--text-secondary); cursor:pointer; transition:all 0.12s; white-space:nowrap;
  }
  .dir-pill:hover { background:var(--navy-50); color:var(--navy-900); }
  .dir-pill.active { background:var(--navy-800); color:var(--white); border-color:var(--navy-800); }

  .dir-date {
    padding:5px 9px; border-radius:var(--radius-sm);
    border:1px solid var(--navy-border); font-size:12px;
    background:var(--white); outline:none; color:var(--navy-900);
  }
  .dir-date:focus { border-color:var(--navy-500); }
  .dir-label { font-size:12px; color:var(--text-secondary); font-weight:600; }

  .dir-summary { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
  .dir-card {
    background:var(--white); padding:18px 20px;
    border-radius:var(--radius-md); border:1px solid var(--border-light);
    box-shadow:var(--shadow-sm);
  }
  .dir-card-label { font-size:13px; color:var(--text-secondary); font-weight:600; margin-bottom:4px; }
  .dir-card-value { font-size:24px; font-weight:800; color:var(--navy-900); }
  .dir-card-sub   { font-size:12px; color:var(--text-secondary); margin-top:3px; }

  .dir-panel {
    background:var(--white); border-radius:var(--radius-md);
    border:1px solid var(--border-light); box-shadow:var(--shadow-sm); overflow:hidden;
  }
  .dir-panel-header {
    display:flex; justify-content:space-between; align-items:center;
    padding:14px 18px; border-bottom:1px solid var(--border-light); background:var(--navy-50);
  }
  .dir-panel-title { font-size:15px; font-weight:700; color:var(--navy-900); }
  .dir-panel-meta  { font-size:12px; color:var(--text-secondary); }

  .dir-table { width:100%; border-collapse:collapse; font-size:13px; }
  .dir-table th, .dir-table td {
    padding:10px 14px; text-align:left; border-bottom:1px solid var(--border-light);
  }
  .dir-table th {
    background:var(--navy-50); font-weight:700; color:var(--text-secondary);
    font-size:12px; text-transform:uppercase; letter-spacing:0.04em;
    cursor:pointer; user-select:none; white-space:nowrap;
  }
  .dir-table th:hover { color:var(--navy-900); }
  .dir-table th.sorted { color:var(--navy-800); }
  .dir-table tr:last-child td { border-bottom:none; }
  .dir-table tbody tr:hover td { background:var(--navy-50); }
  .dir-table td.num, .dir-table th.num { text-align:right; font-variant-numeric:tabular-nums; }
  .dir-rank { color:var(--text-secondary); font-weight:600; }
  .dir-sku  { color:var(--text-secondary); font-size:11px; }

  .dir-tfoot td {
    background:var(--navy-50) !important; font-weight:700; color:var(--navy-900);
    border-top:2px solid var(--border-light); border-bottom:none;
  }

  .dir-sort-arrow { margin-left:4px; opacity:0.4; font-size:10px; }
  .dir-sort-arrow.active { opacity:1; }

  .dir-empty { padding:48px; text-align:center; color:var(--text-secondary); font-size:14px; }

  .print-only { display:none; }

  @media print {
    .no-print, .AppHeader, .AppSidebar, .dir-toolbar { display:none !important; }
    .print-only { display:block !important; }
    .AppMain { margin:0 !important; padding:0 !important; }
    .dir-card, .dir-panel { box-shadow:none !important; border:1px solid #ddd !important; }
    .dir-summary { grid-template-columns:repeat(3,1fr) !important; }
    .dir-table th, .dir-table td { padding:7px 10px; }
  }
`;

// ─── Component ───────────────────────────────────────────────
export default function DailyItemsReport() {
  const { business } = useAuth();
  const { isScopedToLocation, scopedLocationIds } = useLocationScope();
  const currency = business?.currency || '';
  const today = todayLocal(business?.time_zone);

  const [activePreset, setActivePreset] = useState('today');
  const [range, setRange] = useState(getPresetRange('today', business?.time_zone));
  const [customDate, setCustomDate] = useState(today);
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [sortCol, setSortCol] = useState('qty_sold');
  const [sortDir, setSortDir] = useState('desc');

  const reportRef = useRef(null);

  // ── Fetch ────────────────────────────────────────────────
  useEffect(() => {
    if (!business?.id) return;
    setLoading(true);

    async function load() {
      // Fetch sale_items with nested sales filter
      const buildQuery = () => {
        let query = supabase
          .from('sale_items')
          .select('product_id, quantity, unit_price, line_total, sale:sales!inner(sale_date, status, business_id, location_id)')
          .eq('sale.business_id', business.id)
          .in('sale.status', ['confirmed', 'shipped', 'partially_returned', 'returned']);

        if (isScopedToLocation && scopedLocationIds.length > 0) {
          query = query.in('sale.location_id', scopedLocationIds);
        }

        if (range.from) query = query.gte('sale.sale_date', range.from);
        if (range.to) query = query.lte('sale.sale_date', range.to);

        return query;
      };

      const { data: itemRows, error } = await fetchAllBatched(buildQuery);

      if (error) {
        console.error('Daily items report error:', error);
        setRows([]);
        setLoading(false);
        return;
      }

      // Fetch product names/SKUs
      const productIds = [...new Set((itemRows || []).map((r) => r.product_id).filter(Boolean))];
      const productMap = {};
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from('products')
          .select('id, name, sku')
          .in('id', productIds);
        (products || []).forEach((p) => { productMap[p.id] = p; });
      }

      // Aggregate by product
      const agg = {};
      (itemRows || []).forEach((item) => {
        const pid = item.product_id;
        if (!pid) return;
        if (!agg[pid]) {
          agg[pid] = {
            product_id: pid,
            product_name: productMap[pid]?.name || `Product #${pid}`,
            sku: productMap[pid]?.sku || '—',
            qty_sold: 0,
            total_revenue: 0,
            price_sum: 0,
            price_count: 0,
          };
        }
        agg[pid].qty_sold += Number(item.quantity || 0);
        agg[pid].total_revenue += Number(item.line_total || 0);
        agg[pid].price_sum += Number(item.unit_price || 0);
        agg[pid].price_count += 1;
      });

      const result = Object.values(agg).map((r) => ({
        ...r,
        avg_unit_price: r.price_count > 0 ? r.price_sum / r.price_count : 0,
      }));

      setRows(result);
      setLoading(false);
    }

    load();
  }, [business?.id, range]);

  // ── Preset handler ────────────────────────────────────────
  const handlePreset = (key) => {
    setActivePreset(key);
    if (key === 'custom_date') {
      setRange({ from: customDate, to: customDate });
    } else if (key === 'custom_range') {
      setRange({ from: customFrom, to: customTo });
    } else {
      setRange(getPresetRange(key, business?.time_zone));
    }
  };

  // ── Sort ─────────────────────────────────────────────────
  const handleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir('desc'); }
  };

  const sortedRows = useMemo(() => [...rows].sort((a, b) => {
    const va = a[sortCol]; const vb = b[sortCol];
    if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    return sortDir === 'asc' ? va - vb : vb - va;
  }), [rows, sortCol, sortDir]);

  // ── Totals ───────────────────────────────────────────────
  const totalQty = rows.reduce((s, r) => s + r.qty_sold, 0);
  const totalRev = rows.reduce((s, r) => s + r.total_revenue, 0);
  const totalProducts = rows.length;

  // ── Filter label ─────────────────────────────────────────
  const filterLabel = useMemo(() => {
    if (activePreset === 'custom_date') return `Date: ${fmtDate(customDate)}`;
    if (activePreset === 'custom_range') return `${fmtDate(customFrom)} – ${fmtDate(customTo)}`;
    return PRESETS.find((p) => p.key === activePreset)?.label || '';
  }, [activePreset, customDate, customFrom, customTo]);

  const dateRangeDisplay = range.from && range.to && range.from === range.to
    ? fmtDate(range.from)
    : `${fmtDate(range.from)} – ${fmtDate(range.to)}`;

  // ── Sort arrow ───────────────────────────────────────────
  const Arrow = ({ col }) => (
    <span className={`dir-sort-arrow${sortCol === col ? ' active' : ''}`}>
      {sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
    </span>
  );

  // ── PDF / Print ──────────────────────────────────────────
  const handlePDF = async () => {
    const filename = buildPdfFilename('Daily Items Report', [{ value: filterLabel }]);
    await downloadPDF(filename);
  };

  const handlePrint = () => window.print();

  return (
    <AppLayout>
      <style>{CSS}</style>

      <div className="page-header no-print">
        <div>
          <h1>Daily Items Report</h1>
          <p className="muted">Products sold and quantities for the selected period.</p>
        </div>
      </div>

      {/* PDF/Print capture wrapper */}
      <div className="app-content" ref={reportRef}>

        {/* Print-only report header */}
        <PrintReportHeader
          title="Daily Items Report"
          filters={[
            { label: 'Period', value: filterLabel },
            { label: 'Date Range', value: dateRangeDisplay },
          ]}
        />

        <div className="dir-wrapper">

          {/* ── Toolbar ── */}
          <div className="dir-toolbar no-print">
            <div className="dir-toolbar-left">
              <span className="dir-title">📦 Items</span>
              <div className="dir-pills">
                {PRESETS.map((p) => (
                  <button
                    key={p.key}
                    className={`dir-pill${activePreset === p.key ? ' active' : ''}`}
                    onClick={() => handlePreset(p.key)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {activePreset === 'custom_date' && (
                <input
                  type="date"
                  className="dir-date"
                  value={customDate}
                  onChange={(e) => {
                    setCustomDate(e.target.value);
                    setRange({ from: e.target.value, to: e.target.value });
                  }}
                />
              )}

              {activePreset === 'custom_range' && (
                <>
                  <span className="dir-label">From</span>
                  <input
                    type="date"
                    className="dir-date"
                    value={customFrom}
                    onChange={(e) => {
                      setCustomFrom(e.target.value);
                      setRange((r) => ({ ...r, from: e.target.value }));
                    }}
                  />
                  <span className="dir-label">To</span>
                  <input
                    type="date"
                    className="dir-date"
                    value={customTo}
                    onChange={(e) => {
                      setCustomTo(e.target.value);
                      setRange((r) => ({ ...r, to: e.target.value }));
                    }}
                  />
                </>
              )}
            </div>

            <div className="dir-toolbar-right">
              <button className="btn btn-secondary" onClick={handlePrint}>
                🖨 Print
              </button>
              <button className="btn btn-primary" onClick={handlePDF}>
                ⬇ Save as PDF
              </button>
            </div>
          </div>

          {/* ── Summary cards ── */}
          <div className="dir-summary">
            <div className="dir-card">
              <div className="dir-card-label">Unique Products Sold</div>
              <div className="dir-card-value">{totalProducts}</div>
              <div className="dir-card-sub">distinct items</div>
            </div>
            <div className="dir-card">
              <div className="dir-card-label">Total Qty Sold</div>
              <div className="dir-card-value">{totalQty.toLocaleString()}</div>
              <div className="dir-card-sub">units across all products</div>
            </div>
            <div className="dir-card">
              <div className="dir-card-label">Total Revenue</div>
              <div className="dir-card-value" style={{ fontSize: 20 }}>{fmtMoney(totalRev, currency)}</div>
              <div className="dir-card-sub">from confirmed sales</div>
            </div>
          </div>

          {/* ── Table ── */}
          <div className="dir-panel">
            <div className="dir-panel-header">
              <span className="dir-panel-title">Product Breakdown</span>
              <span className="dir-panel-meta">{dateRangeDisplay}</span>
            </div>

            {loading ? (
              <div className="dir-empty">Loading…</div>
            ) : sortedRows.length === 0 ? (
              <div className="dir-empty">No sales found for this period.</div>
            ) : (
              <table className="dir-table">
                <thead>
                  <tr>
                    <th style={{ width: 42 }}>#</th>
                    <th
                      className={sortCol === 'product_name' ? 'sorted' : ''}
                      onClick={() => handleSort('product_name')}
                    >
                      Product <Arrow col="product_name" />
                    </th>
                    <th>SKU</th>
                    <th
                      className={`num${sortCol === 'qty_sold' ? ' sorted' : ''}`}
                      onClick={() => handleSort('qty_sold')}
                    >
                      Qty Sold <Arrow col="qty_sold" />
                    </th>
                    <th
                      className={`num${sortCol === 'avg_unit_price' ? ' sorted' : ''}`}
                      onClick={() => handleSort('avg_unit_price')}
                    >
                      Avg Price <Arrow col="avg_unit_price" />
                    </th>
                    <th
                      className={`num${sortCol === 'total_revenue' ? ' sorted' : ''}`}
                      onClick={() => handleSort('total_revenue')}
                    >
                      Total Revenue <Arrow col="total_revenue" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row, i) => (
                    <tr key={row.product_id}>
                      <td className="dir-rank">{i + 1}</td>
                      <td><strong>{row.product_name}</strong></td>
                      <td className="dir-sku">{row.sku}</td>
                      <td className="num">{row.qty_sold.toLocaleString()}</td>
                      <td className="num">{fmtMoney(row.avg_unit_price, currency)}</td>
                      <td className="num">{fmtMoney(row.total_revenue, currency)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="dir-tfoot">
                  <tr>
                    <td colSpan={3}><strong>TOTALS</strong></td>
                    <td className="num"><strong>{totalQty.toLocaleString()}</strong></td>
                    <td className="num">—</td>
                    <td className="num"><strong>{fmtMoney(totalRev, currency)}</strong></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

        </div>{/* dir-wrapper */}
      </div>{/* app-content */}
    </AppLayout>
  );
}