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
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer
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
  .sr-filter-item label { font-size:11px; font-weight:600; color:var(--text-secondary); }
  .sr-select, .sr-date {
    padding: 5px 8px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--navy-border);
    font-size: 12px;
    background: var(--white);
    outline: none;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
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
    .sr-toolbar {
      display: none !important;
    }
  }
`;

export default function ExpensesReport() {
  const { business } = useAuth();

  const [activePreset, setActivePreset] = useState('this_month');
  const [range, setRange] = useState(getPresetRange('this_month', business?.time_zone));
  const [locationId, setLocationId] = useState('');
  const [locations, setLocations] = useState([]);

  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState({});
  const [locationNames, setLocationNames] = useState({});
  const [loading, setLoading] = useState(true);

  const chartRef = useRef(null);

  useEffect(() => {
    if (!business?.id) return;
    supabase.from('locations').select('id, name').eq('business_id', business.id).then(({ data }) => {
      setLocations(data || []);
      setLocationNames(Object.fromEntries((data || []).map((l) => [l.id, l.name])));
    });
    supabase.from('expense_categories').select('id, name').eq('business_id', business.id).then(({ data }) => {
      setCategories(Object.fromEntries((data || []).map((c) => [c.id, c.name])));
    });
  }, [business?.id]);

  useEffect(() => {
    if (!business?.id) return;
    setLoading(true);
    const buildQuery = () => {
      let query = supabase.from('expenses').select('*').eq('business_id', business.id);
      if (range.from) query = query.gte('expense_date', range.from);
      if (range.to) query = query.lte('expense_date', range.to);
      if (locationId) query = query.eq('location_id', Number(locationId));
      return query.order('expense_date', { ascending: false });
    };

    fetchAllBatched(buildQuery).then(({ data }) => {
      setExpenses(data || []);
      setLoading(false);
    });
  }, [business?.id, range, locationId]);

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
    link.download = 'expenses-chart.png';
    link.href = url;
    link.click();
  };

  const chartData = useMemo(() => {
    const map = {};
    expenses.forEach((e) => {
      const d = e.expense_date;
      map[d] = (map[d] || 0) + Number(e.amount);
    });
    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, amount]) => ({ date, amount }));
  }, [expenses]);

  const byCategory = useMemo(() => {
    const map = {};
    expenses.forEach((e) => {
      const name = categories[e.category_id] || 'Uncategorized';
      map[name] = (map[name] || 0) + Number(e.amount);
    });
    return Object.entries(map);
  }, [expenses, categories]);

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const cur = business?.currency || '';
  const fmt = (n) => `${cur} ${Number(n).toFixed(2)}`;

  return (
    <AppLayout>
      <style>{CSS}</style>
      <div className="sr-wrapper">

        {/* Toolbar */}
        <div className="sr-toolbar no-print">
          <div className="sr-toolbar-left">
            <h1 className="sr-title">Expenses Report</h1>
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
            <div className="sr-filter-item">
              <label>Location</label>
              <select
                className="sr-select"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
              >
                <option value="">All Locations</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary" onClick={handlePrint} style={{ marginRight: '8px' }}>🖨️ Print</button>
            <button className="btn btn-primary" onClick={() => {
              const period = activePreset === 'custom'
                ? `${range.from || 'Start'} to ${range.to || 'End'}`
                : (DASHBOARD_PRESETS.find(p => p.key === activePreset)?.label || activePreset);
              const locName = locationId ? (locationNames[locationId] || 'Unknown') : 'All Locations';
              downloadPDF(buildPdfFilename('Expenses Report', [{ value: period }, { value: locName }]));
            }}>📄 Save PDF</button>
          </div>
        </div>

        {/* Print Header - Standardized */}
        <PrintReportHeader
          title="Expenses Report"
          filters={[
            {
              label: 'Period',
              value: activePreset === 'custom'
                ? `${range.from || 'Start'} to ${range.to || 'End'}`
                : (DASHBOARD_PRESETS.find(p => p.key === activePreset)?.label || activePreset),
            },
            {
              label: 'Location',
              value: locationId ? (locationNames[locationId] || 'Unknown') : 'All Locations',
            },
          ]}
        />

        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-card-label">Total Expenses</div>
            <div className="summary-card-value">{fmt(total)}</div>
          </div>
          <div className="summary-card">
            <div className="summary-card-label">Total Entries</div>
            <div className="summary-card-value">{expenses.length}</div>
          </div>
          <div className="summary-card">
            <div className="summary-card-label">Categories Used</div>
            <div className="summary-card-value">{byCategory.length}</div>
          </div>
        </div>

        {/* Chart Section */}
        <div className="chart-container-wrapper" ref={chartRef}>
          <div className="chart-header">
            <h3 style={{ margin: 0, fontSize: 16, color: 'var(--navy-900)' }}>Expenses Over Time</h3>
            <button className="btn btn-secondary btn-sm no-print" onClick={downloadChart}>Download PNG</button>
          </div>
          {chartData.length > 0 ? (
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#666' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#666' }} tickLine={false} axisLine={false} tickFormatter={(val) => val} />
                  <RechartsTooltip
                    cursor={{ fill: '#f4f4f5' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              {loading ? 'Loading chart...' : 'No expenses to display in chart.'}
            </div>
          )}
        </div>

        {/* Detailed Expenses List */}
        <section className="dash-panel">
          <h2 style={{ margin: '0 0 16px 0', fontSize: 16, color: 'var(--navy-900)' }}>Detailed Expenses</h2>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading…</div>
          ) : expenses.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)' }}>No expenses in this period.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Reference No</th>
                    <th>Category</th>
                    <th>Location</th>
                    <th>Note</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id}>
                      <td>{e.expense_date}</td>
                      <td>{e.reference_number || '-'}</td>
                      <td>{categories[e.category_id] || 'Uncategorized'}</td>
                      <td>{locationNames[e.location_id] || '-'}</td>
                      <td>{e.note || '-'}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>
    </AppLayout>
  );
}
