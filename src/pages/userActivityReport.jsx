import { useEffect, useMemo, useState, useRef } from 'react';
import AppLayout from '../components/AppLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';
import { fetchAllBatched } from '../lib/fetchUtils.js';
import { DASHBOARD_PRESETS, getPresetRange } from '../lib/dateRanges.js';
import html2canvas from 'html2canvas';
import PrintReportHeader from '../components/PrintReportHeader.jsx';
import { downloadPDF, buildPdfFilename } from '../utils/pdfGenerator.js';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts';

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
  .sr-date {
    padding: 5px 8px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--navy-border);
    font-size: 12px;
    background: var(--white);
    outline: none;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }
  .summary-card {
    background: var(--white);
    padding: 16px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-light);
    box-shadow: var(--shadow-sm);
  }
  .summary-card-label {
    font-size: 13px;
    color: var(--text-secondary);
    font-weight: 600;
    margin-bottom: 4px;
  }
  .summary-card-value {
    font-size: 20px;
    font-weight: 700;
    color: var(--navy-900);
  }

  .chart-container-wrapper {
    background: var(--white);
    padding: 16px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-light);
    box-shadow: var(--shadow-sm);
    margin-top: 4px;
  }
  
  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .dash-panel {
    background: var(--white);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-light);
    box-shadow: var(--shadow-sm);
    padding: 16px;
    margin-top: 4px;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .data-table th, .data-table td {
    padding: 10px 12px;
    text-align: left;
    border-bottom: 1px solid var(--border-light);
  }
  .data-table th {
    font-weight: 600;
    color: var(--text-secondary);
    background: var(--navy-50);
  }

  .badge-role {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    background: var(--navy-50);
    color: var(--navy-800);
  }
  .badge-role.owner {
    background: #e0e7ff;
    color: #3730a3;
  }
  
  .print-only { display: none; }

  @media print {
    .no-print, .AppHeader, .AppSidebar {
      display: none !important;
    }
    .print-only { display: block !important; }
    .AppMain {
      margin: 0 !important;
      padding: 0 !important;
    }
    .chart-container-wrapper, .dash-panel, .summary-card {
      box-shadow: none;
      border: 1px solid #eee;
    }
    .summary-grid {
      grid-template-columns: repeat(4, 1fr) !important;
    }
    .sr-toolbar {
      display: none !important;
    }
  }
`;

export default function UserActivityReport() {
  const { business } = useAuth();
  const [activePreset, setActivePreset] = useState('this_month');
  const [range, setRange] = useState(getPresetRange('this_month', business?.time_zone));

  const [users, setUsers] = useState([]);
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [expenseCount, setExpenseCount] = useState({});
  const [loading, setLoading] = useState(true);

  const chartRef = useRef(null);

  useEffect(() => {
    if (!business?.id) return;
    setLoading(true);
    async function load() {
      const { data: userRows } = await supabase
        .from('users')
        .select('id, first_name, last_name, is_owner, employment_status, joining_date')
        .eq('business_id', business.id);
      setUsers(userRows || []);

      const buildSaleQuery = () => {
        let saleQuery = supabase.from('sales').select('created_by, grand_total, sale_date').eq('business_id', business.id).in('status', ['confirmed', 'shipped', 'returned', 'partially_returned']);
        if (range.from) saleQuery = saleQuery.gte('sale_date', range.from);
        if (range.to) saleQuery = saleQuery.lte('sale_date', range.to);
        return saleQuery;
      };
      const { data: saleRows } = await fetchAllBatched(buildSaleQuery);
      setSales(saleRows || []);

      const buildPurchaseQuery = () => {
        let purchaseQuery = supabase.from('purchases').select('created_by, grand_total, purchase_date').eq('business_id', business.id).eq('purchase_status', 'received');
        if (range.from) purchaseQuery = purchaseQuery.gte('purchase_date', range.from);
        if (range.to) purchaseQuery = purchaseQuery.lte('purchase_date', range.to);
        return purchaseQuery;
      };
      const { data: purchaseRows } = await fetchAllBatched(buildPurchaseQuery);
      setPurchases(purchaseRows || []);

      const buildExpQuery = () => {
        let expQuery = supabase.from('expenses').select('expense_from_user_id').eq('business_id', business.id);
        if (range.from) expQuery = expQuery.gte('expense_date', range.from);
        if (range.to) expQuery = expQuery.lte('expense_date', range.to);
        return expQuery;
      };
      const { data: expRows } = await fetchAllBatched(buildExpQuery);

      const counts = {};
      (expRows || []).forEach((e) => {
        if (e.expense_from_user_id) counts[e.expense_from_user_id] = (counts[e.expense_from_user_id] || 0) + 1;
      });
      setExpenseCount(counts);

      setLoading(false);
    }
    load();
  }, [business?.id, range]);

  const handlePreset = (key) => {
    setActivePreset(key);
    if (key !== 'custom') setRange(getPresetRange(key, business?.time_zone));
  };

  const handlePrint = () => {
    window.print();
  };

  const downloadChart = async () => {
    if (!chartRef.current) return;
    const canvas = await html2canvas(chartRef.current);
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'user-activity-chart.png';
    link.href = url;
    link.click();
  };

  const rows = useMemo(() => {
    const salesByUser = {};
    sales.forEach((s) => {
      if (!s.created_by) return;
      if (!salesByUser[s.created_by]) salesByUser[s.created_by] = { count: 0, total: 0 };
      salesByUser[s.created_by].count += 1;
      salesByUser[s.created_by].total += Number(s.grand_total);
    });

    const purchasesByUser = {};
    purchases.forEach((p) => {
      if (!p.created_by) return;
      if (!purchasesByUser[p.created_by]) purchasesByUser[p.created_by] = { count: 0, total: 0 };
      purchasesByUser[p.created_by].count += 1;
      purchasesByUser[p.created_by].total += Number(p.grand_total);
    });

    return users.map((u) => ({
      user: u,
      salesCount: salesByUser[u.id]?.count || 0,
      salesTotal: salesByUser[u.id]?.total || 0,
      purchaseCount: purchasesByUser[u.id]?.count || 0,
      purchaseTotal: purchasesByUser[u.id]?.total || 0,
      expenseCount: expenseCount[u.id] || 0,
    })).sort((a, b) => (b.salesTotal + b.purchaseTotal) - (a.salesTotal + a.purchaseTotal));
  }, [users, sales, purchases, expenseCount]);

  const totalSalesOverall = rows.reduce((acc, r) => acc + r.salesTotal, 0);
  const activeUsersCount = rows.filter(r => r.salesCount > 0 || r.purchaseCount > 0 || r.expenseCount > 0).length;
  const topPerformer = rows.length > 0 ? rows[0] : null;

  const chartData = useMemo(() => {
    return rows.map(r => ({
      name: `${r.user.first_name} ${r.user.last_name || ''}`.trim(),
      sales: Number(r.salesTotal.toFixed(2)),
      purchases: Number(r.purchaseTotal.toFixed(2))
    })).slice(0, 5); // top 5 for chart
  }, [rows]);

  const cur = business?.currency || '';
  const fmt = (n) => `${cur} ${Number(n).toFixed(2)}`;

  return (
    <AppLayout>
      <style>{CSS}</style>
      <div className="sr-wrapper">

        {/* Toolbar */}
        <div className="sr-toolbar no-print">
          <div className="sr-toolbar-left">
            <h1 className="sr-title">User Activity</h1>
            <div className="sr-preset-pills">
              {DASHBOARD_PRESETS.map((p) => (
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
                onClick={() => setActivePreset('custom')}
              >
                Custom
              </button>
            </div>

            {activePreset === 'custom' && (
              <div className="sr-filter-item" style={{ marginLeft: 8 }}>
                <input
                  type="date"
                  className="sr-date"
                  value={range.from}
                  onChange={(e) => setRange({ ...range, from: e.target.value })}
                />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>to</span>
                <input
                  type="date"
                  className="sr-date"
                  value={range.to}
                  onChange={(e) => setRange({ ...range, to: e.target.value })}
                />
              </div>
            )}
          </div>

          <div className="sr-toolbar-right">
            <button className="btn btn-primary" onClick={handlePrint} style={{ marginRight: '8px' }}>🖨️ Print</button>
            <button className="btn btn-primary" onClick={() => {
              const period = activePreset === 'custom'
                ? `${range.from || 'Start'} to ${range.to || 'End'}`
                : (DASHBOARD_PRESETS.find(p => p.key === activePreset)?.label || activePreset);
              downloadPDF(buildPdfFilename('User Activity Report', [{ value: period }]));
            }}>📄 Save PDF</button>
          </div>
        </div>

        {/* Print Header - Standardized */}
        <PrintReportHeader
          title="User Activity Report"
          filters={[
            {
              label: 'Period',
              value: activePreset === 'custom'
                ? `${range.from || 'Start'} to ${range.to || 'End'}`
                : (DASHBOARD_PRESETS.find(p => p.key === activePreset)?.label || activePreset),
            },
          ]}
        />

        {/* Summary Grid */}
        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-card-label">Total Staff</div>
            <div className="summary-card-value">{users.length}</div>
          </div>
          <div className="summary-card">
            <div className="summary-card-label">Active Users (Period)</div>
            <div className="summary-card-value">{activeUsersCount}</div>
          </div>
          <div className="summary-card">
            <div className="summary-card-label">Total Sales Processed</div>
            <div className="summary-card-value">{fmt(totalSalesOverall)}</div>
          </div>
          <div className="summary-card">
            <div className="summary-card-label">Top Performer</div>
            <div className="summary-card-value" style={{ fontSize: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {topPerformer && topPerformer.salesTotal > 0 ? `${topPerformer.user.first_name}` : 'N/A'}
            </div>
          </div>
        </div>

        {/* Chart Section */}
        <div className="chart-container-wrapper" ref={chartRef}>
          <div className="chart-header">
            <h3 style={{ margin: 0, fontSize: 16, color: 'var(--navy-900)' }}>Performance Leaderboard (Top 5)</h3>
            <button className="btn btn-secondary btn-sm no-print" onClick={downloadChart}>Download PNG</button>
          </div>
          {chartData.length > 0 && chartData.some(d => d.sales > 0 || d.purchases > 0) ? (
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#666' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#666' }} tickLine={false} axisLine={false} tickFormatter={(val) => val} />
                  <RechartsTooltip
                    cursor={{ fill: '#f4f4f5' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="sales" name="Sales Processed" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={60} />
                  <Bar dataKey="purchases" name="Purchases Processed" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={60} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              {loading ? 'Loading chart...' : 'No activity to display.'}
            </div>
          )}
        </div>

        {/* Detailed User Table */}
        <section className="dash-panel">
          <h2 style={{ margin: '0 0 16px 0', fontSize: 16, color: 'var(--navy-900)' }}>Detailed Activity Log</h2>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th style={{ textAlign: 'center' }}>Sales Processed</th>
                  <th style={{ textAlign: 'right' }}>Total Sales</th>
                  <th style={{ textAlign: 'center' }}>Purchases Processed</th>
                  <th style={{ textAlign: 'right' }}>Total Purchases</th>
                  <th style={{ textAlign: 'center' }}>Expenses Logged</th>
                  <th style={{ textAlign: 'right' }}>Contribution</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading…</td></tr>}
                {!loading && rows.length === 0 && <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)' }}>No users found.</td></tr>}
                {!loading && rows.map((r) => {
                  const contrib = totalSalesOverall > 0 ? ((r.salesTotal / totalSalesOverall) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={r.user.id}>
                      <td>{r.user.first_name} {r.user.last_name || ''}</td>
                      <td>
                        <span className={`badge-role ${r.user.is_owner ? 'owner' : 'staff'}`}>
                          {r.user.is_owner ? 'Owner' : 'Staff'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>{r.salesCount}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(r.salesTotal)}</td>
                      <td style={{ textAlign: 'center' }}>{r.purchaseCount}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(r.purchaseTotal)}</td>
                      <td style={{ textAlign: 'center' }}>{r.expenseCount}</td>
                      <td style={{ textAlign: 'right' }}>{contrib}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="no-print" style={{ marginTop: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
            Note: This report reflects transactional records each user created (sales, purchases, expenses). The
            database schema does not currently track strict login/logout timestamps or page view activity.
          </p>
        </section>

      </div>
    </AppLayout>
  );
}
