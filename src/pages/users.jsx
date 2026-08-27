import { useEffect, useState } from 'react';
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
import './users.css';

export default function Users() {
  const { business, can, profile } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canCreate =
    profile?.is_owner || can('user_management', 'create');

  const canEdit =
    profile?.is_owner || can('user_management', 'edit');

  const load = async () => {
    if (!business?.id) return;

    setLoading(true);
    setError('');

    const { data, error: err } = await supabase
      .from('users')
      .select(
        'id, first_name, last_name, username, mobile_number, employment_status, is_active, is_owner, is_sales_agent, joining_date'
      )
      .eq('business_id', business.id)
      .order('created_at', { ascending: false });

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

  const toggleActive = async (userRow) => {
    if (userRow.is_owner) return;

    const { error: err } = await supabase
      .from('users')
      .update({
        is_active: !userRow.is_active,
      })
      .eq('id', userRow.id);

    if (err) {
      setError(err.message);
    } else {
      load();
    }
  };

  /*
   * SEARCH
   * Search only:
   * - Name
   * - Username
   * - Mobile
   */
  const search = useDataSearch(rows, [
    (row) =>
      `${row.first_name || ''} ${row.last_name || ''}`.trim(),

    'username',

    'mobile_number',
  ]);

  /*
   * SORTING
   * Every visible data column is sortable.
   * Actions column is intentionally not sortable.
   */
  const sortFields = [
    {
      key: 'name',
      label: 'Name',
      type: 'text',
      getValue: (row) =>
        `${row.first_name || ''} ${row.last_name || ''}`.trim(),
    },

    {
      key: 'username',
      label: 'Username',
      type: 'text',
    },

    {
      key: 'mobile_number',
      label: 'Mobile',
      type: 'text',
    },

    {
      key: 'role',
      label: 'Role',
      type: 'text',
      getValue: (row) => {
        if (row.is_owner) return 'Owner';
        if (row.is_sales_agent) return 'Staff Agent';
        return 'Staff';
      },
    },

    {
      key: 'employment_status',
      label: 'Employment',
      type: 'text',
    },

    {
      key: 'status',
      label: 'Status',
      type: 'text',
      getValue: (row) =>
        row.is_active ? 'Active' : 'Disabled',
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

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1>User management | Accounts , Roles , Permissions {' '}
            {business?.business_name}.</h1>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/reports/user-activity')}
          >
            User Activity Report
          </button>
          {canCreate && (
            <button
              className="btn btn-primary"
              onClick={() => navigate('/users/new')}
            >
              + Add employee
            </button>
          )}
        </div>
      </div>

      <div className="card users-panel">
        <div className="users-toolbar">
          <DataSearchBar
            query={search.query}
            setQuery={search.setQuery}
            clearSearch={search.clearSearch}
            placeholder="Search by name, username, or mobile…"
          />
        </div>

        {error && (
          <div
            className="error-text"
            style={{ padding: '0 16px 10px' }}
          >
            {error}
          </div>
        )}

        <table className="data-table">
          <thead>
            <tr>
              <SortableHeader
                label="Name"
                sortKey="name"
                currentSortKey={sort.sortKey}
                sortDirection={sort.sortDirection}
                toggleSortKey={sort.toggleSortKey}
              />

              <SortableHeader
                label="Username"
                sortKey="username"
                currentSortKey={sort.sortKey}
                sortDirection={sort.sortDirection}
                toggleSortKey={sort.toggleSortKey}
              />

              <SortableHeader
                label="Mobile"
                sortKey="mobile_number"
                currentSortKey={sort.sortKey}
                sortDirection={sort.sortDirection}
                toggleSortKey={sort.toggleSortKey}
              />

              <SortableHeader
                label="Role"
                sortKey="role"
                currentSortKey={sort.sortKey}
                sortDirection={sort.sortDirection}
                toggleSortKey={sort.toggleSortKey}
              />

              <SortableHeader
                label="Employment"
                sortKey="employment_status"
                currentSortKey={sort.sortKey}
                sortDirection={sort.sortDirection}
                toggleSortKey={sort.toggleSortKey}
              />

              <SortableHeader
                label="Status"
                sortKey="status"
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
                    No users found.
                  </td>
                </tr>
              )}

            {!loading &&
              paginatedItems.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.first_name} {r.last_name || ''}
                  </td>

                  <td>{r.username}</td>

                  <td>{r.mobile_number}</td>

                  <td>
                    {r.is_owner ? (
                      <span className="badge badge-info">
                        Owner
                      </span>
                    ) : (
                      <span className="badge badge-info">
                        Staff
                      </span>
                    )}

                    {r.is_sales_agent && (
                      <span
                        className="badge badge-success"
                        style={{ marginLeft: 6 }}
                      >
                        Agent
                      </span>
                    )}
                  </td>

                  <td
                    style={{
                      textTransform: 'capitalize',
                    }}
                  >
                    {r.employment_status}
                  </td>

                  <td>
                    {r.is_active ? (
                      <span className="badge badge-success">
                        Active
                      </span>
                    ) : (
                      <span className="badge badge-danger">
                        Disabled
                      </span>
                    )}
                  </td>

                  <td className="table-actions">
                    {canEdit && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          navigate(`/users/${r.id}`)
                        }
                      >
                        Edit
                      </button>
                    )}

                    {canEdit && !r.is_owner && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => toggleActive(r)}
                      >
                        {r.is_active
                          ? 'Disable'
                          : 'Enable'}
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
    </AppLayout>
  );
}