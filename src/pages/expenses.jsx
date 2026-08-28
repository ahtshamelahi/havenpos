import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout.jsx';
import ExpenseFormDialog from '../components/expenses/ExpenseFormDialog.jsx';
import ExpenseViewDrawer, { DeleteExpenseDialog } from '../components/expenses/ExpenseViewDrawer.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';
import { fetchAllBatched } from '../lib/fetchUtils.js';
import { getPresetRange } from '../lib/dateRanges.js';
import {
  EXPENSE_DATE_PRESETS,
  EXPENSE_PAYMENT_METHODS,
  STATUS_BADGE,
  exportExpensesCsv,
  formatMoney,
  getExpenseStatus,
  getExpenseTitle,
  matchesDatePreset,
  sumAmounts,
} from '../lib/expenseUtils.js';
import './expenses.css';

import { todayLocal } from '../lib/timezone.js';

export default function Expenses() {
  const { business, profile, can } = useAuth();

  const [rows, setRows] = useState([]);
  const [categoryList, setCategoryList] = useState([]);
  const [locationList, setLocationList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState('all');
  const [customRange, setCustomRange] = useState({ from: '', to: '' });
  const [categoryFilter, setCategoryFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [viewExpense, setViewExpense] = useState(null);
  const [deleteExpense, setDeleteExpense] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const canCreate = profile?.is_owner || can('expenses', 'create');
  const canEdit = profile?.is_owner || can('expenses', 'edit');
  const canDelete = profile?.is_owner || can('expenses', 'delete');

  const categories = useMemo(
    () => Object.fromEntries(categoryList.map((c) => [c.id, c.name])),
    [categoryList],
  );

  const locations = useMemo(
    () => Object.fromEntries(locationList.map((l) => [l.id, l.name])),
    [locationList],
  );

  const load = async () => {
    if (!business?.id) return;
    setLoading(true);
    setError('');

    const [{ data: expenseRows, error: err }, { data: catRows }, { data: locRows }] = await Promise.all([
      fetchAllBatched(() =>
        supabase
          .from('expenses')
          .select('*')
          .eq('business_id', business.id)
          .order('expense_date', { ascending: false })
      ),
      supabase
        .from('expense_categories')
        .select('id, name')
        .eq('business_id', business.id)
        .order('name'),
      supabase
        .from('locations')
        .select('id, name')
        .eq('business_id', business.id)
        .eq('is_active', true),
    ]);

    if (err) setError(err.message);
    setRows(expenseRows || []);
    setCategoryList(catRows || []);
    setLocationList(locRows || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [business?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (categoryFilter && String(row.category_id) !== String(categoryFilter)) return false;
      if (locationFilter && String(row.location_id) !== String(locationFilter)) return false;
      if (paymentFilter && row.payment_method !== paymentFilter) return false;
      if (statusFilter && getExpenseStatus(row) !== statusFilter) return false;
      if (!matchesDatePreset(row, datePreset, customRange, business?.time_zone)) return false;

      if (!q) return true;

      const title = getExpenseTitle(row, categories).toLowerCase();
      const haystack = [
        title,
        String(row.id),
        categories[row.category_id] || '',
        locations[row.location_id] || '',
        row.vendor || '',
        row.reference_number || '',
        row.note || '',
        row.payment_method || '',
      ].join(' ').toLowerCase();

      return haystack.includes(q);
    });
  }, [
    rows,
    search,
    categoryFilter,
    locationFilter,
    paymentFilter,
    statusFilter,
    datePreset,
    customRange,
    categories,
    locations,
  ]);

  const monthRange = useMemo(() => getPresetRange('this_month'), []);
  const today = todayStr();

  const summary = useMemo(() => {
    const totalAll = sumAmounts(rows);
    const todayTotal = sumAmounts(rows.filter((r) => r.expense_date === today));
    const monthTotal = sumAmounts(
      rows.filter((r) => {
        if (monthRange.from && r.expense_date < monthRange.from) return false;
        if (monthRange.to && r.expense_date > monthRange.to) return false;
        return true;
      }),
    );
    const pendingTotal = sumAmounts(rows.filter((r) => getExpenseStatus(r) === 'pending'));
    const paidTotal = sumAmounts(rows.filter((r) => getExpenseStatus(r) === 'paid'));

    return { totalAll, todayTotal, monthTotal, pendingTotal, paidTotal };
  }, [rows, today, monthRange]);

  const openCreate = () => {
    setEditId(null);
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setViewExpense(null);
    setEditId(row.id);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteExpense) return;
    setDeleting(true);
    setError('');
    try {
      const { error: err } = await supabase.from('expenses').delete().eq('id', deleteExpense.id);
      if (err) throw err;
      setDeleteExpense(null);
      load();
    } catch (err) {
      setError(err.message || 'Could not delete this expense.');
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = () => {
    exportExpensesCsv(filtered, {
      categories,
      locations,
      currency: business?.currency,
      businessName: business?.business_name,
      tz: business?.time_zone,
    });
  };

  const handlePrint = () => window.print();

  const handlePresetChange = (preset) => {
    setDatePreset(preset);
    if (preset !== 'custom') {
      setCustomRange({ from: '', to: '' });
    }
  };

  const handleFormSaved = () => {
    setFormOpen(false);
    setEditId(null);
    load();
  };

  return (
    <AppLayout>
      <div className="expenses-page">
        <div className="page-header">
          <div>
            <h1>Expense management</h1>
            <p className="muted">
              Track operational business expenses for {business?.business_name}. Inventory purchases belong in Purchases.
            </p>
          </div>
          <div className="expenses-header-actions no-print">
            <Link to="/expense-categories" className="btn btn-secondary">Categories</Link>
            <Link to="/recurring-expenses" className="btn btn-secondary">Recurring</Link>
            <Link to="/reports/expenses" className="btn btn-secondary">Expense Reports</Link>
            <button type="button" className="btn btn-secondary" onClick={handleExport} disabled={filtered.length === 0}>
              Export
            </button>
            <button type="button" className="btn btn-secondary" onClick={handlePrint} disabled={filtered.length === 0}>
              Print
            </button>
            {canCreate && (
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                + Add expense
              </button>
            )}
          </div>
        </div>

        <div className="expenses-print-header">
          <h1>Expenses — {business?.business_name}</h1>
          <p className="muted">{filtered.length} record(s)</p>
        </div>

        <div className="expenses-summary-grid no-print">
          <div className="summary-card">
            <div className="summary-card-label">Total expenses</div>
            <div className="summary-card-value">{formatMoney(business?.currency, summary.totalAll)}</div>
          </div>
          <div className="summary-card summary-card-info">
            <div className="summary-card-label">Today&apos;s expenses</div>
            <div className="summary-card-value">{formatMoney(business?.currency, summary.todayTotal)}</div>
          </div>
          <div className="summary-card summary-card-info">
            <div className="summary-card-label">Monthly expenses</div>
            <div className="summary-card-value">{formatMoney(business?.currency, summary.monthTotal)}</div>
          </div>
          <div className="summary-card summary-card-warning">
            <div className="summary-card-label">Pending expenses</div>
            <div className="summary-card-value">{formatMoney(business?.currency, summary.pendingTotal)}</div>
          </div>
          <div className="summary-card summary-card-success">
            <div className="summary-card-label">Paid expenses</div>
            <div className="summary-card-value">{formatMoney(business?.currency, summary.paidTotal)}</div>
          </div>
        </div>

        <div className="card list-panel expenses-table-wrap">
          <div className="expenses-toolbar no-print">
            <input
              className="list-search"
              placeholder="Search title, ID, vendor, reference…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">All categories</option>
              {categoryList.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
              <option value="">All locations</option>
              {locationList.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>

            <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
              <option value="">All payment methods</option>
              {EXPENSE_PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>

            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
            </select>

            <div className="expenses-date-presets">
              <button
                type="button"
                className={`chip ${datePreset === 'all' ? 'chip-selected' : ''}`}
                onClick={() => handlePresetChange('all')}
              >
                All time
              </button>
              {EXPENSE_DATE_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  className={`chip ${datePreset === preset.key ? 'chip-selected' : ''}`}
                  onClick={() => handlePresetChange(preset.key)}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {datePreset === 'custom' && (
              <>
                <input
                  type="date"
                  value={customRange.from}
                  onChange={(e) => setCustomRange((r) => ({ ...r, from: e.target.value }))}
                  aria-label="From date"
                />
                <span className="muted" style={{ fontSize: 13 }}>to</span>
                <input
                  type="date"
                  value={customRange.to}
                  onChange={(e) => setCustomRange((r) => ({ ...r, to: e.target.value }))}
                  aria-label="To date"
                />
              </>
            )}

            <div style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--navy-900)' }}>
              Filtered total: {formatMoney(business?.currency, sumAmounts(filtered))}
            </div>
          </div>

          {error && <div className="error-text" style={{ padding: '0 16px 10px' }}>{error}</div>}

          {loading ? (
            <div className="muted" style={{ padding: 24 }}>Loading expenses…</div>
          ) : filtered.length === 0 ? (
            <div className="expenses-empty-state">
              <h3>No expenses found</h3>
              <p>
                {rows.length === 0
                  ? 'Record rent, utilities, salaries, and other operational costs here.'
                  : 'Try adjusting your filters or search terms.'}
              </p>
              {canCreate && rows.length === 0 && (
                <button type="button" className="btn btn-primary" onClick={openCreate}>
                  + Add your first expense
                </button>
              )}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Expense ID</th>
                  <th>Expense title</th>
                  <th>Category</th>
                  <th>Business location</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Payment method</th>
                  <th>Status</th>
                  <th className="no-print"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const status = getExpenseStatus(row);
                  return (
                    <tr key={row.id}>
                      <td>#{row.id}</td>
                      <td>
                        <div className="expenses-table-title">{getExpenseTitle(row, categories)}</div>
                        {row.vendor && <div className="expenses-table-sub">{row.vendor}</div>}
                      </td>
                      <td>{categories[row.category_id] || '—'}</td>
                      <td>{locations[row.location_id] || '—'}</td>
                      <td>{row.expense_date}</td>
                      <td>{formatMoney(business?.currency, row.amount)}</td>
                      <td>{row.payment_method || '—'}</td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[status] || 'badge-info'}`} style={{ textTransform: 'capitalize' }}>
                          {status}
                        </span>
                      </td>
                      <td className="table-actions no-print">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setViewExpense(row)}>
                          View
                        </button>
                        {canEdit && (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(row)}>
                            Edit
                          </button>
                        )}
                        {canDelete && (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDeleteExpense(row)}>
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ExpenseFormDialog
        open={formOpen}
        expenseId={editId}
        business={business}
        onClose={() => {
          setFormOpen(false);
          setEditId(null);
        }}
        onSaved={handleFormSaved}
      />

      <ExpenseViewDrawer
        open={!!viewExpense}
        expense={viewExpense}
        categories={categories}
        locations={locations}
        currency={business?.currency}
        canEdit={canEdit}
        onClose={() => setViewExpense(null)}
        onEdit={(row) => openEdit(row)}
      />

      <DeleteExpenseDialog
        open={!!deleteExpense}
        expense={deleteExpense}
        categories={categories}
        deleting={deleting}
        onClose={() => !deleting && setDeleteExpense(null)}
        onConfirm={handleDelete}
      />
    </AppLayout>
  );
}