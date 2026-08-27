import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout.jsx';
import Pagination from '../components/Pagination.jsx';
import DataSearchBar from '../components/DataSearchBar.jsx';
import SortableHeader from '../components/SortableHeader.jsx';
import usePagination from '../hooks/usePagination.js';
import useDataSearch from '../hooks/useDataSearch.js';
import useDataSort from '../hooks/useDataSort.js';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';
import { fetchAllBatched } from '../lib/fetchUtils.js';

export default function PurchaseDue() {
  const { business, profile, can } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [payModal, setPayModal] = useState(null);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] =
    useState('Cash');
  const [modalError, setModalError] =
    useState('');
  const [submitting, setSubmitting] =
    useState(false);

  // Filters
  const [supplierFilter, setSupplierFilter] =
    useState('');
  const [locationFilter, setLocationFilter] =
    useState('');

  const canEdit =
    profile?.is_owner ||
    can('purchases', 'edit');

  const load = async () => {
    if (!business?.id) return;

    setLoading(true);

    const { data, error: err } = await fetchAllBatched(() =>
      supabase
        .from('purchases')
        .select(
          'id, purchase_date, grand_total, advance_payment, supplier_id, payment_method, contacts(name), locations(name)'
        )
        .eq('business_id', business.id)
        .eq('purchase_status', 'received')
        .eq('is_active', true)
        .order('purchase_date', { ascending: false })
    );

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    const withDue = (data || [])
      .map((p) => ({
        ...p,
        due:
          Number(p.grand_total) -
          Number(p.advance_payment),
      }))
      .filter((p) => p.due > 0);

    setRows(withDue);
    setLoading(false);
  };

  useEffect(() => {
    load();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business?.id]);

  /*
   * Search
   *
   * Searchable fields:
   * - Supplier
   * - Total
   */
  const search = useDataSearch(
    rows,
    [
      (row) =>
        row.contacts?.name ||
        'Cash / unspecified',

      (row) => row.grand_total,
    ]
  );

  /*
   * Filter options
   */
  const supplierOptions = useMemo(() => {
    return [
      ...new Map(
        rows.map((row) => {
          const name =
            row.contacts?.name ||
            'Cash / unspecified';

          return [name, name];
        })
      ).values(),
    ].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [rows]);

  const locationOptions = useMemo(() => {
    return [
      ...new Map(
        rows.map((row) => {
          const name =
            row.locations?.name || '—';

          return [name, name];
        })
      ).values(),
    ].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [rows]);

  /*
   * Apply filters after search
   */
  const filteredRows = useMemo(() => {
    return search.filteredData.filter((row) => {
      const supplier =
        row.contacts?.name ||
        'Cash / unspecified';

      const location =
        row.locations?.name || '—';

      const matchesSupplier =
        !supplierFilter ||
        supplier === supplierFilter;

      const matchesLocation =
        !locationFilter ||
        location === locationFilter;

      return (
        matchesSupplier &&
        matchesLocation
      );
    });
  }, [
    search.filteredData,
    supplierFilter,
    locationFilter,
  ]);

  /*
   * Sorting
   *
   * Every table data field is sortable.
   */
  const sortFields = useMemo(
    () => [
      {
        key: 'id',
        label: 'Purchase',
        type: 'number',
      },
      {
        key: 'supplier',
        label: 'Supplier',
        type: 'text',
        getValue: (row) =>
          row.contacts?.name ||
          'Cash / unspecified',
      },
      {
        key: 'location',
        label: 'Location',
        type: 'text',
        getValue: (row) =>
          row.locations?.name || '—',
      },
      {
        key: 'purchase_date',
        label: 'Date',
        type: 'date',
      },
      {
        key: 'grand_total',
        label: 'Total',
        type: 'number',
      },
      {
        key: 'advance_payment',
        label: 'Paid',
        type: 'number',
      },
      {
        key: 'due',
        label: 'Due',
        type: 'number',
      },
    ],
    []
  );

  const sort = useDataSort(
    filteredRows,
    sortFields
  );

  const totalDue = rows.reduce(
    (sum, row) => sum + row.due,
    0
  );

  const {
    currentPage,
    totalPages,
    totalItems,
    paginatedItems,
    firstItemIndex,
    lastItemIndex,
    goToPage,
    nextPage,
    previousPage,
    hasNextPage,
    hasPreviousPage,
  } = usePagination(
    sort.sortedData,
    20
  );

  const openPayModal = (row) => {
    setPayModal(row);
    setAmount(String(row.due));
    setPaymentMethod(
      row.payment_method || 'Cash'
    );
    setModalError('');
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    setModalError('');

    const amt = Number(amount);

    if (!amt || amt <= 0) {
      setModalError(
        'Enter a valid amount.'
      );
      return;
    }

    if (amt > payModal.due + 0.01) {
      setModalError(
        "That's more than what's due on this purchase."
      );
      return;
    }

    setSubmitting(true);

    try {
      const newAdvance =
        Number(payModal.advance_payment) +
        amt;

      const { error: purchaseErr } =
        await supabase
          .from('purchases')
          .update({
            advance_payment: newAdvance,
            payment_method: paymentMethod,
            paid_on: new Date()
              .toISOString()
              .slice(0, 10),
          })
          .eq('id', payModal.id);

      if (purchaseErr) {
        throw purchaseErr;
      }

      if (payModal.supplier_id) {
        const { error: ledgerErr } =
          await supabase
            .from('contact_ledger')
            .insert({
              business_id: business.id,
              contact_id:
                payModal.supplier_id,
              reference_type: 'payment',
              reference_id: payModal.id,
              amount: -amt,
            });

        if (ledgerErr) {
          throw ledgerErr;
        }
      }

      setPayModal(null);
      load();
    } catch (err) {
      setModalError(
        err.message ||
          'Could not record this payment.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1>Purchase Payment Due</h1>

          <p className="muted">
            Outstanding supplier balances for{' '}
            {business?.business_name}.
          </p>
        </div>

        <button
          className="btn btn-secondary"
          onClick={() =>
            navigate('/purchases')
          }
        >
          Back to Purchases
        </button>
      </div>

      {error && (
        <div
          className="error-text"
          style={{ marginBottom: 12 }}
        >
          {error}
        </div>
      )}

      <div
        className="summary-grid"
        style={{
          gridTemplateColumns:
            'repeat(2, 1fr)',
          marginBottom: 16,
        }}
      >
        <div className="summary-card">
          <div className="summary-card-label">
            Purchases with a balance
          </div>

          <div className="summary-card-value">
            {rows.length}
          </div>
        </div>

        <div className="summary-card summary-card-warning">
          <div className="summary-card-label">
            Total outstanding
          </div>

          <div className="summary-card-value">
            {business?.currency}{' '}
            {totalDue.toFixed(2)}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <DataSearchBar
          {...search}
          placeholder="Search supplier or total..."
        />

        <select
          value={supplierFilter}
          onChange={(e) =>
            setSupplierFilter(e.target.value)
          }
          className="data-sort-select"
        >
          <option value="">
            All Suppliers
          </option>

          {supplierOptions.map((supplier) => (
            <option
              key={supplier}
              value={supplier}
            >
              {supplier}
            </option>
          ))}
        </select>

        <select
          value={locationFilter}
          onChange={(e) =>
            setLocationFilter(e.target.value)
          }
          className="data-sort-select"
        >
          <option value="">
            All Locations
          </option>

          {locationOptions.map((location) => (
            <option
              key={location}
              value={location}
            >
              {location}
            </option>
          ))}
        </select>
      </div>

      <div className="card list-panel">
        <table className="data-table">
          <thead>
            <tr>
              <SortableHeader
                label="Purchase"
                sortKey="id"
                currentSortKey={sort.sortKey}
                sortDirection={sort.sortDirection}
                toggleSortKey={sort.toggleSortKey}
              />

              <SortableHeader
                label="Supplier"
                sortKey="supplier"
                currentSortKey={sort.sortKey}
                sortDirection={sort.sortDirection}
                toggleSortKey={sort.toggleSortKey}
              />

              <SortableHeader
                label="Location"
                sortKey="location"
                currentSortKey={sort.sortKey}
                sortDirection={sort.sortDirection}
                toggleSortKey={sort.toggleSortKey}
              />

              <SortableHeader
                label="Date"
                sortKey="purchase_date"
                currentSortKey={sort.sortKey}
                sortDirection={sort.sortDirection}
                toggleSortKey={sort.toggleSortKey}
              />

              <SortableHeader
                label="Total"
                sortKey="grand_total"
                currentSortKey={sort.sortKey}
                sortDirection={sort.sortDirection}
                toggleSortKey={sort.toggleSortKey}
              />

              <SortableHeader
                label="Paid"
                sortKey="advance_payment"
                currentSortKey={sort.sortKey}
                sortDirection={sort.sortDirection}
                toggleSortKey={sort.toggleSortKey}
              />

              <SortableHeader
                label="Due"
                sortKey="due"
                currentSortKey={sort.sortKey}
                sortDirection={sort.sortDirection}
                toggleSortKey={sort.toggleSortKey}
              />

              <th></th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={8}
                  className="muted table-empty"
                >
                  Loading…
                </td>
              </tr>
            )}

            {!loading &&
              sort.sortedData.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="muted table-empty"
                  >
                    {search.isActive ||
                    supplierFilter ||
                    locationFilter
                      ? 'No matching purchases found.'
                      : 'Nothing outstanding — all purchases are paid up.'}
                  </td>
                </tr>
              )}

            {!loading &&
              paginatedItems.map((r) => (
                <tr key={r.id}>
                  <td>#{r.id}</td>

                  <td>
                    {r.contacts?.name ||
                      'Cash / unspecified'}
                  </td>

                  <td>
                    {r.locations?.name || '—'}
                  </td>

                  <td>{r.purchase_date}</td>

                  <td>
                    {business?.currency}{' '}
                    {Number(
                      r.grand_total
                    ).toFixed(2)}
                  </td>

                  <td>
                    {business?.currency}{' '}
                    {Number(
                      r.advance_payment
                    ).toFixed(2)}
                  </td>

                  <td className="dash-due-cell">
                    {business?.currency}{' '}
                    {r.due.toFixed(2)}
                  </td>

                  <td className="table-actions">
                    {canEdit && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() =>
                          openPayModal(r)
                        }
                      >
                        Record Payment
                      </button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>

        {!loading &&
          sort.sortedData.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              firstItemIndex={firstItemIndex}
              lastItemIndex={lastItemIndex}
              goToPage={goToPage}
              nextPage={nextPage}
              previousPage={previousPage}
              hasNextPage={hasNextPage}
              hasPreviousPage={hasPreviousPage}
            />
          )}
      </div>

      {payModal && (
        <div
          className="pos-modal-backdrop"
          onClick={() =>
            setPayModal(null)
          }
        >
          <div
            className="pos-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <h2>
              Record payment — Purchase #
              {payModal.id}
            </h2>

            <p
              className="muted"
              style={{
                fontSize: 13,
                marginTop: -6,
              }}
            >
              You owe{' '}
              {payModal.contacts?.name ||
                'this supplier'}{' '}
              {business?.currency}{' '}
              {payModal.due.toFixed(2)}
            </p>

            <form
              onSubmit={submitPayment}
              className="pos-modal-form"
            >
              <div className="field">
                <label>
                  Amount paid *
                </label>

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={payModal.due}
                  value={amount}
                  onChange={(e) =>
                    setAmount(
                      e.target.value
                    )
                  }
                  autoFocus
                />
              </div>

              <div className="field">
                <label>
                  Payment method
                </label>

                <select
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(
                      e.target.value
                    )
                  }
                >
                  <option value="Cash">
                    Cash
                  </option>

                  <option value="Card">
                    Card
                  </option>

                  <option value="Bank transfer">
                    Bank transfer
                  </option>

                  <option value="Other">
                    Other
                  </option>
                </select>
              </div>

              {modalError && (
                <div className="error-text">
                  {modalError}
                </div>
              )}

              <div className="pos-modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    setPayModal(null)
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting
                    ? 'Saving…'
                    : 'Record payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}