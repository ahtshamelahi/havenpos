import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';
import { checkLowStockDirect } from '../lib/notifications.js';
import Pagination from '../components/Pagination.jsx';
import usePagination from '../hooks/usePagination.js';
import { fetchAllBatched } from '../lib/fetchUtils.js';
import useLocationScope from '../hooks/useLocationScope.js';

export default function Stock() {
  const { business, profile, can } = useAuth();
  const { isOwner, isScopedToLocation, scopedLocationIds } = useLocationScope();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [editingKey, setEditingKey] = useState(null);
  const [adjustValue, setAdjustValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canEdit = profile?.is_owner || can('stock', 'edit');

  const load = async () => {
    if (!business?.id) return;

    setLoading(true);

    const [
      { data: productRows },
      { data: locRows },
      { data: ledgerRows },
    ] = await Promise.all([
      fetchAllBatched(() =>
        supabase
          .from('products')
          .select('id, name, sku, alert_quantity')
          .eq('business_id', business.id)
          .eq('is_active', true)
      ),

      supabase
        .from('locations')
        .select('id, name')
        .eq('business_id', business.id)
        .eq('is_active', true),

      fetchAllBatched(() =>
        supabase
          .from('stock_ledger')
          .select('product_id, location_id, change_qty')
          .eq('business_id', business.id)
      ),
    ]);

    setProducts(productRows || []);
    setLocations(locRows || []);
    setLedger(ledgerRows || []);
    setLoading(false);
  };

  useEffect(() => {
    load();

    // eslint-disable-next-line
  }, [business?.id]);

  const onHand = useMemo(() => {
    const map = {};

    ledger.forEach((row) => {
      const key = `${row.product_id}:${row.location_id}`;

      map[key] =
        (map[key] || 0) +
        Number(row.change_qty);
    });

    return map;
  }, [ledger]);

  const rows = useMemo(() => {
    const out = [];

    products.forEach((p) => {
      locations.forEach((l) => {
        const key = `${p.id}:${l.id}`;

        if (!(key in onHand)) return;

        out.push({
          key,
          product: p,
          location: l,
          qty: onHand[key] || 0,
        });
      });
    });

    return out
      .filter(
        (r) => {
          if (isScopedToLocation) {
            // Staff: restrict to assigned locations only
            return scopedLocationIds.includes(r.location.id);
          }
          return !locationFilter || r.location.id === Number(locationFilter);
        }
      )
      .filter((r) => {
        const q = search.toLowerCase();

        return (
          r.product.name
            .toLowerCase()
            .includes(q) ||
          r.product.sku
            ?.toLowerCase()
            .includes(q)
        );
      })
      .sort((a, b) =>
        a.product.name.localeCompare(
          b.product.name
        )
      );
  }, [
    products,
    locations,
    onHand,
    search,
    locationFilter,
  ]);

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
  } = usePagination(rows, 20);

  const startAdjust = (row) => {
    setEditingKey(row.key);
    setAdjustValue(String(row.qty));
    setError('');
  };

  const saveAdjust = async (row) => {
    setError('');

    const target = Number(adjustValue);

    if (
      adjustValue === '' ||
      !Number.isInteger(target) ||
      target < 0
    ) {
      setError(
        'Quantity must be a positive whole number.'
      );
      return;
    }

    const delta = target - row.qty;

    if (delta === 0) {
      setEditingKey(null);
      return;
    }

    setSaving(true);

    try {
      const { error: err } = await supabase
        .from('stock_ledger')
        .insert({
          business_id: business.id,
          product_id: row.product.id,
          location_id: row.location.id,
          change_qty: delta,
          reason: 'adjustment',
          created_by: profile.id,
        });

      if (err) throw err;

      try {
        await checkLowStockDirect({
          businessId: business.id,
          productId: row.product.id,
          productName: row.product.name,
          locationName: row.location.name,
          newQty: target,
          alertQuantity: row.product.alert_quantity,
        });
      } catch {
        // best-effort — never block a successful adjustment on this
      }

      setEditingKey(null);
      load();
    } catch (err) {
      setError(
        err.message ||
        'Could not save this adjustment.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1>Stock | on Hand Quantities </h1>
        </div>

        <div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/reports/stock')}
          >
            Stock Report
          </button>
        </div>
      </div>

      <div className="card list-panel">
        <div className="list-toolbar">
          <input
            className="list-search"
            placeholder="Search by name or SKU…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              goToPage(1);
            }}
          />

          {isOwner && (
            <select
              value={locationFilter}
              onChange={(e) => {
                setLocationFilter(e.target.value);
                goToPage(1);
              }}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                border:
                  '1px solid var(--navy-border)',
              }}
            >
              <option value="">
                All locations
              </option>

              {locations.map((l) => (
                <option
                  key={l.id}
                  value={l.id}
                >
                  {l.name}
                </option>
              ))}
            </select>
          )}
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

        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Location</th>
              <th>On hand</th>
              <th>Alert qty</th>
              <th>Status</th>
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

            {!loading && rows.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="muted table-empty"
                >
                  No stock activity yet — receive a purchase to get started.
                </td>
              </tr>
            )}

            {!loading &&
              paginatedItems.map((r) => {
                const isLow =
                  r.product.alert_quantity != null &&
                  r.qty <=
                  Number(
                    r.product.alert_quantity
                  );

                return (
                  <tr key={r.key}>
                    <td>{r.product.name}</td>

                    <td>{r.product.sku}</td>

                    <td>{r.location.name}</td>

                    <td>
                      {editingKey === r.key ? (
                        <input
                          type="number"
                          min="0"
                          step="1"
                          autoFocus
                          value={adjustValue}
                          onChange={(e) =>
                            setAdjustValue(
                              e.target.value
                            )
                          }
                          onKeyDown={(e) => {
                            if (
                              [
                                'e',
                                'E',
                                '+',
                                '-',
                                '.',
                              ].includes(e.key)
                            ) {
                              e.preventDefault();
                            }
                          }}
                          style={{
                            width: 90,
                            padding: '5px 8px',
                            border:
                              '1px solid var(--navy-border)',
                            borderRadius: 6,
                          }}
                        />
                      ) : (
                        r.qty
                      )}
                    </td>

                    <td>
                      {r.product.alert_quantity ??
                        '—'}
                    </td>

                    <td>
                      {isLow ? (
                        <span className="badge badge-danger">
                          Low
                        </span>
                      ) : (
                        <span className="badge badge-success">
                          OK
                        </span>
                      )}
                    </td>

                    <td className="table-actions">
                      {canEdit &&
                        editingKey === r.key ? (
                        <>
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={saving}
                            onClick={() =>
                              saveAdjust(r)
                            }
                          >
                            Save
                          </button>

                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() =>
                              setEditingKey(null)
                            }
                          >
                            Cancel
                          </button>
                        </>
                      ) : canEdit ? (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() =>
                            startAdjust(r)
                          }
                        >
                          Adjust
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>

        {!loading && rows.length > 0 && (
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