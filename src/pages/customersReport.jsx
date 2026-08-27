import { useEffect, useMemo, useState } from 'react';
import AppLayout from '../components/AppLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';
import { fetchAllBatched } from '../lib/fetchUtils.js';
import '../components/report-ui.css';
import PrintReportHeader from '../components/PrintReportHeader.jsx';
import { downloadPDF, buildPdfFilename } from '../utils/pdfGenerator.js';

// CSS styling for premium layout and printer-friendly reports
const CSS = `
  .cust-rep-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: -8px;
  }
  
  .cust-rep-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    background: var(--white);
    padding: 12px 16px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-light);
    box-shadow: var(--shadow-sm);
  }
  
  .cust-filter-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 180px;
    flex: 1;
  }
  
  .cust-filter-group label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .cust-select-input {
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--navy-border, #ccc);
    font-size: 13px;
    background: var(--white);
    outline: none;
    transition: border-color 0.15s ease;
  }
  
  .cust-select-input:focus {
    border-color: var(--navy-800);
  }
  
  .cust-btn-row {
    display: flex;
    gap: 8px;
    align-self: flex-end;
    margin-left: auto;
  }
  
  .cust-summary-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }
  
  .cust-sum-card {
    background: var(--white);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    padding: 16px;
    box-shadow: var(--shadow-sm);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .cust-sum-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
  }
  
  .cust-sum-val {
    font-size: 20px;
    font-weight: 800;
    color: var(--navy-900);
  }
  
  .cust-sum-sub {
    font-size: 11px;
    color: var(--text-secondary);
  }
  
  .cust-table-card {
    background: var(--white);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }
  
  .cust-table-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border-light);
  }
  
  .cust-table-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--navy-900);
  }
  
  .cust-table-count {
    font-size: 12px;
    background: var(--navy-50);
    color: var(--navy-800);
    padding: 2px 8px;
    border-radius: 12px;
    font-weight: 600;
  }

  .text-success { color: var(--success) !important; }
  .text-danger { color: var(--danger) !important; }

  @media (max-width: 900px) {
    .cust-summary-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  
  @media (max-width: 600px) {
    .cust-summary-grid {
      grid-template-columns: 1fr;
    }
    .cust-rep-filters {
      flex-direction: column;
      align-items: stretch;
    }
    .cust-btn-row {
      margin-left: 0;
      align-self: stretch;
      justify-content: flex-end;
    }
  }
  
  @media print {
    .no-print {
      display: none !important;
    }
    .cust-table-card, .cust-rep-filters, .cust-summary-grid {
      box-shadow: none !important;
      border: 1px solid #ccc !important;
    }
    .cust-table-header {
      border-bottom: 1px solid #ccc !important;
    }
    body {
      background: white !important;
      color: black !important;
    }
  }
`;

export default function CustomersReport() {
  const { business } = useAuth();

  // Data loading states
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [locations, setLocations] = useState([]);

  // Location filter state
  const [locationFilter, setLocationFilter] = useState('');

  // Load locations and customer metrics once on mount
  useEffect(() => {
    if (!business?.id) return;

    // Fetch locations
    supabase
      .from('locations')
      .select('id, name')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .then(({ data }) => setLocations(data || []));

    setLoading(true);

    const loadData = async () => {
      try {
        // 1. Fetch all customer contacts
        const { data: custRows } = await fetchAllBatched(() =>
          supabase
            .from('contacts')
            .select('*')
            .eq('business_id', business.id)
            .eq('contact_type', 'customer')
        );
        setCustomers(custRows || []);

        // 2. Query all confirmed sales (all time, filtered by location in-memory)
        const { data: saleRows } = await fetchAllBatched(() =>
          supabase
            .from('sales')
            .select('customer_id, location_id, grand_total, sale_date, status')
            .eq('business_id', business.id)
            .in('status', ['confirmed', 'shipped', 'returned', 'partially_returned'])
            .not('customer_id', 'is', null)
        );
        setSales(saleRows || []);

        // 3. Query ledger details for outstanding balance calculations
        const ids = (custRows || []).map((c) => c.id);
        if (ids.length > 0) {
          const { data: ledgerRows } = await fetchAllBatched(() =>
            supabase
              .from('contact_ledger')
              .select('contact_id, amount')
              .in('contact_id', ids)
          );
          setLedger(ledgerRows || []);
        } else {
          setLedger([]);
        }
      } catch (err) {
        console.error('Error fetching customers report:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [business?.id]);

  // Calculate stats per customer matching filters in-memory
  const computedRows = useMemo(() => {
    // outstanding balance mapping (global value)
    const balances = {};
    customers.forEach((c) => {
      balances[c.id] = Number(c.opening_balance || 0);
    });
    ledger.forEach((l) => {
      balances[l.contact_id] = (balances[l.contact_id] || 0) + Number(l.amount || 0);
    });

    // sale activity mapping (filtered by location in-memory)
    const activity = {};
    sales.forEach((s) => {
      // Apply location filter
      if (locationFilter && s.location_id !== Number(locationFilter)) return;

      if (!activity[s.customer_id]) {
        activity[s.customer_id] = { count: 0, total: 0, last: null };
      }
      activity[s.customer_id].count += 1;
      activity[s.customer_id].total += Number(s.grand_total || 0);

      if (!activity[s.customer_id].last || s.sale_date > activity[s.customer_id].last) {
        activity[s.customer_id].last = s.sale_date;
      }
    });

    return customers.map((c) => ({
      customer: c,
      orders: activity[c.id]?.count || 0,
      total: activity[c.id]?.total || 0,
      last: activity[c.id]?.last || '—',
      balance: balances[c.id] || 0,
    })).sort((a, b) => b.total - a.total);
  }, [customers, sales, ledger, locationFilter]);

  // Calculate total metrics for cards
  const summary = useMemo(() => {
    const totalSales = computedRows.reduce((sum, r) => sum + r.total, 0);
    const activeCustomers = computedRows.filter((r) => r.orders > 0).length;
    const totalOwed = computedRows.reduce((sum, r) => sum + Math.max(r.balance, 0), 0);
    const totalCustomersCount = customers.length;

    return {
      totalSales,
      activeCustomers,
      totalOwed,
      totalCustomersCount,
    };
  }, [computedRows, customers]);

  const cur = business?.currency || '';
  const fmt = (n) => `${cur} ${Number(n).toFixed(2)}`;

  return (
    <AppLayout>
      <style>{CSS}</style>
      <div className="cust-rep-container">
        {/* Filter bar */}
        <div className="cust-rep-filters no-print">
          {/* Location Select Dropdown */}
          <div className="cust-filter-group" style={{ maxWidth: '280px' }}>
            <label htmlFor="filter-location">Filter by Location</label>
            <select
              id="filter-location"
              className="cust-select-input"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            >
              <option value="">All Locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          {/* Action Row */}
          <div className="cust-btn-row">
            <button className="btn btn-secondary btn-sm" onClick={() => window.print()} style={{ marginRight: '8px' }}>
              🖨️ Print
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => {
              const locName = locationFilter ? (locations.find(l => String(l.id) === String(locationFilter))?.name || 'Unknown') : 'All Locations';
              downloadPDF(buildPdfFilename('Customers Report', [{ value: locName }]));
            }}>
              📄 Save PDF
            </button>
          </div>
        </div>

        {/* Standardized Print Header (print-only) */}
        <PrintReportHeader
          title="Customers Report"
          filters={[
            {
              label: 'Location',
              value: locationFilter ? (locations.find(l => String(l.id) === String(locationFilter))?.name || 'Unknown') : 'All Locations',
            },
          ]}
        />

        {/* Summary grid */}
        <div className="cust-summary-grid">
          <div className="cust-sum-card">
            <span className="cust-sum-label">Total Customers</span>
            <span className="cust-sum-val">{summary.totalCustomersCount}</span>
            <span className="cust-sum-sub">Total registered</span>
          </div>
          <div className="cust-sum-card">
            <span className="cust-sum-label">Total Sales (Revenue)</span>
            <span className="cust-sum-val text-success">{fmt(summary.totalSales)}</span>
            <span className="cust-sum-sub">Confirmed sales volume</span>
          </div>
          <div className="cust-sum-card">
            <span className="cust-sum-label">Active Customers</span>
            <span className="cust-sum-val">{summary.activeCustomers}</span>
            <span className="cust-sum-sub">With orders registered</span>
          </div>
          <div className="cust-sum-card">
            <span className="cust-sum-label">Total Owed to Business</span>
            <span className="cust-sum-val text-danger">{fmt(summary.totalOwed)}</span>
            <span className="cust-sum-sub">Outstanding balance as of now</span>
          </div>
        </div>

        {/* Detailed Customer Table */}
        <div className="cust-table-card">
          <div className="cust-table-header">
            <span className="cust-table-title">Customer Transactions &amp; Balances</span>
            <span className="cust-table-count">{computedRows.length} customers</span>
          </div>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th>Orders</th>
                  <th>Revenue</th>
                  <th>Last Purchase Date</th>
                  <th>Outstanding Balance</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={5} className="muted table-empty">Loading report details…</td>
                  </tr>
                )}
                {!loading && computedRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted table-empty">No customers found.</td>
                  </tr>
                )}
                {!loading && computedRows.map((r) => (
                  <tr key={r.customer.id}>
                    <td>
                      <span style={{ fontWeight: 600 }}>{r.customer.name}</span>
                      {r.customer.contact_number && (
                        <div className="muted" style={{ fontSize: 11, fontWeight: 400 }}>
                          {r.customer.contact_number}
                        </div>
                      )}
                    </td>
                    <td>{r.orders}</td>
                    <td>{fmt(r.total)}</td>
                    <td>{r.last}</td>
                    <td>
                      <span className={r.balance > 0 ? 'text-danger' : r.balance < 0 ? 'text-success' : ''} style={{ fontWeight: 700 }}>
                        {fmt(r.balance)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}