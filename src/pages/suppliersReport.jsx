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
  .sup-rep-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: -8px;
  }
  
  .sup-rep-filters {
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
  
  .sup-filter-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 180px;
    flex: 1;
  }
  
  .sup-filter-group label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .sup-select-input {
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--navy-border, #ccc);
    font-size: 13px;
    background: var(--white);
    outline: none;
    transition: border-color 0.15s ease;
  }
  
  .sup-select-input:focus {
    border-color: var(--navy-800);
  }
  
  .sup-btn-row {
    display: flex;
    gap: 8px;
    align-self: flex-end;
    margin-left: auto;
  }
  
  .sup-summary-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }
  
  .sup-sum-card {
    background: var(--white);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    padding: 16px;
    box-shadow: var(--shadow-sm);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .sup-sum-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
  }
  
  .sup-sum-val {
    font-size: 20px;
    font-weight: 800;
    color: var(--navy-900);
  }
  
  .sup-sum-sub {
    font-size: 11px;
    color: var(--text-secondary);
  }
  
  .sup-table-card {
    background: var(--white);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }
  
  .sup-table-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border-light);
  }
  
  .sup-table-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--navy-900);
  }
  
  .sup-table-count {
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
    .sup-summary-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  
  @media (max-width: 600px) {
    .sup-summary-grid {
      grid-template-columns: 1fr;
    }
    .sup-rep-filters {
      flex-direction: column;
      align-items: stretch;
    }
    .sup-btn-row {
      margin-left: 0;
      align-self: stretch;
      justify-content: flex-end;
    }
  }
  
  @media print {
    .no-print {
      display: none !important;
    }
    .sup-table-card, .sup-rep-filters, .sup-summary-grid {
      box-shadow: none !important;
      border: 1px solid #ccc !important;
    }
    .sup-table-header {
      border-bottom: 1px solid #ccc !important;
    }
    body {
      background: white !important;
      color: black !important;
    }
  }
`;

export default function SuppliersReport() {
  const { business } = useAuth();
  
  // Data loading states
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [locations, setLocations] = useState([]);

  // Location filter state
  const [locationFilter, setLocationFilter] = useState('');

  // Load locations and supplier metrics once on mount
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
        // 1. Fetch all supplier contacts
        const { data: supRows } = await fetchAllBatched(() =>
          supabase
            .from('contacts')
            .select('*')
            .eq('business_id', business.id)
            .eq('contact_type', 'supplier')
        );
        setSuppliers(supRows || []);

        // 2. Query all received purchases (all time, filtered by location in-memory)
        const { data: purchaseRows } = await fetchAllBatched(() =>
          supabase
            .from('purchases')
            .select('supplier_id, location_id, grand_total, purchase_date, purchase_status')
            .eq('business_id', business.id)
            .eq('purchase_status', 'received')
            .not('supplier_id', 'is', null)
        );
        setPurchases(purchaseRows || []);

        // 3. Query ledger details for outstanding balance calculations
        const ids = (supRows || []).map((c) => c.id);
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
        console.error('Error fetching suppliers report:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [business?.id]);

  // Calculate stats per supplier matching filters in-memory
  const computedRows = useMemo(() => {
    // outstanding balance mapping (global value)
    const balances = {};
    suppliers.forEach((s) => {
      balances[s.id] = Number(s.opening_balance || 0);
    });
    ledger.forEach((l) => {
      balances[l.contact_id] = (balances[l.contact_id] || 0) + Number(l.amount || 0);
    });

    // purchase activity mapping (filtered by location in-memory)
    const activity = {};
    purchases.forEach((p) => {
      // Apply location filter
      if (locationFilter && p.location_id !== Number(locationFilter)) return;

      if (!activity[p.supplier_id]) {
        activity[p.supplier_id] = { count: 0, total: 0, last: null };
      }
      activity[p.supplier_id].count += 1;
      activity[p.supplier_id].total += Number(p.grand_total || 0);
      
      if (!activity[p.supplier_id].last || p.purchase_date > activity[p.supplier_id].last) {
        activity[p.supplier_id].last = p.purchase_date;
      }
    });

    return suppliers.map((s) => ({
      supplier: s,
      orders: activity[s.id]?.count || 0,
      total: activity[s.id]?.total || 0,
      last: activity[s.id]?.last || '—',
      balance: balances[s.id] || 0,
    })).sort((a, b) => b.total - a.total);
  }, [suppliers, purchases, ledger, locationFilter]);

  // Calculate total metrics for cards
  const summary = useMemo(() => {
    const totalPurchases = computedRows.reduce((sum, r) => sum + r.total, 0);
    const activeSuppliers = computedRows.filter((r) => r.orders > 0).length;
    const totalOwed = computedRows.reduce((sum, r) => sum + Math.max(r.balance, 0), 0);
    const totalSuppliersCount = suppliers.length;

    return {
      totalPurchases,
      activeSuppliers,
      totalOwed,
      totalSuppliersCount,
    };
  }, [computedRows, suppliers]);

  const cur = business?.currency || '';
  const fmt = (n) => `${cur} ${Number(n).toFixed(2)}`;

  return (
    <AppLayout>
      <style>{CSS}</style>
      <div className="sup-rep-container">
        {/* Filter bar */}
        <div className="sup-rep-filters no-print">
          {/* Location Select Dropdown */}
          <div className="sup-filter-group" style={{ maxWidth: '280px' }}>
            <label htmlFor="filter-location">Filter by Location</label>
            <select
              id="filter-location"
              className="sup-select-input"
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
          <div className="sup-btn-row">
            <button className="btn btn-secondary btn-sm" onClick={() => window.print()} style={{ marginRight: '8px' }}>
              🖨️ Print
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => {
              const locName = locationFilter ? (locations.find(l => String(l.id) === String(locationFilter))?.name || 'Unknown') : 'All Locations';
              downloadPDF(buildPdfFilename('Suppliers Report', [{ value: locName }]));
            }}>
              📄 Save PDF
            </button>
          </div>
        </div>

        {/* Standardized Print Header (print-only) */}
        <PrintReportHeader
          title="Suppliers Report"
          filters={[
            {
              label: 'Location',
              value: locationFilter ? (locations.find(l => String(l.id) === String(locationFilter))?.name || 'Unknown') : 'All Locations',
            },
          ]}
        />

        {/* Summary grid */}
        <div className="sup-summary-grid">
          <div className="sup-sum-card">
            <span className="sup-sum-label">Total Suppliers</span>
            <span className="sup-sum-val">{summary.totalSuppliersCount}</span>
            <span className="sup-sum-sub">Total registered</span>
          </div>
          <div className="sup-sum-card">
            <span className="sup-sum-label">Total Purchase (Spend)</span>
            <span className="sup-sum-val text-success">{fmt(summary.totalPurchases)}</span>
            <span className="sup-sum-sub">Confirmed purchase volume</span>
          </div>
          <div className="sup-sum-card">
            <span className="sup-sum-label">Active Suppliers</span>
            <span className="sup-sum-val">{summary.activeSuppliers}</span>
            <span className="sup-sum-sub">With purchases registered</span>
          </div>
          <div className="sup-sum-card">
            <span className="sup-sum-label">Total Owed to Suppliers</span>
            <span className="sup-sum-val text-danger">{fmt(summary.totalOwed)}</span>
            <span className="sup-sum-sub">Outstanding balance as of now</span>
          </div>
        </div>

        {/* Detailed Supplier Table */}
        <div className="sup-table-card">
          <div className="sup-table-header">
            <span className="sup-table-title">Supplier Transactions &amp; Balances</span>
            <span className="sup-table-count">{computedRows.length} suppliers</span>
          </div>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Supplier Name</th>
                  <th>Orders</th>
                  <th>Spend</th>
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
                    <td colSpan={5} className="muted table-empty">No suppliers found.</td>
                  </tr>
                )}
                {!loading && computedRows.map((r) => (
                  <tr key={r.supplier.id}>
                    <td>
                      <span style={{ fontWeight: 600 }}>{r.supplier.name}</span>
                      {r.supplier.contact_number && (
                        <div className="muted" style={{ fontSize: 11, fontWeight: 400 }}>
                          {r.supplier.contact_number}
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