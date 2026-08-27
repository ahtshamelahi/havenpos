import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import AppLayout from '../components/AppLayout.jsx';
import Pagination from '../components/Pagination.jsx';
import SortableHeader from '../components/SortableHeader.jsx';
import DataSearchBar from '../components/DataSearchBar.jsx';

import usePagination from '../hooks/usePagination.js';
import useDataSearch from '../hooks/useDataSearch.js';
import useDataSort from '../hooks/useDataSort.js';

import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';
import { fetchAllBatched } from '../lib/fetchUtils.js';

export default function SalesDue() {
  const { business, profile, can } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [payModal, setPayModal] = useState(null);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [modalError, setModalError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  /*
   * =====================================================
   * FILTER STATE
   * =====================================================
   */

  const [invoiceFilter, setInvoiceFilter] =
    useState('');

  const [customerFilter, setCustomerFilter] =
    useState('');

  const [locationFilter, setLocationFilter] =
    useState('');

  const canEdit =
    profile?.is_owner || can('sales', 'edit');

  const load = async () => {
    if (!business?.id) return;

    setLoading(true);

    const { data, error: err } = await fetchAllBatched(() =>
      supabase
        .from('sales')
        .select(
          'id, sale_date, grand_total, paid_amount, due_amount, customer_id, payment_method, contacts(name), locations(name)'
        )
        .eq('business_id', business.id)
        .in('status', ['confirmed', 'shipped', 'returned', 'partially_returned'])
        .eq('is_active', true)
        .gt('due_amount', 0)
        .order('due_amount', { ascending: false })
    );

    if (err) {
      setError(err.message);
    }

    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business?.id]);

  /*
   * =====================================================
   * SEARCH
   *
   * ONLY:
   * - Invoice
   * - Customer
   * - Total
   * =====================================================
   */

  const searchFields = useMemo(
    () => [
      (row) => row.id,

      (row) =>
        row.contacts?.name || 'Walk-in',

      (row) => row.grand_total,
    ],
    []
  );

  const search = useDataSearch(
    rows,
    searchFields
  );

  /*
   * =====================================================
   * FILTER OPTIONS
   *
   * Invoice
   * Customer
   * Location
   * =====================================================
   */

  const invoiceOptions = useMemo(() => {
    return [
      ...new Set(
        rows
          .map((row) => row.id)
          .filter(Boolean)
      ),
    ];
  }, [rows]);

  const customerOptions = useMemo(() => {
    return [
      ...new Set(
        rows
          .map(
            (row) =>
              row.contacts?.name ||
              'Walk-in'
          )
          .filter(Boolean)
      ),
    ];
  }, [rows]);

  const locationOptions = useMemo(() => {
    return [
      ...new Set(
        rows
          .map(
            (row) =>
              row.locations?.name
          )
          .filter(Boolean)
      ),
    ];
  }, [rows]);

  /*
   * =====================================================
   * APPLY DROPDOWN FILTERS
   * =====================================================
   */

  const filteredRows = useMemo(() => {
    return search.filteredData.filter((row) => {
      const invoice = String(row.id);

      const customer =
        row.contacts?.name ||
        'Walk-in';

      const location =
        row.locations?.name || '';

      const matchesInvoice =
        !invoiceFilter ||
        invoice === invoiceFilter;

      const matchesCustomer =
        !customerFilter ||
        customer === customerFilter;

      const matchesLocation =
        !locationFilter ||
        location === locationFilter;

      return (
        matchesInvoice &&
        matchesCustomer &&
        matchesLocation
      );
    });
  }, [
    search.filteredData,
    invoiceFilter,
    customerFilter,
    locationFilter,
  ]);

  /*
   * =====================================================
   * SORTING
   *
   * EVERY TABLE FIELD
   * =====================================================
   */

  const sortFields = useMemo(
    () => [
      {
        key: 'invoice',
        label: 'Invoice',
        type: 'number',
        getValue: (row) =>
          row.id,
      },

      {
        key: 'customer',
        label: 'Customer',
        type: 'text',
        getValue: (row) =>
          row.contacts?.name ||
          'Walk-in',
      },

      {
        key: 'location',
        label: 'Location',
        type: 'text',
        getValue: (row) =>
          row.locations?.name || '',
      },

      {
        key: 'date',
        label: 'Date',
        type: 'date',
        getValue: (row) =>
          row.sale_date,
      },

      {
        key: 'total',
        label: 'Total',
        type: 'number',
        getValue: (row) =>
          Number(row.grand_total || 0),
      },

      {
        key: 'paid',
        label: 'Paid',
        type: 'number',
        getValue: (row) =>
          Number(row.paid_amount || 0),
      },

      {
        key: 'due',
        label: 'Due',
        type: 'number',
        getValue: (row) =>
          Number(row.due_amount || 0),
      },
    ],
    []
  );

  const sort = useDataSort(
    filteredRows,
    sortFields
  );

  /*
   * =====================================================
   * TOTAL DUE
   *
   * Calculated from all filtered/sorted records
   * =====================================================
   */

  const totalDue = sort.sortedData.reduce(
    (sum, row) =>
      sum + Number(row.due_amount || 0),
    0
  );

  /*
   * =====================================================
   * PAGINATION
   * =====================================================
   */

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

  /*
   * =====================================================
   * PAYMENT MODAL
   * =====================================================
   */

  const openPayModal = (row) => {
    setPayModal(row);

    setAmount(
      String(row.due_amount)
    );

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

    if (
      amt >
      Number(payModal.due_amount) + 0.01
    ) {
      setModalError(
        "That's more than what's due on this invoice."
      );

      return;
    }

    setSubmitting(true);

    try {
      const newPaid =
        Number(payModal.paid_amount) + amt;

      const newDue = Math.max(
        Number(payModal.due_amount) - amt,
        0
      );

      const { error: saleErr } =
        await supabase
          .from('sales')
          .update({
            paid_amount: newPaid,
            due_amount: newDue,
            payment_method: paymentMethod,
          })
          .eq('id', payModal.id);

      if (saleErr) throw saleErr;

      if (payModal.customer_id) {
        const { error: ledgerErr } =
          await supabase
            .from('contact_ledger')
            .insert({
              business_id: business.id,
              contact_id:
                payModal.customer_id,
              reference_type: 'payment',
              reference_id: payModal.id,
              amount: -amt,
            });

        if (ledgerErr) throw ledgerErr;
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
          <h1>Sales Payment Due</h1>

          <p className="muted">
            Outstanding customer balances for{' '}
            {business?.business_name}.
          </p>
        </div>

        <button
          className="btn btn-secondary"
          onClick={() => navigate('/sales')}
        >
          Back to Sales
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
            Invoices with a balance
          </div>

          <div className="summary-card-value">
            {sort.sortedData.length}
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

      <div className="card list-panel">

        {/* ============================
            SEARCH + FILTERS
        ============================= */}

        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          <DataSearchBar
            {...search}
            placeholder="Search invoice, customer, or total…"
          />

          {/* INVOICE FILTER */}

          <select
            className="data-sort-select"
            value={invoiceFilter}
            onChange={(e) =>
              setInvoiceFilter(
                e.target.value
              )
            }
          >
            <option value="">
              All invoices
            </option>

            {invoiceOptions.map((invoice) => (
              <option
                key={invoice}
                value={invoice}
              >
                #{invoice}
              </option>
            ))}
          </select>

          {/* CUSTOMER FILTER */}

          <select
            className="data-sort-select"
            value={customerFilter}
            onChange={(e) =>
              setCustomerFilter(
                e.target.value
              )
            }
          >
            <option value="">
              All customers
            </option>

            {customerOptions.map((customer) => (
              <option
                key={customer}
                value={customer}
              >
                {customer}
              </option>
            ))}
          </select>

          {/* LOCATION FILTER */}

          <select
            className="data-sort-select"
            value={locationFilter}
            onChange={(e) =>
              setLocationFilter(
                e.target.value
              )
            }
          >
            <option value="">
              All locations
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

        <table className="data-table">
          <thead>
            <tr>
              <SortableHeader
                label="Invoice"
                sortKey="invoice"
                currentSortKey={sort.sortKey}
                sortDirection={sort.sortDirection}
                toggleSortKey={sort.toggleSortKey}
              />

              <SortableHeader
                label="Customer"
                sortKey="customer"
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
                sortKey="date"
                currentSortKey={sort.sortKey}
                sortDirection={sort.sortDirection}
                toggleSortKey={sort.toggleSortKey}
              />

              <SortableHeader
                label="Total"
                sortKey="total"
                currentSortKey={sort.sortKey}
                sortDirection={sort.sortDirection}
                toggleSortKey={sort.toggleSortKey}
              />

              <SortableHeader
                label="Paid"
                sortKey="paid"
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
                      invoiceFilter ||
                      customerFilter ||
                      locationFilter
                      ? 'No sales due records match your search or filters.'
                      : 'Nothing outstanding — all invoices are paid up.'}
                  </td>
                </tr>
              )}

            {!loading &&
              paginatedItems.map((r) => (
                <tr key={r.id}>
                  <td>#{r.id}</td>

                  <td>
                    {r.contacts?.name ||
                      'Walk-in'}
                  </td>

                  <td>
                    {r.locations?.name ||
                      '—'}
                  </td>

                  <td>
                    {r.sale_date}
                  </td>

                  <td>
                    {business?.currency}{' '}
                    {Number(
                      r.grand_total
                    ).toFixed(2)}
                  </td>

                  <td>
                    {business?.currency}{' '}
                    {Number(
                      r.paid_amount
                    ).toFixed(2)}
                  </td>

                  <td className="dash-due-cell">
                    {business?.currency}{' '}
                    {Number(
                      r.due_amount
                    ).toFixed(2)}
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
          onClick={() => setPayModal(null)}
        >
          <div
            className="pos-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <h2>
              Record payment — Invoice #
              {payModal.id}
            </h2>

            <p
              className="muted"
              style={{
                fontSize: 13,
                marginTop: -6,
              }}
            >
              {payModal.contacts?.name ||
                'Walk-in'}{' '}
              owes {business?.currency}{' '}
              {Number(
                payModal.due_amount
              ).toFixed(2)}
            </p>

            <form
              onSubmit={submitPayment}
              className="pos-modal-form"
            >
              <div className="field">
                <label>
                  Amount received *
                </label>

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={payModal.due_amount}
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