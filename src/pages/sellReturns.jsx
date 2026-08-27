import { useEffect, useMemo, useState, Fragment } from 'react';
import { Link } from 'react-router-dom';

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

export default function SellReturns() {
  const { business } = useAuth();

  const [rows, setRows] = useState([]);
  const [sales, setSales] = useState({});
  const [users, setUsers] = useState({});
  const [items, setItems] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);

  /*
   * FILTER STATE
   */

  const [invoiceFilter, setInvoiceFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [createdByFilter, setCreatedByFilter] = useState('');

  const load = async () => {
    if (!business?.id) return;

    setLoading(true);

    const [
      { data: returnRows, error: returnError },
      { data: saleRows, error: saleError },
      { data: userRows, error: userError },
    ] = await Promise.all([
      fetchAllBatched(() =>
        supabase
          .from('sell_returns')
          .select('*')
          .eq('business_id', business.id)
          .order('created_at', { ascending: false })
      ),

      fetchAllBatched(() =>
        supabase
          .from('sales')
          .select('id, customer_id, contacts(name)')
          .eq('business_id', business.id)
      ),

      supabase
        .from('users')
        .select('id, first_name')
        .eq('business_id', business.id),
    ]);

    if (returnError) {
      console.error('Error loading returns:', returnError);
    }

    if (saleError) {
      console.error('Error loading sales:', saleError);
    }

    if (userError) {
      console.error('Error loading users:', userError);
    }

    setRows(returnRows || []);

    setSales(
      Object.fromEntries(
        (saleRows || []).map((sale) => [
          sale.id,
          sale,
        ])
      )
    );

    setUsers(
      Object.fromEntries(
        (userRows || []).map((user) => [
          user.id,
          user,
        ])
      )
    );

    setLoading(false);
  };

  useEffect(() => {
    load();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business?.id]);

  const toggleExpand = async (returnId) => {
    if (expanded === returnId) {
      setExpanded(null);
      return;
    }

    setExpanded(returnId);

    if (!items[returnId]) {
      const { data, error } = await supabase
        .from('sell_return_items')
        .select(
          '*, sale_items(product_id, products(name))'
        )
        .eq('sell_return_id', returnId);

      if (error) {
        console.error(
          'Error loading return items:',
          error
        );
      }

      setItems((prev) => ({
        ...prev,
        [returnId]: data || [],
      }));
    }
  };

  /*
   * =====================================================
   * SEARCH
   *
   * ONLY:
   * - Invoice
   * - Customer
   * - Amount
   * =====================================================
   */

  const searchFields = useMemo(
    () => [
      (row) => row.sale_id,

      (row) =>
        sales[row.sale_id]?.contacts?.name,

      (row) => row.total_amount,
    ],
    [sales]
  );

  const search = useDataSearch(
    rows,
    searchFields
  );

  /*
   * =====================================================
   * DROPDOWN FILTER OPTIONS
   * =====================================================
   */

  const invoiceOptions = useMemo(() => {
    return [
      ...new Set(
        rows
          .map((row) => row.sale_id)
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
              sales[row.sale_id]?.contacts?.name ||
              'Walk-in'
          )
          .filter(Boolean)
      ),
    ];
  }, [rows, sales]);

  const createdByOptions = useMemo(() => {
    return [
      ...new Set(
        rows
          .map(
            (row) =>
              users[row.created_by]?.first_name
          )
          .filter(Boolean)
      ),
    ];
  }, [rows, users]);

  /*
   * =====================================================
   * APPLY DROPDOWN FILTERS
   * =====================================================
   */

  const filteredRows = useMemo(() => {
    return search.filteredData.filter((row) => {
      const invoice = String(
        row.sale_id || ''
      );

      const customer =
        sales[row.sale_id]?.contacts?.name ||
        'Walk-in';

      const createdBy =
        users[row.created_by]?.first_name ||
        '';

      const matchesInvoice =
        !invoiceFilter ||
        invoice === invoiceFilter;

      const matchesCustomer =
        !customerFilter ||
        customer === customerFilter;

      const matchesCreatedBy =
        !createdByFilter ||
        createdBy === createdByFilter;

      return (
        matchesInvoice &&
        matchesCustomer &&
        matchesCreatedBy
      );
    });
  }, [
    search.filteredData,
    invoiceFilter,
    customerFilter,
    createdByFilter,
    sales,
    users,
  ]);

  /*
   * =====================================================
   * SORTING
   *
   * EVERY MAIN TABLE FIELD
   * =====================================================
   */

  const sortFields = useMemo(
    () => [
      {
        key: 'date',
        label: 'Date',
        type: 'date',
        getValue: (row) =>
          row.return_date,
      },

      {
        key: 'invoice',
        label: 'Invoice #',
        type: 'number',
        getValue: (row) =>
          row.sale_id,
      },

      {
        key: 'customer',
        label: 'Customer',
        type: 'text',
        getValue: (row) =>
          sales[row.sale_id]?.contacts?.name ||
          'Walk-in',
      },

      {
        key: 'reason',
        label: 'Reason',
        type: 'text',
        getValue: (row) =>
          row.reason || '',
      },

      {
        key: 'amount',
        label: 'Amount',
        type: 'number',
        getValue: (row) =>
          Number(row.total_amount || 0),
      },

      {
        key: 'created_by',
        label: 'Created By',
        type: 'text',
        getValue: (row) =>
          users[row.created_by]?.first_name ||
          '',
      },
    ],
    [sales, users]
  );

  const sort = useDataSort(
    filteredRows,
    sortFields
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
   * TOTAL
   * =====================================================
   */

  const currentPageTotal = paginatedItems.reduce(
    (total, row) =>
      total + Number(row.total_amount || 0),
    0
  );

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1>Sales returns</h1>

          <p className="muted">
            Stock customers have sent back,
            restocked immediately.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
          }}
        >
          <Link
            to="/sales/returns/new"
            className="btn btn-primary"
          >
            + New return
          </Link>

          <Link
            to="/sales"
            className="btn btn-secondary"
          >
            Back to sales
          </Link>
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
            placeholder="Search invoice, customer, or amount…"
          />

          {/* INVOICE FILTER */}

          <select
            className="data-sort-select"
            value={invoiceFilter}
            onChange={(e) =>
              setInvoiceFilter(e.target.value)
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
              setCustomerFilter(e.target.value)
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

          {/* CREATED BY FILTER */}

          <select
            className="data-sort-select"
            value={createdByFilter}
            onChange={(e) =>
              setCreatedByFilter(e.target.value)
            }
          >
            <option value="">
              All created by
            </option>

            {createdByOptions.map((user) => (
              <option
                key={user}
                value={user}
              >
                {user}
              </option>
            ))}
          </select>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th></th>

              <SortableHeader
                label="Date"
                sortKey="date"
                currentSortKey={sort.sortKey}
                sortDirection={sort.sortDirection}
                toggleSortKey={sort.toggleSortKey}
              />

              <SortableHeader
                label="Invoice #"
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
                label="Reason"
                sortKey="reason"
                currentSortKey={sort.sortKey}
                sortDirection={sort.sortDirection}
                toggleSortKey={sort.toggleSortKey}
              />

              <SortableHeader
                label="Amount"
                sortKey="amount"
                currentSortKey={sort.sortKey}
                sortDirection={sort.sortDirection}
                toggleSortKey={sort.toggleSortKey}
              />

              <SortableHeader
                label="Created By"
                sortKey="created_by"
                currentSortKey={sort.sortKey}
                sortDirection={sort.sortDirection}
                toggleSortKey={sort.toggleSortKey}
              />
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={7}
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
                    colSpan={7}
                    className="muted table-empty"
                  >
                    {search.isActive ||
                    invoiceFilter ||
                    customerFilter ||
                    createdByFilter
                      ? 'No sales returns match your filters.'
                      : 'No sales returns yet.'}
                  </td>
                </tr>
              )}

            {!loading &&
              paginatedItems.map((row) => (
                <Fragment key={row.id}>
                  <tr
                    onClick={() =>
                      toggleExpand(row.id)
                    }
                    style={{
                      cursor: 'pointer',
                    }}
                  >
                    <td>
                      {expanded === row.id
                        ? '▾'
                        : '▸'}
                    </td>

                    <td>
                      {row.return_date}
                    </td>

                    <td>
                      #{row.sale_id}
                    </td>

                    <td>
                      {sales[row.sale_id]?.contacts
                        ?.name || 'Walk-in'}
                    </td>

                    <td>
                      {row.reason || '—'}
                    </td>

                    <td>
                      {business?.currency}{' '}
                      {Number(
                        row.total_amount
                      ).toFixed(2)}
                    </td>

                    <td>
                      {users[row.created_by]
                        ?.first_name || '—'}
                    </td>
                  </tr>

                  {expanded === row.id && (
                    <tr>
                      <td
                        colSpan={7}
                        style={{
                          background:
                            'var(--navy-50)',
                          padding: 0,
                        }}
                      >
                        <table
                          className="data-table"
                          style={{
                            margin:
                              '4px 24px 12px',
                          }}
                        >
                          <thead>
                            <tr>
                              <th>Product</th>

                              <th>
                                Qty returned
                              </th>

                              <th>
                                Amount
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {(
                              items[row.id] || []
                            ).map((item) => (
                              <tr
                                key={item.id}
                              >
                                <td>
                                  {item.sale_items
                                    ?.products
                                    ?.name || '—'}
                                </td>

                                <td>
                                  {Number(
                                    item.quantity_returned
                                  )}
                                </td>

                                <td>
                                  {
                                    business?.currency
                                  }{' '}
                                  {Number(
                                    item.amount
                                  ).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}

            {!loading &&
              paginatedItems.length > 0 && (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      fontWeight: 700,
                      textAlign: 'right',
                    }}
                  >
                    TOTAL
                  </td>

                  <td
                    style={{
                      fontWeight: 700,
                    }}
                  >
                    {business?.currency}{' '}
                    {currentPageTotal.toFixed(2)}
                  </td>

                  <td></td>
                </tr>
              )}
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
    </AppLayout>
  );
}