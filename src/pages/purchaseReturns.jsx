import { useEffect, useMemo, useState, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout.jsx';
import Pagination from '../components/Pagination.jsx';
import usePagination from '../hooks/usePagination.js';
import useDataSearch from '../hooks/useDataSearch.js';
import useDataSort from '../hooks/useDataSort.js';
import DataSearchBar from '../components/DataSearchBar.jsx';
import SortableHeader from '../components/SortableHeader.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';
import { fetchAllBatched } from '../lib/fetchUtils.js';

export default function PurchaseReturns() {
  const { business } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [purchases, setPurchases] = useState({});
  const [items, setItems] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!business?.id) return;

    setLoading(true);

    const [
      { data: returnRows },
      { data: purchaseRows },
    ] = await Promise.all([
      fetchAllBatched(() =>
        supabase
          .from('purchase_returns')
          .select('*')
          .eq('business_id', business.id)
          .order('created_at', { ascending: false })
      ),

      fetchAllBatched(() =>
        supabase
          .from('purchases')
          .select('id, supplier_id, contacts(name)')
          .eq('business_id', business.id)
      ),
    ]);

    setRows(returnRows || []);

    setPurchases(
      Object.fromEntries(
        (purchaseRows || []).map((p) => [
          p.id,
          p,
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
      const { data } = await supabase
        .from('purchase_return_items')
        .select(
          '*, purchase_items(product_id, products(name))'
        )
        .eq(
          'purchase_return_id',
          returnId
        );

      setItems((prev) => ({
        ...prev,
        [returnId]: data || [],
      }));
    }
  };

  /*
   * ----------------------------------------------------
   * SEARCH
   * Supplier + Amount only
   * ----------------------------------------------------
   */

  const searchFields = useMemo(
    () => [
      (row) =>
        purchases[row.purchase_id]
          ?.contacts?.name || 'Cash / unspecified',

      (row) => row.total_amount,
    ],
    [purchases]
  );

  const search = useDataSearch(
    rows,
    searchFields
  );

  /*
   * ----------------------------------------------------
   * SORTING
   * Every visible main-table field
   * ----------------------------------------------------
   */

  const sortFields = useMemo(
    () => [
      {
        key: 'return_date',
        label: 'Date',
        type: 'date',
      },

      {
        key: 'supplier',
        label: 'Supplier',
        type: 'text',
        getValue: (row) =>
          purchases[row.purchase_id]
            ?.contacts?.name ||
          'Cash / unspecified',
      },

      {
        key: 'reason',
        label: 'Reason',
        type: 'text',
        getValue: (row) =>
          row.reason || '',
      },

      {
        key: 'total_amount',
        label: 'Amount',
        type: 'number',
      },
    ],
    [purchases]
  );

  const sort = useDataSort(
    search.filteredData,
    sortFields
  );

  /*
   * ----------------------------------------------------
   * PAGINATION
   * ----------------------------------------------------
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

  const currentPageTotal = paginatedItems.reduce(
    (sum, row) =>
      sum + Number(row.total_amount || 0),
    0
  );

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1>Purchase returns</h1>

          <p className="muted">
            Stock sent back to suppliers.
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() =>
            navigate('/purchases')
          }
        >
          View all purchases
        </button>
      </div>

      <div className="card list-panel">

        {/* SEARCH */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            padding: '4px 4px 16px',
          }}
        >
          <DataSearchBar
            query={search.query}
            setQuery={search.setQuery}
            clearSearch={search.clearSearch}
            placeholder="Search supplier or amount…"
          />
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th></th>

              <SortableHeader
                label="Date"
                sortKey="return_date"
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
                label="Reason"
                sortKey="reason"
                currentSortKey={sort.sortKey}
                sortDirection={sort.sortDirection}
                toggleSortKey={sort.toggleSortKey}
              />

              <SortableHeader
                label="Amount"
                sortKey="total_amount"
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
                  colSpan={5}
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
                    colSpan={5}
                    className="muted table-empty"
                  >
                    {search.isActive
                      ? 'No purchase returns match your search.'
                      : 'No purchase returns yet.'}
                  </td>
                </tr>
              )}

            {!loading &&
              paginatedItems.map((r) => (
                <Fragment key={r.id}>
                  <tr
                    onClick={() =>
                      toggleExpand(r.id)
                    }
                    style={{
                      cursor: 'pointer',
                    }}
                  >
                    <td>
                      {expanded === r.id
                        ? '▾'
                        : '▸'}
                    </td>

                    <td>
                      {r.return_date}
                    </td>

                    <td>
                      {purchases[r.purchase_id]
                        ?.contacts?.name ||
                        'Cash / unspecified'}
                    </td>

                    <td>
                      {r.reason || '—'}
                    </td>

                    <td>
                      {business?.currency}{' '}
                      {Number(
                        r.total_amount
                      ).toFixed(2)}
                    </td>
                  </tr>

                  {expanded === r.id && (
                    <tr>
                      <td
                        colSpan={5}
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
                              <th>Amount</th>
                            </tr>
                          </thead>

                          <tbody>
                            {(
                              items[r.id] || []
                            ).map((it) => (
                              <tr
                                key={it.id}
                              >
                                <td>
                                  {it.purchase_items
                                    ?.products
                                    ?.name || '—'}
                                </td>

                                <td>
                                  {Number(
                                    it.quantity_returned
                                  )}
                                </td>

                                <td>
                                  {
                                    business?.currency
                                  }{' '}
                                  {Number(
                                    it.amount
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
                    colSpan={4}
                    style={{
                      textAlign: 'right',
                      fontWeight: 700,
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