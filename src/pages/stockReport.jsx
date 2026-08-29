import { useEffect, useMemo, useState } from 'react';
import AppLayout from '../components/AppLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';
import '../components/report-ui.css';
import { fetchAllBatched } from '../lib/fetchUtils.js';
import PrintReportHeader from '../components/PrintReportHeader.jsx';
import { downloadPDF, buildPdfFilename } from '../utils/pdfGenerator.js';
import { formatTimestamp } from '../lib/timezone.js';
import useLocationScope from '../hooks/useLocationScope.js';

// Embedded scoped CSS for premium aesthetics, layout stability, and print optimization
const CSS = `
  .stock-rep-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: -8px;
  }
  
  .stock-rep-filters {
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
  
  .stock-filter-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 160px;
    flex: 1;
  }
  
  .stock-filter-group label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .stock-select-input {
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--navy-border, #ccc);
    font-size: 13px;
    background: var(--white);
    outline: none;
    transition: border-color 0.15s ease;
  }
  
  .stock-select-input:focus {
    border-color: var(--navy-800);
  }
  
  .stock-btn-row {
    display: flex;
    gap: 8px;
    align-self: flex-end;
    margin-left: auto;
  }
  
  .stock-summary-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }
  
  .stock-sum-card {
    background: var(--white);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    padding: 16px;
    box-shadow: var(--shadow-sm);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .stock-sum-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
  }
  
  .stock-sum-val {
    font-size: 20px;
    font-weight: 800;
    color: var(--navy-900);
  }
  
  .stock-sum-sub {
    font-size: 11px;
    color: var(--text-secondary);
  }
  
  .stock-table-card {
    background: var(--white);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }
  
  .stock-table-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border-light);
  }
  
  .stock-table-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--navy-900);
  }
  
  .stock-table-count {
    font-size: 12px;
    background: var(--navy-50);
    color: var(--navy-800);
    padding: 2px 8px;
    border-radius: 12px;
    font-weight: 600;
  }
  
  .badge-low-stock {
    background: var(--danger-bg);
    color: var(--danger);
    font-size: 11px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
  }
  
  .badge-ok-stock {
    background: var(--success-bg);
    color: var(--success);
    font-size: 11px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
  }
  
  .pagination-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 16px;
    border-top: 1px solid var(--border-light);
    background: var(--navy-50);
  }
  
  .pagination-info {
    font-size: 13px;
    color: var(--text-secondary);
  }
  
  .pagination-actions {
    display: flex;
    gap: 6px;
  }
  
  .pagination-btn {
    padding: 5px 12px;
    border-radius: 4px;
    border: 1px solid var(--border-light);
    background: var(--white);
    color: var(--navy-900);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .pagination-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .pagination-btn:not(:disabled):hover {
    background: var(--navy-800);
    color: var(--white);
    border-color: var(--navy-800);
  }

  /* History subpage view */
  .hist-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--border-light);
    padding-bottom: 12px;
    margin-bottom: 16px;
  }
  
  .hist-title-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .hist-title {
    font-size: 20px;
    font-weight: 800;
    color: var(--navy-900);
  }
  
  .hist-meta {
    font-size: 13px;
    color: var(--text-secondary);
  }
  
  .hist-summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 10px;
    margin-bottom: 16px;
  }
  
  .hist-sum-card {
    background: var(--white);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    padding: 10px 14px;
    text-align: center;
  }
  
  .hist-sum-card-label {
    font-size: 11px;
    color: var(--text-secondary);
    font-weight: 600;
    margin-bottom: 4px;
  }
  
  .hist-sum-card-val {
    font-size: 16px;
    font-weight: 800;
    color: var(--navy-900);
  }
  
  .btn-back {
    display: flex;
    align-items: center;
    gap: 4px;
    background: none;
    border: none;
    color: var(--navy-800);
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    padding: 0;
  }
  
  .btn-back:hover {
    text-decoration: underline;
  }

  /* Table styling enhancements */
  .stock-action-cell {
    display: flex;
    gap: 6px;
  }
  
  .btn-stock-action {
    padding: 3px 8px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 4px;
    cursor: pointer;
    border: 1px solid var(--border-light);
    background: var(--white);
    transition: all 0.15s ease;
  }
  
  .btn-stock-action:hover {
    background: var(--navy-800);
    color: var(--white);
    border-color: var(--navy-800);
  }
  
  .text-success { color: var(--success) !important; }
  .text-danger { color: var(--danger) !important; }
  .text-warning { color: var(--warning) !important; }

  @media (max-width: 900px) {
    .stock-summary-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  
  @media (max-width: 600px) {
    .stock-summary-grid {
      grid-template-columns: 1fr;
    }
    .stock-rep-filters {
      flex-direction: column;
      align-items: stretch;
    }
    .stock-btn-row {
      margin-left: 0;
      align-self: stretch;
      justify-content: flex-end;
    }
  }
  
  @media print {
    @page {
      size: A4 landscape;
      margin: 10mm 8mm;
    }
    .no-print {
      display: none !important;
    }
    .stock-table-card, .stock-rep-filters, .stock-summary-grid, .hist-summary-grid {
      box-shadow: none !important;
      border: 1px solid #ccc !important;
    }
    .stock-table-header {
      border-bottom: 1px solid #ccc !important;
    }
    body {
      background: white !important;
      color: black !important;
    }
    /* Force table to fill page width without scrolling */
    .report-page .table-scroll {
      overflow: visible !important;
    }
    .report-page .table-scroll .data-table {
      min-width: unset !important;
      width: 100% !important;
      table-layout: fixed !important;
      font-size: 10px !important;
    }
    .report-page .table-scroll .data-table th,
    .report-page .table-scroll .data-table td {
      padding: 4px 6px !important;
      word-break: break-word;
    }
    /* Summary cards in single row for print */
    .stock-summary-grid {
      grid-template-columns: repeat(4, 1fr) !important;
    }
  }
`;

export default function StockReport() {
  const { business } = useAuth();

  // Loading, data, and configuration states
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [purchaseItems, setPurchaseItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [ledger, setLedger] = useState([]);

  // Main page filters
  const [locationFilter, setLocationFilter] = useState('');
  const { isOwner, isScopedToLocation, scopedLocationIds } = useLocationScope();
  const [categoryFilter, setCategoryFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');

  // Main page pagination
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 25;

  // History view state
  const [historyProductId, setHistoryProductId] = useState(null);
  const [historyLocationFilter, setHistoryLocationFilter] = useState('');
  const [historyLedger, setHistoryLedger] = useState([]);
  const [historyReferences, setHistoryReferences] = useState({
    sales: {},
    purchases: {},
    sellReturns: {},
    purchaseReturns: {},
  });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);

  // Load main reporting data
  const loadMainData = async () => {
    if (!business?.id) return;
    setLoading(true);
    try {
      const [prodRes, purchaseItemsRes, locRes, catRes, ledgerRes] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, sku, cost_price, default_selling_price, alert_quantity, category_id')
          .eq('business_id', business.id)
          .eq('is_active', true),
        fetchAllBatched(() =>
          supabase
            .from('purchase_items')
            .select('product_id, quantity, unit_cost')
            .eq('purchases.business_id', business.id)),
        supabase
          .from('locations')
          .select('id, name')
          .eq('business_id', business.id)
          .eq('is_active', true),
        supabase
          .from('categories')
          .select('id, name')
          .eq('business_id', business.id),
        fetchAllBatched(() =>
          supabase
            .from('stock_ledger')
            .select('*')
            .eq('business_id', business.id)),
      ]);

      setProducts(prodRes.data || []);
      setPurchaseItems(purchaseItemsRes.data || []);
      setLocations(locRes.data || []);
      setCategories(catRes.data || []);
      setLedger(ledgerRes.data || []);
    } catch (err) {
      console.error('Error loading stock report data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMainData();
  }, [business?.id]);

  // Extract brands dynamically from product names
  const brandsList = useMemo(() => {
    const set = new Set();
    products.forEach((p) => {
      if (p.name) {
        const word = p.name.trim().split(/\s+/)[0];
        if (word && word.length > 2) {
          set.add(word);
        }
      }
    });
    return Array.from(set).sort();
  }, [products]);

  // Compute stock quantities and details for the products
  const computedRows = useMemo(() => {
    // 1. Calculate stock on hand by Product-Location key
    const onHand = {};
    const salesCount = {}; // product_id : location_id : qty
    const weightedCostByProduct = {};

    const purchaseTotals = {};
    purchaseItems.forEach((row) => {
      const pid = Number(row.product_id);
      const qty = Number(row.quantity || 0);
      const unitCost = Number(row.unit_cost || 0);
      purchaseTotals[pid] = {
        qty: (purchaseTotals[pid]?.qty || 0) + qty,
        value: (purchaseTotals[pid]?.value || 0) + qty * unitCost,
      };
    });

    Object.entries(purchaseTotals).forEach(([pid, totals]) => {
      weightedCostByProduct[Number(pid)] = totals.qty > 0 ? totals.value / totals.qty : 0;
    });

    ledger.forEach((row) => {
      const key = `${row.product_id}:${row.location_id}`;
      onHand[key] = (onHand[key] || 0) + Number(row.change_qty);

      // Track units sold. 'sale' and 'sale_edit' both have negative
      // change_qty (stock going out), so -change_qty adds to the count.
      // 'sale_edit_reversal' has positive change_qty (stock put back
      // before the edit's new deduction is applied), so -change_qty
      // correctly subtracts it back out — net effect after an edit is
      // just the new quantity being counted, not the old one.
      if (
        row.reason === 'sale' ||
        row.reason === 'sale_edit' ||
        row.reason === 'sale_edit_reversal'
      ) {
        salesCount[key] = (salesCount[key] || 0) - Number(row.change_qty);
      }
    });

    const list = [];
    products.forEach((p) => {
      // Filter by category
      if (categoryFilter && p.category_id !== Number(categoryFilter)) return;

      // Filter by brand
      const brandName = p.name ? p.name.trim().split(/\s+/)[0] : '';
      if (brandFilter && brandName !== brandFilter) return;

      locations.forEach((l) => {
        // Filter by location (owners: voluntary filter; staff: auto-scope)
        if (isScopedToLocation) {
          if (scopedLocationIds.length === 0) return;
          if (!scopedLocationIds.includes(l.id)) return;
        } else if (locationFilter && l.id !== Number(locationFilter)) {
          return;
        }

        const key = `${p.id}:${l.id}`;
        const qty = onHand[key] || 0;
        const totalSold = Math.max(0, salesCount[key] || 0);

        const avgCost = Number(weightedCostByProduct[p.id] ?? p.cost_price ?? 0);

        list.push({
          product: p,
          location: l,
          qty,
          sellingPrice: Number(p.default_selling_price || 0),
          costPrice: avgCost,
          purchaseValue: qty * avgCost,
          saleValue: qty * Number(p.default_selling_price || 0),
          potentialProfit: qty * (Number(p.default_selling_price || 0) - avgCost),
          totalSold,
          totalTransferred: 0,
          isLow: p.alert_quantity != null && qty <= Number(p.alert_quantity),
        });
      });
    });

    return list.sort((a, b) => a.product.name.localeCompare(b.product.name));
  }, [products, purchaseItems, locations, ledger, locationFilter, categoryFilter, brandFilter]);

  // Compute summary values based on filtered results
  const summary = useMemo(() => {
    const purchaseVal = computedRows.reduce((sum, r) => sum + r.purchaseValue, 0);
    const saleVal = computedRows.reduce((sum, r) => sum + r.saleValue, 0);
    const profit = computedRows.reduce((sum, r) => sum + r.potentialProfit, 0);
    const margin = saleVal > 0 ? (profit / saleVal) * 100 : 0;

    return {
      purchaseVal,
      saleVal,
      profit,
      margin,
    };
  }, [computedRows]);

  // Paginated rows for main page
  const totalProductsCount = computedRows.length;
  const totalPages = Math.ceil(totalProductsCount / rowsPerPage);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return computedRows.slice(start, start + rowsPerPage);
  }, [computedRows, currentPage]);

  // Lazy load history for a specific product
  const loadProductHistory = async (prodId) => {
    setHistoryLoading(true);
    setHistoryPage(1);
    try {
      // 1. Fetch ledger entries for this product
      const { data: ledgerRows, error: ledgerErr } = await fetchAllBatched(() =>
        supabase
          .from('stock_ledger')
          .select('*')
          .eq('product_id', prodId)
          .order('created_at', { ascending: false })
      );

      if (ledgerErr) throw ledgerErr;

      // 2. Extract reference IDs
      const saleIds = [];
      const purchaseIds = [];
      const sellReturnIds = [];
      const purchaseReturnIds = [];

      (ledgerRows || []).forEach((row) => {
        const refId = row.reference_id;
        if (!refId) return;
        if (row.reference_type === 'sale' || row.reason === 'sale') {
          saleIds.push(refId);
        } else if (row.reference_type === 'purchase' || row.reason === 'purchase') {
          purchaseIds.push(refId);
        } else if (row.reference_type === 'sell_return' || row.reason === 'sell_return') {
          sellReturnIds.push(refId);
        } else if (row.reference_type === 'purchase_return' || row.reason === 'purchase_return') {
          purchaseReturnIds.push(refId);
        }
      });

      // Fetch references in parallel
      const [salesRes, purchasesRes, sellReturnsRes, purchaseReturnsRes] = await Promise.all([
        saleIds.length > 0
          ? supabase.from('sales').select('id, customer_id, contacts(name)').in('id', saleIds)
          : Promise.resolve({ data: [] }),
        purchaseIds.length > 0
          ? supabase.from('purchases').select('id, supplier_id, contacts(name)').in('id', purchaseIds)
          : Promise.resolve({ data: [] }),
        sellReturnIds.length > 0
          ? supabase.from('sell_returns').select('id, customer_id, contacts(name)').in('id', sellReturnIds)
          : Promise.resolve({ data: [] }),
        purchaseReturnIds.length > 0
          ? supabase.from('purchase_returns').select('id, purchase_id').in('id', purchaseReturnIds)
          : Promise.resolve({ data: [] }),
      ]);

      const salesMap = {};
      (salesRes.data || []).forEach((s) => {
        salesMap[s.id] = {
          refNo: `#${s.id}`,
          contactName: s.contacts?.name || 'Walk-in',
        };
      });

      const purchasesMap = {};
      (purchasesRes.data || []).forEach((p) => {
        purchasesMap[p.id] = {
          refNo: `#${p.id}`,
          contactName: p.contacts?.name || '—',
        };
      });

      const sellReturnsMap = {};
      (sellReturnsRes.data || []).forEach((sr) => {
        sellReturnsMap[sr.id] = {
          refNo: `#${sr.id}`,
          contactName: sr.contacts?.name || 'Walk-in',
        };
      });

      const prMap = {};
      const prData = purchaseReturnsRes.data || [];
      const prPurchaseIds = prData.map(pr => pr.purchase_id).filter(Boolean);
      let parentPurchasesRes = { data: [] };
      if (prPurchaseIds.length > 0) {
        parentPurchasesRes = await supabase
          .from('purchases')
          .select('id, contacts(name)')
          .in('id', prPurchaseIds);
      }
      const prPurchasesMap = {};
      (parentPurchasesRes.data || []).forEach(p => {
        prPurchasesMap[p.id] = p.contacts?.name || '—';
      });

      prData.forEach((pr) => {
        prMap[pr.id] = {
          refNo: `#${pr.id}`,
          contactName: prPurchasesMap[pr.purchase_id] || '—',
        };
      });

      setHistoryLedger(ledgerRows || []);
      setHistoryReferences({
        sales: salesMap,
        purchases: purchasesMap,
        sellReturns: sellReturnsMap,
        purchaseReturns: prMap,
      });
    } catch (err) {
      console.error('Error loading history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleOpenHistory = (prodId) => {
    setHistoryProductId(prodId);
    setHistoryLocationFilter('');
    loadProductHistory(prodId);
  };

  const handleCloseHistory = () => {
    setHistoryProductId(null);
    setHistoryLedger([]);
  };

  const selectedProductObj = useMemo(() => {
    return products.find(p => p.id === historyProductId);
  }, [products, historyProductId]);

  // Compute filtered logs for history view
  const computedHistoryLogs = useMemo(() => {
    return historyLedger.filter((log) => {
      if (historyLocationFilter && log.location_id !== Number(historyLocationFilter)) return false;
      return true;
    });
  }, [historyLedger, historyLocationFilter]);

  // Compute product history statistics summary cards
  const historySummary = useMemo(() => {
    let totalPurchase = 0;
    let totalSellReturn = 0;
    let soldOut = 0;
    let totalPurchaseReturn = 0;
    let totalStockAdjustment = 0;
    let openingStock = 0;

    // Filter logs chronologically (oldest first) to find opening stock details
    const chronologicalLogs = [...computedHistoryLogs].reverse();

    // Earliest entry is treated as opening stock if it is a manual setup adjustment or general entry.
    // To be perfectly mathematically sound and clean:
    if (chronologicalLogs.length > 0) {
      const firstLog = chronologicalLogs[0];
      if (firstLog.reason === 'adjustment') {
        openingStock = Number(firstLog.change_qty || 0);
      }
    }

    computedHistoryLogs.forEach((log, index) => {
      const qty = Number(log.change_qty || 0);
      const isFirst = (computedHistoryLogs.length - 1 - index) === 0;

      if (log.reason === 'purchase' || log.reason === 'purchase_edit') {
        totalPurchase += qty;
      } else if (log.reason === 'sell_return') {
        totalSellReturn += qty;
      } else if (log.reason === 'sale' || log.reason === 'sale_edit') {
        // Both represent stock actually going out on a sale.
        soldOut += Math.abs(qty);
      } else if (log.reason === 'sale_edit_reversal') {
        // This undoes a previous sale's deduction (positive change_qty,
        // stock put back) — it should reduce Sold Out, not add to it.
        soldOut -= Math.abs(qty);
      } else if (log.reason === 'purchase_return') {
        totalPurchaseReturn += Math.abs(qty);
      } else if (log.reason === 'adjustment') {
        // Skip the very first entry if it was opening stock
        if (!(isFirst && openingStock > 0)) {
          totalStockAdjustment += qty;
        }
      }
    });

    const currentStock = computedHistoryLogs.reduce((sum, log) => sum + Number(log.change_qty || 0), 0);

    return {
      totalPurchase,
      openingStock,
      totalSellReturn,
      soldOut,
      totalStockAdjustment,
      totalPurchaseReturn,
      currentStock,
    };
  }, [computedHistoryLogs]);

  // Paginated history logs
  const historyRowsPerPage = 25;
  const historyTotalPages = Math.ceil(computedHistoryLogs.length / historyRowsPerPage);
  const paginatedHistoryLogs = useMemo(() => {
    const start = (historyPage - 1) * historyRowsPerPage;
    return computedHistoryLogs.slice(start, start + historyRowsPerPage);
  }, [computedHistoryLogs, historyPage]);

  // Helper formatting utilities
  const cur = business?.currency || '';
  const fmt = (n) => `${cur} ${Number(n).toFixed(2)}`;

  // Reset pagination on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [locationFilter, categoryFilter, brandFilter]);

  return (
    <AppLayout>
      <style>{CSS}</style>
      <div className="report-page">
        {historyProductId == null ? (
          /* ─────────────────────────────────────────────────────────────
             MAIN STOCK REPORT PAGE
             ───────────────────────────────────────────────────────────── */
          <div className="stock-rep-container">
            {/* Standardized Print Header (print-only) */}
            <PrintReportHeader
              title="Stock Report"
              filters={[
                {
                  label: 'Location',
                  value: locationFilter ? (locations.find(l => String(l.id) === String(locationFilter))?.name || 'Unknown') : 'All Locations',
                },
                {
                  label: 'Category',
                  value: categoryFilter ? (categories.find(c => String(c.id) === String(categoryFilter))?.name || 'Unknown') : 'All Categories',
                },
                ...(brandFilter ? [{ label: 'Brand', value: brandFilter }] : []),
              ]}
            />
            {/* Filters Bar */}
            <div className="stock-rep-filters no-print">
              {/* Location Select — owners only */}
              {isOwner && (
                <div className="stock-filter-group">
                  <label htmlFor="filter-loc">Location</label>
                  <select
                    id="filter-loc"
                    className="stock-select-input"
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                  >
                    <option value="">All Locations</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Category Select */}
              <div className="stock-filter-group">
                <label htmlFor="filter-cat">Category</label>
                <select
                  id="filter-cat"
                  className="stock-select-input"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Brand Select */}
              <div className="stock-filter-group">
                <label htmlFor="filter-brand">Brand</label>
                <select
                  id="filter-brand"
                  className="stock-select-input"
                  value={brandFilter}
                  onChange={(e) => setBrandFilter(e.target.value)}
                >
                  <option value="">All Brands</option>
                  {brandsList.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              {/* Printing controls */}
              <div className="stock-btn-row">
                <button className="btn btn-secondary btn-sm" onClick={() => window.print()} style={{ marginRight: '8px' }}>
                  🖨️ Print
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => {
                  const locName = locationFilter ? (locations.find(l => String(l.id) === String(locationFilter))?.name || 'Unknown') : 'All Locations';
                  const catName = categoryFilter ? (categories.find(c => String(c.id) === String(categoryFilter))?.name || 'Unknown') : 'All Categories';
                  downloadPDF(buildPdfFilename('Stock Report', [{ value: locName }, { value: catName }]), 'landscape');
                }}>
                  📄 Save PDF
                </button>
              </div>
            </div>

            {/* Statistics Summary Cards */}
            <div className="stock-summary-grid">
              <div className="stock-sum-card">
                <span className="stock-sum-label">Closing Stock (Purchase Price)</span>
                <span className="stock-sum-val">{fmt(summary.purchaseVal)}</span>
                <span className="stock-sum-sub">Total valuation at cost</span>
              </div>
              <div className="stock-sum-card">
                <span className="stock-sum-label">Closing Stock (Sale Price)</span>
                <span className="stock-sum-val">{fmt(summary.saleVal)}</span>
                <span className="stock-sum-sub">Total valuation at selling price</span>
              </div>
              <div className="stock-sum-card">
                <span className="stock-sum-label">Potential Profit</span>
                <span className="stock-sum-val text-success">{fmt(summary.profit)}</span>
                <span className="stock-sum-sub">Estimated earnings</span>
              </div>
              <div className="stock-sum-card">
                <span className="stock-sum-label">Profit Margin %</span>
                <span className="stock-sum-val text-success">{summary.margin.toFixed(2)}%</span>
                <span className="stock-sum-sub">Potential earnings percentage</span>
              </div>
            </div>

            {/* Detailed Table Card */}
            <div className="stock-table-card">
              <div className="stock-table-header">
                <span className="stock-table-title">Product Details Breakdown</span>
                <span className="stock-table-count">{totalProductsCount} entries found</span>
              </div>

              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="no-print">Action</th>
                      <th className="no-print">SKU</th>
                      <th>Product Name</th>
                      <th>Location</th>
                      <th>Selling Price</th>
                      <th>Current Stock</th>
                      <th className="no-print">Stock Value (Cost)</th>
                      <th>Stock Evaluation</th>
                      <th className="no-print">Potential Profit</th>
                      <th>Total Sold</th>
                      <th>Total Transferred</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr>
                        <td colSpan={11} className="muted table-empty">Loading report data…</td>
                      </tr>
                    )}
                    {!loading && computedRows.length === 0 && (
                      <tr>
                        <td colSpan={11} className="muted table-empty">No stock matching the selected filters.</td>
                      </tr>
                    )}
                    {!loading && paginatedRows.map((r) => (
                      <tr key={`${r.product.id}:${r.location.id}`}>
                        <td className="stock-action-cell no-print">
                          <button
                            type="button"
                            className="btn-stock-action"
                            onClick={() => handleOpenHistory(r.product.id)}
                          >
                            🕒 History
                          </button>
                        </td>
                        <td className="no-print">{r.product.sku || '—'}</td>
                        <td>{r.product.name}</td>
                        <td>{r.location.name}</td>
                        <td>{fmt(r.sellingPrice)}</td>
                        <td>
                          {r.qty}{' '}
                          {r.isLow ? (
                            <span className="badge-low-stock">Low</span>
                          ) : (
                            <span className="badge-ok-stock">OK</span>
                          )}
                        </td>
                        <td className="no-print">{fmt(r.purchaseValue)}</td>
                        <td>{fmt(r.saleValue)}</td>
                        <td className="no-print text-success">{fmt(r.potentialProfit)}</td>
                        <td>{r.totalSold}</td>
                        <td>{r.totalTransferred}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              {!loading && totalPages > 1 && (
                <div className="pagination-bar no-print">
                  <div className="pagination-info">
                    Showing {((currentPage - 1) * rowsPerPage) + 1} to {Math.min(currentPage * rowsPerPage, totalProductsCount)} of {totalProductsCount} entries
                  </div>
                  <div className="pagination-actions">
                    <button
                      className="pagination-btn"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => prev - 1)}
                    >
                      Previous
                    </button>
                    <button
                      className="pagination-btn"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => prev + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ─────────────────────────────────────────────────────────────
             PRODUCT STOCK TRANSACTION HISTORY PAGE
             ───────────────────────────────────────────────────────────── */
          <div className="stock-rep-container">
            {/* History Header & Back button */}
            <div className="hist-header">
              <div className="hist-title-group">
                <button type="button" className="btn-back no-print" onClick={handleCloseHistory}>
                  ← Back to Stock Report
                </button>
                <h1 className="hist-title">Stock History: {selectedProductObj?.name || 'Loading product...'}</h1>
                <span className="hist-meta">SKU: {selectedProductObj?.sku || '—'}</span>
              </div>

              <div className="stock-rep-filters no-print" style={{ margin: 0, padding: '6px 12px', border: '1px solid var(--border-light)' }}>
                <div className="stock-filter-group" style={{ minWidth: '150px' }}>
                  <select
                    className="stock-select-input"
                    value={historyLocationFilter}
                    onChange={(e) => setHistoryLocationFilter(e.target.value)}
                  >
                    <option value="">All Locations</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => window.print()} style={{ marginRight: '8px' }}>
                  🖨️ Print
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => {
                  const locName = selectedHistoryProduct?.name || 'Product';
                  downloadPDF(buildPdfFilename('Stock History', [{ value: locName }]));
                }}>
                  📄 Save PDF
                </button>
              </div>
            </div>

            {/* Product History Metrics */}
            <div className="hist-summary-grid">
              <div className="hist-sum-card">
                <div className="hist-sum-card-label">Opening Stock</div>
                <div className="hist-sum-card-val">{historySummary.openingStock}</div>
              </div>
              <div className="hist-sum-card">
                <div className="hist-sum-card-label">Total Purchase</div>
                <div className="hist-sum-card-val text-success">+{historySummary.totalPurchase}</div>
              </div>
              <div className="hist-sum-card">
                <div className="hist-sum-card-label">Total Sell Return</div>
                <div className="hist-sum-card-val text-success">+{historySummary.totalSellReturn}</div>
              </div>
              <div className="hist-sum-card">
                <div className="hist-sum-card-label">Stock Transfer (In)</div>
                <div className="hist-sum-card-val">0</div>
              </div>
              <div className="hist-sum-card">
                <div className="hist-sum-card-label">Sold Out</div>
                <div className="hist-sum-card-val text-danger">-{historySummary.soldOut}</div>
              </div>
              <div className="hist-sum-card">
                <div className="hist-sum-card-label">Total Stock Adjustment</div>
                <div className="hist-sum-card-val text-warning">
                  {historySummary.totalStockAdjustment >= 0 ? '+' : ''}{historySummary.totalStockAdjustment}
                </div>
              </div>
              <div className="hist-sum-card">
                <div className="hist-sum-card-label">Total Purchase Return</div>
                <div className="hist-sum-card-val text-danger">-{historySummary.totalPurchaseReturn}</div>
              </div>
              <div className="hist-sum-card">
                <div className="hist-sum-card-label">Stock Transfer (Out)</div>
                <div className="hist-sum-card-val">0</div>
              </div>
              <div className="hist-sum-card" style={{ background: 'var(--navy-50)', border: '1px solid var(--navy-border)' }}>
                <div className="hist-sum-card-label" style={{ color: 'var(--navy-900)' }}>Current Stock</div>
                <div className="hist-sum-card-val" style={{ color: 'var(--navy-900)', fontSize: 18 }}>{historySummary.currentStock}</div>
              </div>
            </div>

            {/* Detailed Transaction Logs Table */}
            <div className="stock-table-card">
              <div className="stock-table-header">
                <span className="stock-table-title">Transaction Log History</span>
                <span className="stock-table-count">{computedHistoryLogs.length} transactions</span>
              </div>

              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date &amp; Time</th>
                      <th>Location</th>
                      <th>Transaction Type</th>
                      <th>Quantity Change</th>
                      <th>Reference Number</th>
                      <th>Customer / Supplier Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyLoading && (
                      <tr>
                        <td colSpan={6} className="muted table-empty">Loading history logs…</td>
                      </tr>
                    )}
                    {!historyLoading && computedHistoryLogs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="muted table-empty">No transaction log entries.</td>
                      </tr>
                    )}
                    {!historyLoading && paginatedHistoryLogs.map((log) => {
                      // Determine transaction display parameters
                      let typeLabel = log.reason || 'adjustment';
                      let quantityChangeLabel = `${log.change_qty > 0 ? '+' : ''}${log.change_qty}`;
                      let qtyClass = log.change_qty > 0 ? 'text-success' : log.change_qty < 0 ? 'text-danger' : '';

                      let refNo = '—';
                      let contactName = '—';

                      const refId = log.reference_id;
                      if (refId) {
                        if (log.reference_type === 'sale' || log.reason === 'sale') {
                          typeLabel = 'Sale';
                          refNo = historyReferences.sales[refId]?.refNo || `#${refId}`;
                          contactName = historyReferences.sales[refId]?.contactName || 'Walk-in';
                        } else if (log.reference_type === 'purchase' || log.reason === 'purchase') {
                          typeLabel = 'Purchase';
                          refNo = historyReferences.purchases[refId]?.refNo || `#${refId}`;
                          contactName = historyReferences.purchases[refId]?.contactName || '—';
                        } else if (log.reference_type === 'sell_return' || log.reason === 'sell_return') {
                          typeLabel = 'Sell Return';
                          refNo = historyReferences.sellReturns[refId]?.refNo || `#${refId}`;
                          contactName = historyReferences.sellReturns[refId]?.contactName || 'Walk-in';
                        } else if (log.reference_type === 'purchase_return' || log.reason === 'purchase_return') {
                          typeLabel = 'Purchase Return';
                          refNo = historyReferences.purchaseReturns[refId]?.refNo || `#${refId}`;
                          contactName = historyReferences.purchaseReturns[refId]?.contactName || '—';
                        }
                      } else if (log.reason === 'adjustment') {
                        typeLabel = 'Stock Adjustment';
                      }

                      // Capitalize type label nicely
                      typeLabel = typeLabel.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());

                      return (
                        <tr key={log.id}>
                          <td>{log.created_at ? formatTimestamp(log.created_at, business?.time_zone) : '—'}</td>
                          <td>{locations.find(l => l.id === log.location_id)?.name || '—'}</td>
                          <td>
                            <span style={{ fontWeight: 600 }}>{typeLabel}</span>
                          </td>
                          <td>
                            <span className={qtyClass} style={{ fontWeight: 700 }}>
                              {quantityChangeLabel}
                            </span>
                          </td>
                          <td>{refNo}</td>
                          <td>{contactName}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination control bar for history logs */}
              {!historyLoading && historyTotalPages > 1 && (
                <div className="pagination-bar no-print">
                  <div className="pagination-info">
                    Showing {((historyPage - 1) * historyRowsPerPage) + 1} to {Math.min(historyPage * historyRowsPerPage, computedHistoryLogs.length)} of {computedHistoryLogs.length} logs
                  </div>
                  <div className="pagination-actions">
                    <button
                      className="pagination-btn"
                      disabled={historyPage === 1}
                      onClick={() => setHistoryPage(prev => prev - 1)}
                    >
                      Previous
                    </button>
                    <button
                      className="pagination-btn"
                      disabled={historyPage === historyTotalPages}
                      onClick={() => setHistoryPage(prev => prev + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}