import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';
import { fetchAllBatched } from '../lib/fetchUtils.js';
import usePagination from '../hooks/usePagination.js';
import Pagination from '../components/Pagination.jsx';
import useDataSearch from '../hooks/useDataSearch.js';
import useDataSort from '../hooks/useDataSort.js';
import DataSearchBar from '../components/DataSearchBar.jsx';
import SortableHeader from '../components/SortableHeader.jsx';

export default function Contacts() {
  const { business, can, profile } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState('customer');
  const [rows, setRows] = useState([]);
  const [balances, setBalances] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const canCreate =
    profile?.is_owner || can('contacts', 'create');

  const canEdit =
    profile?.is_owner || can('contacts', 'edit');

  const load = async () => {
    if (!business?.id) return;

    setLoading(true);
    setError('');

    const { data, error: err } = await fetchAllBatched(() =>
      supabase
        .from('contacts')
        .select('*')
        .eq('business_id', business.id)
        .eq('contact_type', tab)
        .eq('is_active', true)
        .order('name')
    );

    if (err) {
      setError(err.message);
      setRows([]);
      setBalances({});
      setLoading(false);
      return;
    }

    setRows(data || []);

    if (data && data.length > 0) {
      const contactIds = data.map(
        (contact) => contact.id
      );

      const {
        data: ledgerRows,
        error: ledgerError,
      } = await fetchAllBatched(() =>
        supabase
          .from('contact_ledger')
          .select('contact_id, amount, reference_type')
          .eq('business_id', business.id)
          .in('contact_id', contactIds)
      );

      if (ledgerError) {
        setError(ledgerError.message);
      }

      const totals = {};

      /*
       * Current balance:
       *
       * contacts.opening_balance
       * + all non-opening-balance ledger entries
       *
       * Opening balance ledger entries are excluded
       * to prevent double counting.
       */

      (ledgerRows || []).forEach((ledgerEntry) => {
        if (
          ledgerEntry.reference_type ===
          'opening_balance'
        ) {
          return;
        }

        totals[ledgerEntry.contact_id] =
          (totals[ledgerEntry.contact_id] || 0) +
          Number(ledgerEntry.amount || 0);
      });

      data.forEach((contact) => {
        totals[contact.id] =
          (totals[contact.id] || 0) +
          Number(contact.opening_balance || 0);
      });

      setBalances(totals);
    } else {
      setBalances({});
    }

    setLoading(false);
  };

  useEffect(() => {
    load();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business?.id, tab]);

  const handleSoftDelete = async (contact) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${contact.name}"?`
    );

    if (!confirmed) return;

    setDeletingId(contact.id);
    setError('');

    const { error: deleteError } = await supabase
      .from('contacts')
      .update({
        is_active: false,
      })
      .eq('id', contact.id)
      .eq('business_id', business.id);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      setRows((currentRows) =>
        currentRows.filter(
          (row) => row.id !== contact.id
        )
      );
    }

    setDeletingId(null);
  };

  /*
   * SEARCH
   * Only:
   * - Name
   * - Contact number
   * - Business name
   */
  const search = useDataSearch(rows, [
    'name',
    'contact_number',
    'business_name',
  ]);

  /*
   * SORTING
   * Every visible data field is sortable.
   * Actions column is intentionally not sortable.
   */
  const sortFields = [
    {
      key: 'id',
      label: 'Contact ID',
      type: 'number',
    },

    {
      key: 'name',
      label: 'Name',
      type: 'text',
    },

    {
      key: 'business_name',
      label: 'Business name',
      type: 'text',
    },

    {
      key: 'contact_number',
      label: 'Contact number',
      type: 'text',
    },

    {
      key: 'email',
      label: 'Email',
      type: 'text',
    },

    ...(tab === 'supplier'
      ? [
        {
          key: 'tax_ntn_number',
          label: 'NTN number',
          type: 'text',
        },
      ]
      : []),

    {
      key: 'created_at',
      label: 'Added on',
      type: 'date',
    },

    {
      key: 'address',
      label: 'Address',
      type: 'text',
    },

    {
      key: 'balance',
      label: 'Balance',
      type: 'number',
      getValue: (contact) =>
        balances[contact.id] || 0,
    },
  ];

  const sort = useDataSort(
    search.filteredData,
    sortFields
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
  } = usePagination(sort.sortedData, 20);

  const currentPageBalanceTotal =
    paginatedItems.reduce(
      (total, contact) =>
        total +
        Number(balances[contact.id] || 0),
      0
    );

  const formatDate = (date) => {
    if (!date) return '—';

    return new Date(date).toLocaleDateString(
      'en-US',
      {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }
    );
  };

  const tableColumnCount =
    tab === 'supplier' ? 10 : 9;

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1>Contacts | Customers and suppliers for |{' '}
            {business?.business_name} |</h1>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-secondary"
            onClick={() =>
              navigate(`/reports/${tab}s`)
            }
          >
            {tab === 'customer' ? 'Customers Report' : 'Suppliers Report'}
          </button>
          {canCreate && (
            <button
              className="btn btn-primary"
              onClick={() =>
                navigate(
                  `/contacts/new?type=${tab}`
                )
              }
            >
              + Add {tab}
            </button>
          )}
        </div>
      </div>

      <div className="card list-panel">
        <div className="list-toolbar">
          <div className="list-tabs">
            <button
              className={`list-tab ${tab === 'customer'
                ? 'list-tab-active'
                : ''
                }`}
              onClick={() =>
                setTab('customer')
              }
            >
              Customers
            </button>

            <button
              className={`list-tab ${tab === 'supplier'
                ? 'list-tab-active'
                : ''
                }`}
              onClick={() =>
                setTab('supplier')
              }
            >
              Suppliers
            </button>
          </div>

          <DataSearchBar
            query={search.query}
            setQuery={search.setQuery}
            clearSearch={search.clearSearch}
            placeholder="Search by name, number, or business name…"
          />
        </div>

        {error && (
          <div
            className="error-text"
            style={{
              padding: '0 16px 10px',
            }}
          >
            {error}
          </div>
        )}

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <SortableHeader
                  label="Contact ID"
                  sortKey="id"
                  currentSortKey={sort.sortKey}
                  sortDirection={sort.sortDirection}
                  toggleSortKey={sort.toggleSortKey}
                />

                <SortableHeader
                  label="Name"
                  sortKey="name"
                  currentSortKey={sort.sortKey}
                  sortDirection={sort.sortDirection}
                  toggleSortKey={sort.toggleSortKey}
                />

                <SortableHeader
                  label="Business name"
                  sortKey="business_name"
                  currentSortKey={sort.sortKey}
                  sortDirection={sort.sortDirection}
                  toggleSortKey={sort.toggleSortKey}
                />

                <SortableHeader
                  label="Contact number"
                  sortKey="contact_number"
                  currentSortKey={sort.sortKey}
                  sortDirection={sort.sortDirection}
                  toggleSortKey={sort.toggleSortKey}
                />

                <SortableHeader
                  label="Email"
                  sortKey="email"
                  currentSortKey={sort.sortKey}
                  sortDirection={sort.sortDirection}
                  toggleSortKey={sort.toggleSortKey}
                />

                {tab === 'supplier' && (
                  <SortableHeader
                    label="NTN number"
                    sortKey="tax_ntn_number"
                    currentSortKey={sort.sortKey}
                    sortDirection={sort.sortDirection}
                    toggleSortKey={sort.toggleSortKey}
                  />
                )}

                <SortableHeader
                  label="Added on"
                  sortKey="created_at"
                  currentSortKey={sort.sortKey}
                  sortDirection={sort.sortDirection}
                  toggleSortKey={sort.toggleSortKey}
                />

                <SortableHeader
                  label="Address"
                  sortKey="address"
                  currentSortKey={sort.sortKey}
                  sortDirection={sort.sortDirection}
                  toggleSortKey={sort.toggleSortKey}
                />

                <SortableHeader
                  label="Balance"
                  sortKey="balance"
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
                    colSpan={tableColumnCount}
                    className="muted table-empty"
                  >
                    Loading…
                  </td>
                </tr>
              )}

              {!loading &&
                paginatedItems.length === 0 && (
                  <tr>
                    <td
                      colSpan={tableColumnCount}
                      className="muted table-empty"
                    >
                      No {tab}s yet.
                    </td>
                  </tr>
                )}

              {!loading &&
                paginatedItems.map((contact) => (
                  <tr key={contact.id}>
                    <td>
                      #{contact.id}
                    </td>

                    <td>
                      {contact.name}
                    </td>

                    <td>
                      {contact.business_name ||
                        '—'}
                    </td>

                    <td>
                      {contact.contact_number}
                    </td>

                    <td>
                      {contact.email || '—'}
                    </td>

                    {tab === 'supplier' && (
                      <td>
                        {contact.tax_ntn_number ||
                          '—'}
                      </td>
                    )}

                    <td>
                      {formatDate(
                        contact.created_at
                      )}
                    </td>

                    <td>
                      {contact.address ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() =>
                            setSelectedAddress(
                              contact
                            )
                          }
                        >
                          View address
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>

                    <td>
                      {business?.currency}{' '}
                      {(
                        balances[contact.id] || 0
                      ).toFixed(2)}
                    </td>

                    <td className="table-actions">
                      {canEdit && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() =>
                            navigate(
                              `/contacts/${contact.id}`
                            )
                          }
                        >
                          Edit
                        </button>
                      )}

                      {canEdit && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() =>
                            handleSoftDelete(
                              contact
                            )
                          }
                          disabled={
                            deletingId ===
                            contact.id
                          }
                        >
                          {deletingId ===
                            contact.id
                            ? 'Deleting…'
                            : 'Delete'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

              {!loading &&
                paginatedItems.length > 0 && (
                  <tr className="table-total-row">
                    <td
                      colSpan={
                        tab === 'supplier'
                          ? 8
                          : 7
                      }
                    >
                      <strong>
                        Total for current page
                      </strong>
                    </td>

                    <td>
                      <strong>
                        {business?.currency}{' '}
                        {currentPageBalanceTotal.toFixed(
                          2
                        )}
                      </strong>
                    </td>

                    <td></td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>

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
      </div>

      {selectedAddress && (
        <div
          className="modal-backdrop"
          onClick={() =>
            setSelectedAddress(null)
          }
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(19, 26, 51, 0.6)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div
            className="card"
            onClick={(e) =>
              e.stopPropagation()
            }
            style={{
              width: 'min(560px, 92vw)',
              padding: '24px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                alignItems: 'center',
                gap: '16px',
                marginBottom: '16px',
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                  }}
                >
                  Address
                </h2>

                <p
                  className="muted"
                  style={{
                    margin: '4px 0 0',
                  }}
                >
                  {selectedAddress.name}
                </p>
              </div>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  setSelectedAddress(null)
                }
              >
                Close
              </button>
            </div>

            <div
              style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6,
                wordBreak: 'break-word',
              }}
            >
              {selectedAddress.address}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}