import { useEffect, useMemo, useState, Fragment } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout.jsx';
import Pagination from '../components/Pagination.jsx';
import usePagination from '../hooks/usePagination.js';
import useDataSearch from '../hooks/useDataSearch.js';
import useDataSort from '../hooks/useDataSort.js';
import DataSearchBar from '../components/DataSearchBar.jsx';
import SortableHeader from '../components/SortableHeader.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';
import { todayLocal } from '../lib/timezone.js';
import { fetchAllBatched } from '../lib/fetchUtils.js';
import {
  notifyPaymentDueSupplier,
  checkLowStockForItems,
} from '../lib/notifications.js';
import { downloadPDF, buildPdfFilename } from '../utils/pdfGenerator.js';
import PrintReportHeader from '../components/PrintReportHeader.jsx';
import useLocationScope from '../hooks/useLocationScope.js';

const STATUS_BADGE = {
  draft: 'badge-warning',
  received: 'badge-success',
  cancelled: 'badge-danger',
};

const PAYMENT_STATUS_BADGE = {
  due: 'badge-warning',
  paid: 'badge-success',
};

export default function Purchases() {
  const { business, profile, can } = useAuth();
  const { isOwner, isScopedToLocation, scopedLocationIds } = useLocationScope();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [suppliers, setSuppliers] = useState({});
  const [locations, setLocations] = useState({});
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [items, setItems] = useState({});
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  // ---------- filters ----------
  const [filterSupplierId, setFilterSupplierId] = useState('');
  const [filterLocationId, setFilterLocationId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('');
  const [filterCreatedBy, setFilterCreatedBy] = useState('');

  // ---------- inline return modal ----------
  const [returnModal, setReturnModal] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnAlready, setReturnAlready] = useState({});
  const [returnQtyMap, setReturnQtyMap] = useState({});
  const [returnDate, setReturnDate] = useState(
    todayLocal(business?.time_zone)
  );
  const [returnReason, setReturnReason] = useState('');
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnError, setReturnError] = useState('');

  const canCreate =
    profile?.is_owner || can('purchases', 'create');

  const canEdit =
    profile?.is_owner || can('purchases', 'edit');

  const load = async () => {
    if (!business?.id) return;

    setLoading(true);

    const [
      { data: purchaseRows },
      { data: contactRows },
      { data: locRows },
      { data: userRows },
    ] = await Promise.all([
      fetchAllBatched(() => {
        let q = supabase
          .from('purchases')
          .select('*')
          .eq('business_id', business.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false });
        if (isScopedToLocation && scopedLocationIds.length > 0) {
          q = q.in('location_id', scopedLocationIds);
        }
        return q;
      }),

      supabase
        .from('contacts')
        .select('id, name')
        .eq('business_id', business.id),

      supabase
        .from('locations')
        .select('id, name')
        .eq('business_id', business.id),

      supabase
        .from('users')
        .select('id, first_name, username')
        .eq('business_id', business.id),
    ]);

    setRows(purchaseRows || []);

    setSuppliers(
      Object.fromEntries(
        (contactRows || []).map((c) => [c.id, c.name])
      )
    );

    setLocations(
      Object.fromEntries(
        (locRows || []).map((l) => [l.id, l.name])
      )
    );

    setUsers(
      Object.fromEntries(
        (userRows || []).map((u) => [
          u.id,
          u.first_name || u.username || 'Unknown user',
        ])
      )
    );

    setLoading(false);
  };

  useEffect(() => {
    load();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business?.id]);

  const toggleExpand = async (purchaseId) => {
    if (expanded === purchaseId) {
      setExpanded(null);
      return;
    }

    setExpanded(purchaseId);

    if (!items[purchaseId]) {
      const { data } = await supabase
        .from('purchase_items')
        .select('*, products(name)')
        .eq('purchase_id', purchaseId);

      setItems((prev) => ({
        ...prev,
        [purchaseId]: data || [],
      }));
    }
  };

  const getPaymentStatus = (purchase) => {
    const due =
      Number(purchase.grand_total) -
      Number(purchase.advance_payment || 0);

    return due > 0 ? 'due' : 'paid';
  };

  const markReceived = async (purchase) => {
    setError('');
    setBusyId(purchase.id);

    try {
      const { data: purchaseItems } = await supabase
        .from('purchase_items')
        .select('*')
        .eq('purchase_id', purchase.id);

      const stockRows = (purchaseItems || []).map((it) => ({
        business_id: business.id,
        product_id: it.product_id,
        variant_id: it.variant_id,
        location_id: purchase.location_id,
        change_qty: it.quantity,
        reason: 'purchase',
        reference_type: 'purchase',
        reference_id: purchase.id,
        created_by: profile.id,
      }));

      if (stockRows.length > 0) {
        const { error: stockErr } = await supabase
          .from('stock_ledger')
          .insert(stockRows);

        if (stockErr) throw stockErr;
      }

      if (purchase.supplier_id) {
        const owed =
          Number(purchase.grand_total) -
          Number(purchase.advance_payment);

        if (owed !== 0) {
          const { error: ledgerErr } = await supabase
            .from('contact_ledger')
            .insert({
              business_id: business.id,
              contact_id: purchase.supplier_id,
              reference_type: 'purchase',
              reference_id: purchase.id,
              amount: owed,
            });

          if (ledgerErr) throw ledgerErr;
        }
      }

      const { error: statusErr } = await supabase
        .from('purchases')
        .update({
          purchase_status: 'received',
        })
        .eq('id', purchase.id);

      if (statusErr) throw statusErr;

      if (purchase.supplier_id) {
        const owed =
          Number(purchase.grand_total) -
          Number(purchase.advance_payment);

        try {
          await notifyPaymentDueSupplier({
            businessId: business.id,
            purchaseId: purchase.id,
            supplierName:
              suppliers[purchase.supplier_id] || 'the supplier',
            owedAmount: owed,
            currency: business.currency,
          });
        } catch {
          // best-effort
        }
      }

      load();
    } catch (err) {
      setError(
        err.message ||
        'Could not mark this purchase as received.'
      );
    } finally {
      setBusyId(null);
    }
  };

  // ---------- search fields ----------
  const purchaseSearchFields = useMemo(
    () => [
      (purchase) =>
        suppliers[purchase.supplier_id] || '',
      (purchase) =>
        purchase.grand_total ?? '',
    ],
    [suppliers]
  );

  // ---------- filtering ----------
  const filteredRows = useMemo(() => {
    return rows.filter((purchase) => {
      const paymentStatus =
        getPaymentStatus(purchase);

      const createdById =
        purchase.created_by || purchase.added_by;

      const matchesSupplier =
        !filterSupplierId ||
        String(purchase.supplier_id) === filterSupplierId;

      const matchesLocation =
        isScopedToLocation
          ? (scopedLocationIds.length === 0
              ? false
              : scopedLocationIds.includes(purchase.location_id))
          : (!filterLocationId ||
              String(purchase.location_id) === filterLocationId);

      const matchesStatus =
        !filterStatus ||
        purchase.purchase_status === filterStatus;

      const matchesPaymentStatus =
        !filterPaymentStatus ||
        paymentStatus === filterPaymentStatus;

      const matchesCreatedBy =
        !filterCreatedBy ||
        String(createdById) === filterCreatedBy;

      return (
        matchesSupplier &&
        matchesLocation &&
        matchesStatus &&
        matchesPaymentStatus &&
        matchesCreatedBy
      );
    });
  }, [
    rows,
    filterSupplierId,
    filterLocationId,
    filterStatus,
    filterPaymentStatus,
    filterCreatedBy,
  ]);

  // ---------- search ----------
  const search = useDataSearch(
    filteredRows,
    purchaseSearchFields
  );

  // ---------- sorting ----------
  const purchaseSortFields = useMemo(
    () => [
      {
        key: 'purchase_date',
        label: 'Date',
        type: 'date',
      },
      {
        key: 'supplier',
        label: 'Supplier',
        type: 'text',
        getValue: (purchase) =>
          suppliers[purchase.supplier_id] ||
          'Cash / unspecified',
      },
      {
        key: 'location',
        label: 'Location',
        type: 'text',
        getValue: (purchase) =>
          locations[purchase.location_id] || '',
      },
      {
        key: 'purchase_status',
        label: 'Status',
        type: 'text',
      },
      {
        key: 'payment_status',
        label: 'Payment Status',
        type: 'text',
        getValue: (purchase) =>
          getPaymentStatus(purchase),
      },
      {
        key: 'created_by',
        label: 'Added By',
        type: 'text',
        getValue: (purchase) => {
          const createdById =
            purchase.created_by ||
            purchase.added_by;

          return users[createdById] || '';
        },
      },
      {
        key: 'grand_total',
        label: 'Total',
        type: 'number',
      },
      {
        key: 'due_amount',
        label: 'Due',
        type: 'number',
        getValue: (purchase) =>
          Number(purchase.grand_total || 0) -
          Number(purchase.advance_payment || 0),
      },
    ],
    [suppliers, locations, users]
  );

  const sort = useDataSort(
    search.filteredData,
    purchaseSortFields
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

  const currentPageTotal = paginatedItems.reduce(
    (sum, purchase) =>
      sum + Number(purchase.grand_total || 0),
    0
  );

  const currentPageDue = paginatedItems.reduce(
    (sum, purchase) =>
      sum +
      Number(purchase.grand_total || 0) -
      Number(purchase.advance_payment || 0),
    0
  );

  // ---------- filter options ----------
  const supplierFilterOptions = useMemo(() => {
    const ids = new Set(
      rows
        .map((r) => r.supplier_id)
        .filter(Boolean)
    );

    return [...ids]
      .map((id) => ({
        id,
        name: suppliers[id] || 'Unknown supplier',
      }))
      .sort((a, b) =>
        a.name.localeCompare(b.name)
      );
  }, [rows, suppliers]);

  const locationFilterOptions = useMemo(() => {
    const ids = new Set(
      rows
        .map((r) => r.location_id)
        .filter(Boolean)
    );

    return [...ids]
      .map((id) => ({
        id,
        name: locations[id] || 'Unknown location',
      }))
      .sort((a, b) =>
        a.name.localeCompare(b.name)
      );
  }, [rows, locations]);

  const statusFilterOptions = useMemo(() => {
    return [
      ...new Set(
        rows
          .map((r) => r.purchase_status)
          .filter(Boolean)
      ),
    ].sort();
  }, [rows]);

  const paymentStatusFilterOptions = useMemo(() => {
    return ['due', 'paid'];
  }, []);

  const createdByFilterOptions = useMemo(() => {
    const ids = new Set(
      rows
        .map((r) => r.created_by || r.added_by)
        .filter(Boolean)
    );

    return [...ids]
      .map((id) => ({
        id,
        name: users[id] || 'Unknown user',
      }))
      .sort((a, b) =>
        a.name.localeCompare(b.name)
      );
  }, [rows, users]);

  const clearFilters = () => {
    setFilterSupplierId('');
    setFilterLocationId('');
    setFilterStatus('');
    setFilterPaymentStatus('');
    setFilterCreatedBy('');
  };

  const hasActiveFilters =
    filterSupplierId ||
    filterLocationId ||
    filterStatus ||
    filterPaymentStatus ||
    filterCreatedBy;

  // ---------- inline return modal ----------
  const openReturn = async (purchase) => {
    setReturnModal(purchase);
    setReturnDate(
      todayLocal(business?.time_zone)
    );
    setReturnReason('');
    setReturnQtyMap({});
    setReturnError('');
    setReturnLoading(true);

    const { data } = await supabase
      .from('purchase_items')
      .select('*, products(name, alert_quantity)')
      .eq('purchase_id', purchase.id);

    const its = data || [];

    setReturnItems(its);

    const itemIds = its.map((it) => it.id);
    const returned = {};

    if (itemIds.length > 0) {
      const { data: priorReturns } = await supabase
        .from('purchase_return_items')
        .select(
          'purchase_item_id, quantity_returned'
        )
        .in('purchase_item_id', itemIds);

      (priorReturns || []).forEach((r) => {
        returned[r.purchase_item_id] =
          (returned[r.purchase_item_id] || 0) +
          Number(r.quantity_returned);
      });
    }

    setReturnAlready(returned);
    setReturnLoading(false);
  };

  const closeReturn = () => {
    if (!returnSubmitting) {
      setReturnModal(null);
    }
  };

  const returnRows = useMemo(
    () =>
      returnItems.map((it) => {
        const purchasedQty = Number(it.quantity);
        const returned = returnAlready[it.id] || 0;
        const remaining = purchasedQty - returned;

        const unitEffective =
          purchasedQty > 0
            ? Math.round((Number(it.line_total) / purchasedQty) * 100) / 100
            : 0;

        const qty = Number(
          returnQtyMap[it.id] || 0
        );

        const amount = Math.round((qty * unitEffective) * 100) / 100;

        return {
          item: it,
          purchasedQty,
          returned,
          remaining,
          unitEffective,
          qty,
          amount,
        };
      }),
    [returnItems, returnAlready, returnQtyMap]
  );

  const returnTotal = returnRows.reduce(
    (sum, r) => sum + r.amount,
    0
  );

  const setReturnQty = (itemId, value) => {
    setReturnQtyMap((prev) => ({
      ...prev,
      [itemId]: value,
    }));
  };

  const submitReturn = async (e) => {
    e.preventDefault();
    setReturnError('');

    const activeRows = returnRows.filter(
      (r) => r.qty > 0
    );

    if (activeRows.length === 0) {
      setReturnError(
        'Enter a return quantity for at least one item.'
      );
      return;
    }

    for (const r of activeRows) {
      if (!Number.isInteger(r.qty)) {
        setReturnError(
          `Return quantity for ${r.item.products?.name || 'this product'
          } must be a whole number.`
        );
        return;
      }

      if (r.qty < 0) {
        setReturnError(
          `Return quantity for ${r.item.products?.name || 'this product'
          } cannot be negative.`
        );
        return;
      }

      if (r.qty > Math.floor(r.remaining)) {
        setReturnError(
          `Return quantity for ${r.item.products?.name || 'this product'
          } cannot be greater than the remaining quantity (${Math.floor(
            r.remaining
          )}).`
        );
        return;
      }
    }

    setReturnSubmitting(true);

    try {
      const {
        data: purchaseReturn,
        error: prErr,
      } = await supabase
        .from('purchase_returns')
        .insert({
          business_id: business.id,
          purchase_id: returnModal.id,
          return_date: returnDate,
          reason: returnReason || null,
          total_amount: returnTotal,
          created_by: profile.id,
        })
        .select()
        .single();

      if (prErr) throw prErr;

      const itemRows = activeRows.map((r) => ({
        purchase_return_id: purchaseReturn.id,
        purchase_item_id: r.item.id,
        quantity_returned: r.qty,
        amount: r.amount,
      }));

      const { error: itemsErr } = await supabase
        .from('purchase_return_items')
        .insert(itemRows);

      if (itemsErr) throw itemsErr;

      const stockRows = activeRows.map((r) => ({
        business_id: business.id,
        product_id: r.item.product_id,
        location_id: returnModal.location_id,
        change_qty: -r.qty,
        reason: 'purchase_return',
        reference_type: 'purchase_return',
        reference_id: purchaseReturn.id,
        created_by: profile.id,
      }));

      const { error: stockErr } = await supabase
        .from('stock_ledger')
        .insert(stockRows);

      if (stockErr) throw stockErr;

      const adjustedGrandTotal = Math.max(
        Number(returnModal.grand_total || 0) - returnTotal,
        0
      );
      const revisedAdvance = Math.max(
        Number(returnModal.advance_payment || 0) - returnTotal,
        0
      );
      const revisedDue = Math.max(
        adjustedGrandTotal - revisedAdvance,
        0
      );

      const { error: purchaseUpdateErr } = await supabase
        .from('purchases')
        .update({
          advance_payment: revisedAdvance,
          grand_total: adjustedGrandTotal,
          due_amount: revisedDue,
        })
        .eq('id', returnModal.id);

      if (purchaseUpdateErr) throw purchaseUpdateErr;

      if (
        returnModal.supplier_id &&
        returnTotal !== 0
      ) {
        await supabase
          .from('contact_ledger')
          .insert({
            business_id: business.id,
            contact_id: returnModal.supplier_id,
            reference_type: 'purchase_return',
            reference_id: purchaseReturn.id,
            amount: -returnTotal,
          });
      }

      try {
        const productsById = Object.fromEntries(
          activeRows.map((r) => [
            r.item.product_id,
            r.item.products,
          ])
        );

        await checkLowStockForItems({
          businessId: business.id,
          locationId: returnModal.location_id,
          items: activeRows.map((r) => ({
            product_id: r.item.product_id,
            quantity: r.qty,
          })),
          productsById,
        });
      } catch {
        // best-effort
      }

      setReturnModal(null);
    } catch (err) {
      setReturnError(
        err.message ||
        'Could not save this return.'
      );
    } finally {
      setReturnSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1>Purchases | Stock intake for {business?.business_name}.</h1>
        </div>

        {canCreate && (
          <div
            className="no-print"
            style={{
              display: 'flex',
              gap: 8,
            }}
          >
            <Link
              to="/reports/purchases"
              className="btn btn-secondary"
            >
              Purchases Report
            </Link>

            <Link
              to="/purchases/returns"
              className="btn btn-secondary"
            >
              Returns
            </Link>

            <Link
              to="/purchases/due"
              className="btn btn-secondary"
            >
              Payments Due
            </Link>

            <button
              className="btn btn-secondary"
              onClick={() => window.print()}
            >
              🖨 Print
            </button>

            <button
              className="btn btn-secondary"
              onClick={() => {
                const filename = buildPdfFilename('Purchases_List');
                downloadPDF('purchases-report-content', filename);
              }}
            >
              📄 Save PDF
            </button>

            <button
              className="btn btn-primary"
              onClick={() =>
                navigate('/purchases/new')
              }
            >
              + New purchase
            </button>
          </div>
        )}
      </div>

      {error && (
        <div
          className="error-text"
          style={{ marginBottom: 12 }}
        >
          {error}
        </div>
      )}

      <div className="card list-panel" id="purchases-report-content">
        <PrintReportHeader title="Purchases List" />

        {/* ---------- SEARCH ---------- */}
        <div
          className="no-print"
          style={{
            padding: '4px 4px 12px',
          }}
        >
          <DataSearchBar
            query={search.query}
            setQuery={search.setQuery}
            clearSearch={search.clearSearch}
            placeholder="Search supplier or total..."
          />
        </div>

        {/* ---------- FILTERS ---------- */}
        <div
          className="no-print"
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            padding: '4px 4px 16px',
          }}
        >
          {/* Supplier */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              minWidth: 180,
            }}
          >
            <label
              className="muted"
              style={{
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Filter by supplier
            </label>

            <select
              value={filterSupplierId}
              onChange={(e) =>
                setFilterSupplierId(e.target.value)
              }
            >
              <option value="">
                All suppliers
              </option>

              {supplierFilterOptions.map((s) => (
                <option
                  key={s.id}
                  value={s.id}
                >
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Location — owners only */}
          {isOwner && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                minWidth: 180,
              }}
            >
              <label
                className="muted"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Filter by location
              </label>

              <select
                value={filterLocationId}
                onChange={(e) =>
                  setFilterLocationId(e.target.value)
                }
              >
                <option value="">
                  All locations
                </option>

                {locationFilterOptions.map((l) => (
                  <option
                    key={l.id}
                    value={l.id}
                  >
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Status */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              minWidth: 160,
            }}
          >
            <label
              className="muted"
              style={{
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Filter by status
            </label>

            <select
              value={filterStatus}
              onChange={(e) =>
                setFilterStatus(e.target.value)
              }
            >
              <option value="">
                All statuses
              </option>

              {statusFilterOptions.map((status) => (
                <option
                  key={status}
                  value={status}
                >
                  {status}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Status */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              minWidth: 180,
            }}
          >
            <label
              className="muted"
              style={{
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Filter by payment
            </label>

            <select
              value={filterPaymentStatus}
              onChange={(e) =>
                setFilterPaymentStatus(e.target.value)
              }
            >
              <option value="">
                All payment statuses
              </option>

              {paymentStatusFilterOptions.map(
                (status) => (
                  <option
                    key={status}
                    value={status}
                  >
                    {status}
                  </option>
                )
              )}
            </select>
          </div>

          {/* Added By */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              minWidth: 180,
            }}
          >
            <label
              className="muted"
              style={{
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Filter by added by
            </label>

            <select
              value={filterCreatedBy}
              onChange={(e) =>
                setFilterCreatedBy(e.target.value)
              }
            >
              <option value="">
                All users
              </option>

              {createdByFilterOptions.map((u) => (
                <option
                  key={u.id}
                  value={u.id}
                >
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {(hasActiveFilters || search.isActive) && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{
                alignSelf: 'flex-end',
              }}
              onClick={() => {
                clearFilters();
                search.clearSearch();
              }}
            >
              Clear all
            </button>
          )}
        </div>

        <div style={{ overflowX: 'auto', paddingBottom: 16 }}>
          <table className="data-table table-compact" style={{ whiteSpace: 'nowrap' }}>
            <thead>
              <tr>
                <th className="no-print"></th>

                <SortableHeader
                  label="Date"
                  sortKey="purchase_date"
                  currentSortKey={sort.sortKey}
                  sortDirection={sort.sortDirection}
                  toggleSortKey={sort.toggleSortKey}
                />

                <th className="no-print">Actions</th>

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
                  className="no-print"
                  label="Status"
                  sortKey="purchase_status"
                  currentSortKey={sort.sortKey}
                  sortDirection={sort.sortDirection}
                  toggleSortKey={sort.toggleSortKey}
                />

                <SortableHeader
                  className="no-print"
                  label="Payment Status"
                  sortKey="payment_status"
                  currentSortKey={sort.sortKey}
                  sortDirection={sort.sortDirection}
                  toggleSortKey={sort.toggleSortKey}
                />

                <SortableHeader
                  label="Added By"
                  sortKey="created_by"
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
                  label="Due"
                  sortKey="due_amount"
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
                    colSpan={10}
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
                      colSpan={10}
                      className="muted table-empty"
                    >
                      No purchases match.
                    </td>
                  </tr>
                )}

              {!loading &&
                paginatedItems.map((p) => {
                  const paymentStatus =
                    getPaymentStatus(p);

                  const addedById =
                    p.created_by || p.added_by;

                  const addedBy =
                    users[addedById] || '—';

                  return (
                    <Fragment key={p.id}>
                      <tr
                        onClick={() =>
                          toggleExpand(p.id)
                        }
                        style={{
                          cursor: 'pointer',
                        }}
                      >
                        <td className="no-print">
                          {expanded === p.id
                            ? '▾'
                            : '▸'}
                        </td>

                        <td>{p.purchase_date}</td>

                        <td
                          className="table-actions no-print"
                          onClick={(e) =>
                            e.stopPropagation()
                          }
                        >
                          {canEdit && (
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '4px 8px', fontSize: '11px', marginRight: 4 }}
                              onClick={() =>
                                navigate(
                                  `/purchases/new?id=${p.id}`
                                )
                              }
                            >
                              Edit
                            </button>
                          )}

                          {canEdit &&
                            p.purchase_status ===
                            'draft' && (
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '4px 8px', fontSize: '11px', marginRight: 4 }}
                                disabled={
                                  busyId === p.id
                                }
                                onClick={() =>
                                  markReceived(p)
                                }
                              >
                                {busyId === p.id
                                  ? 'Receiving…'
                                  : 'Mark received'}
                              </button>
                            )}

                          {canEdit &&
                            p.purchase_status ===
                            'received' && (
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '4px 8px', fontSize: '11px' }}
                                onClick={() =>
                                  openReturn(p)
                                }
                              >
                                Return
                              </button>
                            )}
                        </td>

                        <td>
                          {suppliers[p.supplier_id] ||
                            'Cash / unspecified'}
                        </td>

                        <td>
                          {locations[p.location_id] ||
                            '—'}
                        </td>

                        <td className="no-print">
                          <span
                            className={`badge ${STATUS_BADGE[
                              p.purchase_status
                            ]
                              }`}
                          >
                            {p.purchase_status}
                          </span>
                        </td>

                        <td className="no-print">
                          <span
                            className={`badge ${PAYMENT_STATUS_BADGE[
                              paymentStatus
                            ]
                              }`}
                          >
                            {paymentStatus}
                          </span>
                        </td>

                        <td>{addedBy}</td>

                        <td>
                          {business?.currency}{' '}
                          {Number(
                            p.grand_total
                          ).toFixed(2)}
                        </td>

                        <td>
                          {business?.currency}{' '}
                          {(
                            Number(p.grand_total) -
                            Number(
                              p.advance_payment
                            )
                          ).toFixed(2)}
                        </td>
                      </tr>

                      {expanded === p.id && (
                        <tr>
                          <td
                            colSpan={10}
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
                                  <th>Qty</th>
                                  <th>Unit cost</th>
                                  <th>Line total</th>
                                </tr>
                              </thead>

                              <tbody>
                                {(
                                  items[p.id] || []
                                ).map((it) => (
                                  <tr
                                    key={it.id}
                                  >
                                    <td>
                                      {it.products
                                        ?.name ||
                                        '—'}
                                    </td>

                                    <td>
                                      {Number(
                                        it.quantity
                                      )}
                                    </td>

                                    <td>
                                      {
                                        business?.currency
                                      }{' '}
                                      {Number(
                                        it.unit_cost
                                      ).toFixed(2)}
                                    </td>

                                    <td>
                                      {
                                        business?.currency
                                      }{' '}
                                      {Number(
                                        it.line_total
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
                  );
                })}

              {!loading &&
                paginatedItems.length > 0 && (
                  <tr>
                    <td
                      colSpan={7}
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

                    <td
                      style={{
                        fontWeight: 700,
                      }}
                    >
                      {business?.currency}{' '}
                      {currentPageDue.toFixed(2)}
                    </td>

                    <td></td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>

        {!loading &&
          sort.sortedData.length > 0 && (
            <div className="no-print">
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
          )}
      </div>

      {/* ---------- inline return modal ---------- */}
      {returnModal && (
        <div
          onClick={closeReturn}
          style={{
            position: 'fixed',
            inset: 0,
            background:
              'rgba(19, 26, 51, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 20,
          }}
        >
          <div
            onClick={(e) =>
              e.stopPropagation()
            }
            style={{
              background: 'var(--white)',
              borderRadius:
                'var(--radius-lg)',
              padding: '24px 26px',
              width: '100%',
              maxWidth: 640,
              boxShadow:
                'var(--shadow-lg)',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
          >
            <h2
              style={{
                fontSize: 17,
                marginBottom: 4,
              }}
            >
              Return items — Purchase #
              {returnModal.id}
            </h2>

            <p
              className="muted"
              style={{
                fontSize: 13,
                marginTop: 0,
                marginBottom: 14,
              }}
            >
              {suppliers[
                returnModal.supplier_id
              ] || 'Cash / unspecified'}{' '}
              ·{' '}
              {locations[
                returnModal.location_id
              ]}
            </p>

            {returnLoading ? (
              <div className="muted">
                Loading items…
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      '1fr 1fr',
                    gap: 10,
                    marginBottom: 14,
                  }}
                >
                  <div className="field">
                    <label>
                      Return date
                    </label>

                    <input
                      type="date"
                      value={returnDate}
                      onChange={(e) =>
                        setReturnDate(
                          e.target.value
                        )
                      }
                    />
                  </div>

                  <div className="field">
                    <label>
                      Reason
                    </label>

                    <input
                      value={returnReason}
                      onChange={(e) =>
                        setReturnReason(
                          e.target.value
                        )
                      }
                      placeholder="Damaged, wrong item, etc."
                    />
                  </div>
                </div>

                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Purchased</th>
                      <th>
                        Already returned
                      </th>
                      <th>Remaining</th>
                      <th>Return qty</th>
                      <th>Amount</th>
                    </tr>
                  </thead>

                  <tbody>
                    {returnRows.map((r) => (
                      <tr
                        key={r.item.id}
                      >
                        <td>
                          {r.item.products
                            ?.name}
                        </td>

                        <td>
                          {r.purchasedQty}
                        </td>

                        <td>
                          {r.returned}
                        </td>

                        <td>
                          {r.remaining}
                        </td>

                        <td>
                          <input
                            type="number"
                            min="0"
                            max={Math.floor(r.remaining)}
                            step="1"
                            inputMode="numeric"
                            className="line-input line-input-sm"
                            value={returnQtyMap[r.item.id] || ''}
                            onChange={(e) => {
                              const value = e.target.value;

                              // Allow clearing the field
                              if (value === '') {
                                setReturnQty(r.item.id, '');
                                return;
                              }

                              const quantity = Number(value);
                              const maximumQuantity = Math.floor(r.remaining);

                              // Do not allow negative, decimal, or excessive quantities
                              if (
                                Number.isInteger(quantity) &&
                                quantity >= 0 &&
                                quantity <= maximumQuantity
                              ) {
                                setReturnQty(r.item.id, quantity);
                              }
                            }}
                            onKeyDown={(e) => {
                              // Prevent decimal, negative, and scientific notation characters
                              if (['.', '-', '+', 'e', 'E'].includes(e.key)) {
                                e.preventDefault();
                              }
                            }}
                            disabled={r.remaining <= 0}
                          />
                        </td>

                        <td>
                          {
                            business?.currency
                          }{' '}
                          {r.amount.toFixed(
                            2
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="totals-summary">
                  <div className="totals-grand">
                    <span>
                      Total credit
                    </span>

                    <span>
                      {
                        business?.currency
                      }{' '}
                      {returnTotal.toFixed(
                        2
                      )}
                    </span>
                  </div>
                </div>

                {returnError && (
                  <div
                    className="error-text"
                    style={{
                      marginTop: 10,
                    }}
                  >
                    {returnError}
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    justifyContent:
                      'flex-end',
                    gap: 10,
                    marginTop: 16,
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={closeReturn}
                    disabled={
                      returnSubmitting
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={submitReturn}
                    disabled={
                      returnSubmitting
                    }
                  >
                    {returnSubmitting
                      ? 'Saving…'
                      : 'Confirm return'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}