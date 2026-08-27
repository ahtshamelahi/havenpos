import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout.jsx';
import Pagination from '../components/Pagination.jsx';
import SortableHeader from '../components/SortableHeader.jsx';
import PrintReportHeader from '../components/PrintReportHeader.jsx';
import { downloadPDF, buildPdfFilename } from '../utils/pdfGenerator.js';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';
import { fetchAllBatched } from '../lib/fetchUtils.js';

export default function Products() {
  const { business, can, profile } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [printRows, setPrintRows] = useState(null);
  const [categories, setCategories] = useState({});
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState('');

  // Core filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Advanced filter panel
  const [filterOpen, setFilterOpen] = useState(false);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minStock, setMinStock] = useState('');
  const [maxStock, setMaxStock] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [sortKey, setSortKey] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 50;

  // Print page-scope
  const [printScope, setPrintScope] = useState('current');
  const [printFrom, setPrintFrom] = useState(1);
  const [printTo, setPrintTo] = useState(1);

  const canCreate = profile?.is_owner || can('products', 'create');
  const canEdit = profile?.is_owner || can('products', 'edit');
  const canDelete = profile?.is_owner || can('products', 'delete');

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const firstItemIndex = (currentPage - 1) * itemsPerPage;
  const lastItemIndex = Math.min(firstItemIndex + itemsPerPage - 1, totalItems - 1);

  // Count active advanced filters
  const advancedCount = [minPrice, maxPrice, minStock, maxStock, lowStockOnly].filter(Boolean).length;

  useEffect(() => { setPrintTo(totalPages || 1); }, [totalPages]);

  // ── Data loaders ─────────────────────────────────────────────────────────────
  const loadCategories = async () => {
    if (!business?.id) return;
    const { data } = await supabase.from('categories').select('id, name').eq('business_id', business.id);
    if (data) setCategories(Object.fromEntries(data.map(c => [c.id, c.name])));
  };

  const loadProducts = useCallback(async () => {
    if (!business?.id) return;
    setLoading(true);
    setError('');
    try {
      let query = supabase.from('products').select('*', { count: 'exact' }).eq('business_id', business.id);

      if (searchQuery.trim()) {
        const q = `%${searchQuery.trim()}%`;
        query = query.or(`name.ilike.${q},sku.ilike.${q}`);
      }
      if (categoryFilter) query = query.eq('category_id', categoryFilter);
      if (statusFilter === 'active') query = query.eq('is_active', true);
      if (statusFilter === 'inactive') query = query.eq('is_active', false);
      if (minPrice !== '') query = query.gte('default_selling_price', Number(minPrice));
      if (maxPrice !== '') query = query.lte('default_selling_price', Number(maxPrice));

      let dbSortKey = sortKey;
      if (sortKey === 'category') dbSortKey = 'category_id';
      if (sortKey === 'status') dbSortKey = 'is_active';
      if (sortKey === 'current_stock') dbSortKey = 'created_at';

      query = query.order(dbSortKey, { ascending: sortDirection === 'asc' });
      query = query.range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);

      const { data: productRows, count, error: productError } = await query;
      if (productError) throw productError;
      setTotalItems(count || 0);

      const products = productRows || [];
      if (products.length > 0) {
        const { data: ledgerRows, error: ledgerError } = await fetchAllBatched(() =>
          supabase
            .from('stock_ledger').select('product_id, change_qty')
            .eq('business_id', business.id).in('product_id', products.map(p => p.id))
        );
        if (ledgerError) throw ledgerError;

        const stockByProduct = {};
        (ledgerRows || []).forEach(row => {
          stockByProduct[row.product_id] = (stockByProduct[row.product_id] || 0) + Number(row.change_qty || 0);
        });

        let productsWithStock = products.map(product => ({
          ...product, current_stock: stockByProduct[product.id] || 0,
        }));

        // Client-side advanced filters that need stock data
        if (minStock !== '') productsWithStock = productsWithStock.filter(p => p.current_stock >= Number(minStock));
        if (maxStock !== '') productsWithStock = productsWithStock.filter(p => p.current_stock <= Number(maxStock));
        if (lowStockOnly) productsWithStock = productsWithStock.filter(p =>
          p.alert_quantity !== null && p.alert_quantity !== undefined && p.current_stock <= Number(p.alert_quantity)
        );

        if (sortKey === 'current_stock') {
          productsWithStock.sort((a, b) =>
            sortDirection === 'asc' ? a.current_stock - b.current_stock : b.current_stock - a.current_stock
          );
        }
        setRows(productsWithStock);
      } else {
        setRows([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [business?.id, searchQuery, categoryFilter, statusFilter, minPrice, maxPrice, minStock, maxStock, lowStockOnly, sortKey, sortDirection, currentPage]);

  useEffect(() => { loadCategories(); }, [business?.id]);
  useEffect(() => { loadProducts(); }, [loadProducts]);

  // ── Fetch rows for a specific page range (for print/PDF) ──────────────────
  const fetchRangeRows = useCallback(async (fromPage, toPage) => {
    if (!business?.id) return [];
    const from = (Math.max(1, fromPage) - 1) * itemsPerPage;
    const to = Math.min(totalPages, toPage) * itemsPerPage - 1;

    let query = supabase.from('products').select('*').eq('business_id', business.id);
    if (searchQuery.trim()) {
      const q = `%${searchQuery.trim()}%`;
      query = query.or(`name.ilike.${q},sku.ilike.${q}`);
    }
    if (categoryFilter) query = query.eq('category_id', categoryFilter);
    if (statusFilter === 'active') query = query.eq('is_active', true);
    if (statusFilter === 'inactive') query = query.eq('is_active', false);
    if (minPrice !== '') query = query.gte('default_selling_price', Number(minPrice));
    if (maxPrice !== '') query = query.lte('default_selling_price', Number(maxPrice));

    let dbSortKey = sortKey;
    if (sortKey === 'category') dbSortKey = 'category_id';
    if (sortKey === 'status') dbSortKey = 'is_active';
    if (sortKey === 'current_stock') dbSortKey = 'created_at';

    query = query.order(dbSortKey, { ascending: sortDirection === 'asc' }).range(from, to);
    const { data: productRows } = await query;
    const products = productRows || [];

    if (products.length > 0) {
      const { data: ledgerRows } = await fetchAllBatched(() =>
        supabase
          .from('stock_ledger').select('product_id, change_qty')
          .eq('business_id', business.id).in('product_id', products.map(p => p.id))
      );
      const stockByProduct = {};
      (ledgerRows || []).forEach(row => {
        stockByProduct[row.product_id] = (stockByProduct[row.product_id] || 0) + Number(row.change_qty || 0);
      });
      let productsWithStock = products.map(product => ({
        ...product, current_stock: stockByProduct[product.id] || 0,
      }));
      if (minStock !== '') productsWithStock = productsWithStock.filter(p => p.current_stock >= Number(minStock));
      if (maxStock !== '') productsWithStock = productsWithStock.filter(p => p.current_stock <= Number(maxStock));
      if (lowStockOnly) productsWithStock = productsWithStock.filter(p =>
        p.alert_quantity !== null && p.alert_quantity !== undefined && p.current_stock <= Number(p.alert_quantity)
      );
      if (sortKey === 'current_stock') {
        productsWithStock.sort((a, b) =>
          sortDirection === 'asc' ? a.current_stock - b.current_stock : b.current_stock - a.current_stock
        );
      }
      return productsWithStock;
    }
    return products;
  }, [business?.id, searchQuery, categoryFilter, statusFilter, minPrice, maxPrice, minStock, maxStock, lowStockOnly, sortKey, sortDirection, totalPages]);

  // ── Filter change handlers ────────────────────────────────────────────────
  const handleSearch = (e) => { setSearchQuery(e.target.value); setCurrentPage(1); };
  const handleCategoryChange = (e) => { setCategoryFilter(e.target.value); setCurrentPage(1); };
  const handleStatusChange = (e) => { setStatusFilter(e.target.value); setCurrentPage(1); };

  const clearAdvancedFilters = () => {
    setMinPrice(''); setMaxPrice('');
    setMinStock(''); setMaxStock('');
    setLowStockOnly(false);
    setCurrentPage(1);
  };

  const toggleSortKey = (key) => {
    if (sortKey === key) setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDirection('asc'); }
    setCurrentPage(1);
  };

  const handleDelete = async (product) => {
    const confirmed = window.confirm(`Are you sure you want to delete "${product.name}"?`);
    if (!confirmed) return;
    setError('');
    const { error: deleteError } = await supabase
      .from('products').delete().eq('id', product.id).eq('business_id', business.id);
    if (deleteError) {
      setError(`Unable to delete "${product.name}". It may already be used in stock, sales, purchases, or other records.`);
      return;
    }
    loadProducts();
  };

  // ── Active filters for print header ───────────────────────────────────────
  const activeFilters = useMemo(() => {
    const filters = [];
    if (searchQuery.trim()) filters.push({ label: 'Search', value: searchQuery.trim() });
    if (categoryFilter) filters.push({ label: 'Category', value: categories[categoryFilter] || categoryFilter });
    if (statusFilter) filters.push({ label: 'Status', value: statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1) });
    if (minPrice !== '') filters.push({ label: 'Min Price', value: (business?.currency || '') + ' ' + minPrice });
    if (maxPrice !== '') filters.push({ label: 'Max Price', value: (business?.currency || '') + ' ' + maxPrice });
    if (minStock !== '') filters.push({ label: 'Min Stock', value: minStock });
    if (maxStock !== '') filters.push({ label: 'Max Stock', value: maxStock });
    if (lowStockOnly) filters.push({ label: 'Stock Alert', value: 'Low stock only' });
    if (totalPages > 1) {
      if (printScope === 'all') filters.push({ label: 'Pages', value: `All (1-${totalPages})` });
      if (printScope === 'range') filters.push({ label: 'Pages', value: `${printFrom}-${Math.min(printTo, totalPages)} of ${totalPages}` });
      if (printScope === 'current') filters.push({ label: 'Page', value: String(currentPage) });
    }
    return filters;
  }, [searchQuery, categoryFilter, statusFilter, minPrice, maxPrice, minStock, maxStock, lowStockOnly, categories, business, totalPages, printScope, printFrom, printTo, currentPage]);

  // ── Resolve which rows to print, then act ────────────────────────────────
  const resolveAndAct = useCallback(async (action) => {
    setPdfLoading(true);
    try {
      let resolved;
      if (printScope === 'current') {
        resolved = rows;
      } else if (printScope === 'all') {
        resolved = await fetchRangeRows(1, totalPages);
      } else {
        const f = Math.max(1, printFrom);
        const t = Math.min(totalPages, Math.max(f, printTo));
        resolved = await fetchRangeRows(f, t);
      }
      setPrintRows(resolved);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      await action();
    } finally {
      setPrintRows(null);
      setPdfLoading(false);
    }
  }, [printScope, printFrom, printTo, totalPages, rows, fetchRangeRows]);

  const handlePrint = () => resolveAndAct(async () => window.print());
  const handleSavePDF = () => resolveAndAct(async () => {
    const filterParts = [
      ...activeFilters.filter(f => f.label !== 'Pages' && f.label !== 'Page').map(f => ({ value: f.value })),
      printScope === 'all' ? { value: 'All_Pages' } :
        printScope === 'range' ? { value: `Pages_${printFrom}-${Math.min(printTo, totalPages)}` } :
          { value: `Page_${currentPage}` },
    ];
    await downloadPDF(buildPdfFilename('Products', filterParts));
  });

  const displayRows = printRows !== null ? printRows : rows;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <style>{`
        /* ── Advanced filter panel slide-down ── */
        .products-filter-panel {
          overflow: hidden;
          max-height: 0;
          opacity: 0;
          transition: max-height 0.32s ease, opacity 0.25s ease, margin-bottom 0.32s ease;
          margin-bottom: 0;
        }
        .products-filter-panel.open {
          max-height: 400px;
          opacity: 1;
          margin-bottom: 16px;
        }
        .pf-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(185px, 1fr));
          gap: 14px;
          padding: 18px 20px 14px;
        }
        .pf-field { display: flex; flex-direction: column; gap: 5px; }
        .pf-label {
          font-size: 10.5px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.06em; color: var(--navy-500, #2d5f8a);
        }
        .pf-input {
          padding: 7px 10px; font-size: 13px;
          border: 1.5px solid var(--navy-border, #c9d6e3); border-radius: 6px;
          background: var(--card-bg, #fff); color: inherit; outline: none;
          transition: border-color 0.18s, box-shadow 0.18s;
          width: 100%; box-sizing: border-box;
        }
        .pf-input:focus { border-color: var(--navy-500, #2d6fa8); box-shadow: 0 0 0 3px rgba(45,111,168,.12); }
        .pf-toggle-row {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 0; cursor: pointer; user-select: none;
        }
        .pf-toggle-track {
          width: 38px; height: 21px; border-radius: 11px;
          background: var(--navy-border, #c9d6e3);
          position: relative; transition: background 0.22s; flex-shrink: 0;
        }
        .pf-toggle-track.on { background: #22c55e; }
        .pf-toggle-thumb {
          width: 15px; height: 15px; border-radius: 50%; background: #fff;
          position: absolute; top: 3px; left: 3px;
          transition: transform 0.22s; box-shadow: 0 1px 4px rgba(0,0,0,.22);
        }
        .pf-toggle-track.on .pf-toggle-thumb { transform: translateX(17px); }
        .pf-toggle-label { font-size: 13px; font-weight: 500; }
        .pf-footer {
          display: flex; justify-content: space-between; align-items: center;
          padding: 10px 20px 14px;
          border-top: 1px solid var(--navy-border, #e5e7eb);
          margin-top: 2px;
        }
        .pf-status-text { font-size: 12px; color: var(--navy-500, #2d5f8a); font-weight: 600; }
        .filter-badge {
          display: inline-flex; align-items: center; justify-content: center;
          background: #ef4444; color: #fff; font-size: 10px; font-weight: 800;
          border-radius: 10px; min-width: 17px; height: 17px; padding: 0 4px;
          margin-left: 4px; line-height: 1; vertical-align: middle;
        }
        /* ── Print / PDF column hiding ── */
        @media print {
          .products-table .data-table th:nth-child(2),
          .products-table .data-table td:nth-child(2),
          .products-table .data-table th:nth-child(4),
          .products-table .data-table td:nth-child(4),
          .products-table .data-table th:nth-child(8),
          .products-table .data-table td:nth-child(8),
          .products-table .data-table th:nth-child(9),
          .products-table .data-table td:nth-child(9) { display: none !important; }
        }
        .pdf-export-mode .products-table .data-table th:nth-child(2),
        .pdf-export-mode .products-table .data-table td:nth-child(2),
        .pdf-export-mode .products-table .data-table th:nth-child(4),
        .pdf-export-mode .products-table .data-table td:nth-child(4),
        .pdf-export-mode .products-table .data-table th:nth-child(8),
        .pdf-export-mode .products-table .data-table td:nth-child(8),
        .pdf-export-mode .products-table .data-table th:nth-child(9),
        .pdf-export-mode .products-table .data-table td:nth-child(9) { display: none !important; }
      `}</style>

      {/* ── Page header ── */}
      <div className="page-header no-print">
        <div>
          <h1>Products | Catalog for {business?.business_name}.</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Link to="/categories" className="btn btn-secondary">Categories</Link>
          <Link to="/tax-rates" className="btn btn-secondary">Tax rates</Link>

          {/* Page-range picker */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--navy-50, #f0f4f8)',
              border: '1px solid var(--navy-border, #c9d6e3)',
              borderRadius: 8, padding: '4px 10px', fontSize: 13,
            }}>
              <span style={{ fontWeight: 600, color: 'var(--navy-600, #2d5f8a)', whiteSpace: 'nowrap' }}>
                Pages:
              </span>
              <select
                value={printScope}
                onChange={e => setPrintScope(e.target.value)}
                style={{ border: '1px solid var(--navy-border,#c9d6e3)', borderRadius: 5, padding: '2px 6px', fontSize: 13, background: 'white', cursor: 'pointer' }}
              >
                <option value="current">Current ({currentPage})</option>
                <option value="all">All pages (1\u2013{totalPages})</option>
                <option value="range">Range</option>
              </select>
              {printScope === 'range' && (
                <>
                  <span style={{ color: '#6b7280', fontSize: 12 }}>From</span>
                  <input type="number" min={1} max={totalPages} value={printFrom}
                    onChange={e => setPrintFrom(Math.max(1, Math.min(totalPages, Number(e.target.value) || 1)))}
                    style={{ width: 48, textAlign: 'center', border: '1px solid var(--navy-border,#c9d6e3)', borderRadius: 5, padding: '2px 4px', fontSize: 13 }}
                  />
                  <span style={{ color: '#6b7280', fontSize: 12 }}>to</span>
                  <input type="number" min={printFrom} max={totalPages} value={printTo}
                    onChange={e => setPrintTo(Math.max(printFrom, Math.min(totalPages, Number(e.target.value) || totalPages)))}
                    style={{ width: 48, textAlign: 'center', border: '1px solid var(--navy-border,#c9d6e3)', borderRadius: 5, padding: '2px 4px', fontSize: 13 }}
                  />
                  <span style={{ color: '#9ca3af', fontSize: 11 }}>of {totalPages}</span>
                </>
              )}
            </div>
          )}

          <button className="btn btn-secondary" onClick={handlePrint} disabled={pdfLoading} title="Print products list">
            {pdfLoading ? '\u23F3' : '\uD83D\uDDA8\uFE0F'} Print PDF
          </button>
          <button className="btn btn-primary" onClick={handleSavePDF} disabled={pdfLoading} title="Save as PDF file">
            {pdfLoading ? '\u23F3' : '\uD83D\uDCC4'} Save PDF
          </button>
          {canCreate && (
            <button className="btn btn-primary" onClick={() => navigate('/products/new')}>
              + Add product
            </button>
          )}
        </div>
      </div>

      <PrintReportHeader title="Products Catalog" filters={activeFilters} />

      {/* ── Advanced Filter Panel (slide-down) ── */}
      <div className={`card no-print products-filter-panel ${filterOpen ? 'open' : ''}`}>
        <div style={{ padding: '14px 20px 8px', borderBottom: '1px solid var(--navy-border,#e5e7eb)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy-700, #1e3a5f)' }}>
            Advanced Filters
          </span>
          {advancedCount > 0 && (
            <span style={{ fontSize: 12, background: '#fef3c7', color: '#92400e', borderRadius: 4, padding: '2px 8px', fontWeight: 600 }}>
              {advancedCount} filter{advancedCount > 1 ? 's' : ''} active
            </span>
          )}
        </div>

        <div className="pf-grid">
          <div className="pf-field">
            <label className="pf-label">Min Selling Price ({business?.currency})</label>
            <input className="pf-input" type="number" min="0" step="0.01" placeholder="e.g. 10"
              value={minPrice} onChange={e => { setMinPrice(e.target.value); setCurrentPage(1); }} />
          </div>
          <div className="pf-field">
            <label className="pf-label">Max Selling Price ({business?.currency})</label>
            <input className="pf-input" type="number" min="0" step="0.01" placeholder="e.g. 500"
              value={maxPrice} onChange={e => { setMaxPrice(e.target.value); setCurrentPage(1); }} />
          </div>
          <div className="pf-field">
            <label className="pf-label">Min Stock Qty</label>
            <input className="pf-input" type="number" min="0" placeholder="e.g. 0"
              value={minStock} onChange={e => { setMinStock(e.target.value); setCurrentPage(1); }} />
          </div>
          <div className="pf-field">
            <label className="pf-label">Max Stock Qty</label>
            <input className="pf-input" type="number" min="0" placeholder="e.g. 100"
              value={maxStock} onChange={e => { setMaxStock(e.target.value); setCurrentPage(1); }} />
          </div>
          <div className="pf-field" style={{ justifyContent: 'flex-end', paddingTop: 4 }}>
            <label className="pf-label">Stock Alert Filter</label>
            <label className="pf-toggle-row" onClick={() => { setLowStockOnly(v => !v); setCurrentPage(1); }}>
              <div className={`pf-toggle-track ${lowStockOnly ? 'on' : ''}`}>
                <div className="pf-toggle-thumb" />
              </div>
              <span className="pf-toggle-label" style={{ color: lowStockOnly ? '#ef4444' : 'inherit' }}>
                {lowStockOnly ? '\u26A0\uFE0F Low stock only' : 'All stock levels'}
              </span>
            </label>
          </div>
        </div>

        <div className="pf-footer">
          <span className="pf-status-text">
            {advancedCount === 0 ? 'No advanced filters applied' : advancedCount + ' advanced filter' + (advancedCount > 1 ? 's' : '') + ' applied'}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={clearAdvancedFilters} disabled={advancedCount === 0}>
            Clear all
          </button>
        </div>
      </div>

      {/* ── Products table ── */}
      <div className="card list-panel products-table">
        <div className="list-toolbar no-print" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="data-search-bar" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: '1px solid var(--navy-border)', borderRadius: 6, flex: 1, minWidth: 220 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" style={{ opacity: 0.5 }}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input type="text" placeholder="Search by name or SKU" value={searchQuery} onChange={handleSearch}
              style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', color: 'inherit' }} />
          </div>

          <select className="data-sort-select" value={categoryFilter} onChange={handleCategoryChange}>
            <option value="">All Categories</option>
            {Object.entries(categories).map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>

          <select className="data-sort-select" value={statusFilter} onChange={handleStatusChange}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          {/* Advanced filter toggle */}
          <button
            className={`btn btn-sm ${filterOpen ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterOpen(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
            title="Toggle advanced filters"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            {filterOpen ? 'Hide Filters' : 'Filters'}
            {advancedCount > 0 && <span className="filter-badge">{advancedCount}</span>}
          </button>
        </div>

        {error && <div className="error-text" style={{ padding: '0 16px 10px' }}>{error}</div>}

        <table className="data-table">
          <thead>
            <tr>
              <SortableHeader label="Product" sortKey="name" currentSortKey={sortKey} sortDirection={sortDirection} toggleSortKey={toggleSortKey} />
              <SortableHeader label="SKU" sortKey="sku" currentSortKey={sortKey} sortDirection={sortDirection} toggleSortKey={toggleSortKey} />
              <SortableHeader label="Current stock" sortKey="current_stock" currentSortKey={sortKey} sortDirection={sortDirection} toggleSortKey={toggleSortKey} />
              <SortableHeader label="Alert quantity" sortKey="alert_quantity" currentSortKey={sortKey} sortDirection={sortDirection} toggleSortKey={toggleSortKey} />
              <SortableHeader label="Category" sortKey="category" currentSortKey={sortKey} sortDirection={sortDirection} toggleSortKey={toggleSortKey} />
              <SortableHeader label="Cost" sortKey="cost_price" currentSortKey={sortKey} sortDirection={sortDirection} toggleSortKey={toggleSortKey} />
              <SortableHeader label="Selling price" sortKey="default_selling_price" currentSortKey={sortKey} sortDirection={sortDirection} toggleSortKey={toggleSortKey} />
              <SortableHeader label="Status" sortKey="status" currentSortKey={sortKey} sortDirection={sortDirection} toggleSortKey={toggleSortKey} />
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="muted table-empty">Loading</td></tr>}
            {!loading && displayRows.length === 0 && (
              <tr>
                <td colSpan={9} className="muted table-empty">
                  {searchQuery || categoryFilter || statusFilter || advancedCount > 0 ? 'No matching products found.' : 'No products yet.'}
                </td>
              </tr>
            )}
            {!loading && displayRows.map((p) => {
              const currentStock = Number(p.current_stock || 0);
              const alertQuantity = Number(p.alert_quantity || 0);
              const isLowStock = p.alert_quantity !== null && p.alert_quantity !== undefined && currentStock <= alertQuantity;
              return (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.sku}</td>
                  <td><span className={isLowStock ? 'badge badge-danger' : ''}>{currentStock}</span></td>
                  <td>{p.alert_quantity !== null && p.alert_quantity !== undefined ? p.alert_quantity : '\u2014'}</td>
                  <td>{categories[p.category_id] || '\u2014'}</td>
                  <td>{business?.currency} {Number(p.cost_price).toFixed(2)}</td>
                  <td>{business?.currency} {Number(p.default_selling_price).toFixed(2)}</td>
                  <td>
                    {p.is_active ? <span className="badge badge-success">Active</span> : <span className="badge badge-danger">Inactive</span>}
                  </td>
                  <td className="table-actions">
                    {canEdit && <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/products/${p.id}/edit`)}>Edit</button>}
                    {canDelete && <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(p)}>Delete</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!loading && totalItems > 0 && printRows === null && (
          <Pagination
            currentPage={currentPage} totalPages={totalPages} totalItems={totalItems}
            firstItemIndex={firstItemIndex} lastItemIndex={lastItemIndex}
            goToPage={setCurrentPage}
            nextPage={() => setCurrentPage(p => p + 1)}
            previousPage={() => setCurrentPage(p => p - 1)}
            hasNextPage={currentPage < totalPages}
            hasPreviousPage={currentPage > 1}
          />
        )}
      </div>
    </AppLayout>
  );
}