import { useEffect, useMemo, useState, Fragment } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';
import { fetchAllBatched } from '../lib/fetchUtils.js';
import {
  checkLowStockForItems,
  notifyPaymentDueCustomer,
} from '../lib/notifications.js';
import { printSaleInvoice } from '../lib/printInvoice.js';
import useDataSearch from '../hooks/useDataSearch.js';
import useDataSort from '../hooks/useDataSort.js';
import DataSearchBar from '../components/DataSearchBar.jsx';
import SortableHeader from '../components/SortableHeader.jsx';
import { getOpenRegisterId } from '../lib/registerUtils.js';
import { formatTimestamp, todayLocal } from '../lib/timezone.js';
import useLocationScope from '../hooks/useLocationScope.js';


const STATUS_BADGE = {
  draft: 'badge-info',
  quotation: 'badge-warning',
  confirmed: 'badge-success',
  shipped: 'badge-info',
  returned: 'badge-danger',
  partially_returned: 'badge-warning',
};

export default function Sales() {
  const { business, profile, can } = useAuth();
  const { isOwner, isScopedToLocation, scopedLocationIds, hasNoLocations } = useLocationScope();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [customers, setCustomers] = useState({});
  const [customerNumbers, setCustomerNumbers] = useState({});
  const [locations, setLocations] = useState({});
  const [users, setUsers] = useState({});
  const [itemTotals, setItemTotals] = useState({});

  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [items, setItems] = useState({});
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  // Dynamic sales return modal
  const [returnModal, setReturnModal] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnAlready, setReturnAlready] = useState({});
  const [returnQtyMap, setReturnQtyMap] = useState({});
  const [returnDate, setReturnDate] = useState(todayLocal(business?.time_zone));
  const [returnReason, setReturnReason] = useState('');
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnError, setReturnError] = useState('');

  const [statusFilter, setStatusFilter] =
    useState('all');

  const [paymentStatusFilter, setPaymentStatusFilter] =
    useState('all');

  const [locationFilter, setLocationFilter] =
    useState('');

  const [customerFilter, setCustomerFilter] =
    useState('');

  const [paymentMethodFilter, setPaymentMethodFilter] =
    useState('all');

  const [addedByFilter, setAddedByFilter] =
    useState('');

  const [currentPage, setCurrentPage] = useState(1);

  const rowsPerPage = 18;

  const canCreate =
    profile?.is_owner || can('sales', 'create');

  const canEdit =
    profile?.is_owner || can('sales', 'edit');

  const canReturn = canCreate;

  const RETURNABLE_STATUSES = [
    'confirmed',
    'shipped',
    'partially_returned',
  ];

  const load = async () => {
    if (!business?.id) return;

    setLoading(true);
    setError('');

    const [
      {
        data: saleRows,
        error: salesError,
      },
      {
        data: contactRows,
        error: contactsError,
      },
      {
        data: locRows,
        error: locationsError,
      },
      {
        data: userRows,
        error: usersError,
      },
    ] = await Promise.all([
      fetchAllBatched(() => {
        let q = supabase
          .from('sales')
          .select('*')
          .eq('business_id', business.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false });
        // Scope to assigned locations for staff
        if (isScopedToLocation && scopedLocationIds.length > 0) {
          q = q.in('location_id', scopedLocationIds);
        }
        return q;
      }),

      supabase
        .from('contacts')
        .select('id, name, contact_number')
        .eq('business_id', business.id),

      supabase
        .from('locations')
        .select('id, name')
        .eq('business_id', business.id),

      supabase
        .from('users')
        .select('id, first_name')
        .eq('business_id', business.id),
    ]);

    if (salesError) {
      setError(salesError.message);
      setLoading(false);
      return;
    }

    if (contactsError) {
      setError(contactsError.message);
    }

    if (locationsError) {
      setError(locationsError.message);
    }

    if (usersError) {
      setError(usersError.message);
    }

    const saleIds = (saleRows || []).map(
      (sale) => sale.id
    );

    let allSaleItems = [];

    if (saleIds.length > 0) {
      const {
        data: saleItemRows,
        error: saleItemsError,
      } = await fetchAllBatched(() =>
        supabase
          .from('sale_items')
          .select('sale_id, quantity')
          .in('sale_id', saleIds)
      );

      if (saleItemsError) {
        setError(saleItemsError.message);
      }

      allSaleItems = saleItemRows || [];
    }

    const totals = {};

    allSaleItems.forEach((item) => {
      totals[item.sale_id] =
        (totals[item.sale_id] || 0) +
        Number(item.quantity || 0);
    });

    setRows(saleRows || []);

    setCustomers(
      Object.fromEntries(
        (contactRows || []).map((c) => [
          c.id,
          c.name,
        ])
      )
    );

    setCustomerNumbers(
      Object.fromEntries(
        (contactRows || []).map((c) => [
          c.id,
          c.contact_number || '—',
        ])
      )
    );

    setLocations(
      Object.fromEntries(
        (locRows || []).map((l) => [
          l.id,
          l.name,
        ])
      )
    );

    setUsers(
      Object.fromEntries(
        (userRows || []).map((u) => [
          u.id,
          u.first_name,
        ])
      )
    );

    setItemTotals(totals);

    setLoading(false);
  };

  useEffect(() => {
    load();

    /* eslint-disable-next-line */
  }, [business?.id]);

  /*
   * SEARCH
   *
   * Only:
   * - Invoice #
   * - Customer name
   * - Total amount
   */
  const search = useDataSearch(rows, [
    (sale) => sale.id,

    (sale) =>
      customers[sale.customer_id] ||
      'walk-in',

    (sale) => sale.grand_total,
  ]);

  const locationOptions = useMemo(
    () =>
      Object.entries(locations)
        .map(([id, name]) => ({
          id: Number(id),
          name,
        }))
        .sort((a, b) =>
          a.name.localeCompare(b.name)
        ),
    [locations]
  );

  const customerOptions = useMemo(
    () =>
      Object.entries(customers)
        .map(([id, name]) => ({
          id: Number(id),
          name,
        }))
        .sort((a, b) =>
          a.name.localeCompare(b.name)
        ),
    [customers]
  );

  const addedByOptions = useMemo(
    () =>
      Object.entries(users)
        .map(([id, name]) => ({
          id: Number(id),
          name,
        }))
        .sort((a, b) =>
          a.name.localeCompare(b.name)
        ),
    [users]
  );

  const paymentMethodOptions = useMemo(() => {
    const methods = new Set();

    rows.forEach((sale) => {
      if (sale.payment_method) {
        methods.add(sale.payment_method);
      }
    });

    return Array.from(methods).sort();
  }, [rows]);

  /*
   * SORTING
   *
   * Every visible data column is sortable.
   * Expand and Actions columns are not sortable.
   */
  const sortFields = [
    { key: 'id', label: 'Invoice #', type: 'number' },
    { key: 'grand_total', label: 'Total Amount', type: 'number' },
    { key: 'total_items', label: 'Total Items Sold', type: 'number', getValue: (sale) => itemTotals[sale.id] || 0 },
    { key: 'status', label: 'Status', type: 'text' },
    { key: 'location', label: 'Location', type: 'text', getValue: (sale) => locations[sale.location_id] || '' },
    { key: 'created_at', label: 'Time', type: 'date' },
    { key: 'customer', label: 'Customer', type: 'text', getValue: (sale) => customers[sale.customer_id] || 'Walk-in' },
    { key: 'customer_number', label: 'Customer Number', type: 'text', getValue: (sale) => sale.customer_id ? customerNumbers[sale.customer_id] || '' : '' },
    { key: 'payment_method', label: 'Payment Method', type: 'text' },
    { key: 'paid_amount', label: 'Paid Amount', type: 'number' },
    { key: 'due_amount', label: 'Due Amount', type: 'number' },
    { key: 'payment_status', label: 'Payment Status', type: 'text', getValue: (sale) => Number(sale.due_amount || 0) > 0 ? 'due' : 'paid' },
    { key: 'added_by', label: 'Added By', type: 'text', getValue: (sale) => sale.created_by ? users[sale.created_by] || '' : '' },
  ];

  const sort = useDataSort(
    search.filteredData,
    sortFields
  );

  /*
   * FILTERS
   *
   * Existing:
   * - Status
   * - Payment status
   * - Location
   *
   * Added:
   * - Customer
   * - Payment method
   * - Added by
   */
  const filteredRows = useMemo(() => {
    return sort.sortedData.filter((s) => {
      if (
        statusFilter !== 'all' &&
        s.status !== statusFilter
      ) {
        return false;
      }

      const paymentStatus =
        Number(s.due_amount || 0) > 0
          ? 'due'
          : 'paid';

      if (
        paymentStatusFilter !== 'all' &&
        paymentStatus !== paymentStatusFilter
      ) {
        return false;
      }

      if (isScopedToLocation) {
        // Staff: auto-filter to their assigned locations
        if (scopedLocationIds.length === 0) return false;
        if (!scopedLocationIds.includes(s.location_id)) return false;
      } else if (
        locationFilter &&
        s.location_id !== Number(locationFilter)
      ) {
        return false;
      }

      if (
        customerFilter &&
        s.customer_id !== Number(customerFilter)
      ) {
        return false;
      }

      if (
        paymentMethodFilter !== 'all' &&
        s.payment_method !== paymentMethodFilter
      ) {
        return false;
      }

      if (
        addedByFilter &&
        s.created_by !== Number(addedByFilter)
      ) {
        return false;
      }

      return true;
    });
  }, [
    sort.sortedData,
    statusFilter,
    paymentStatusFilter,
    locationFilter,
    customerFilter,
    paymentMethodFilter,
    addedByFilter,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    search.query,
    statusFilter,
    paymentStatusFilter,
    locationFilter,
    customerFilter,
    paymentMethodFilter,
    addedByFilter,
  ]);

  const totalPages = Math.ceil(
    filteredRows.length / rowsPerPage
  );

  const paginatedRows = useMemo(() => {
    const startIndex =
      (currentPage - 1) * rowsPerPage;

    return filteredRows.slice(
      startIndex,
      startIndex + rowsPerPage
    );
  }, [
    filteredRows,
    currentPage,
    rowsPerPage,
  ]);

  const summaryTotals = useMemo(() => {
    return paginatedRows.reduce(
      (totals, sale) => {
        totals.total += Number(
          sale.grand_total || 0
        );

        totals.paid += Number(
          sale.paid_amount || 0
        );

        totals.due += Number(
          sale.due_amount || 0
        );

        totals.items += Number(
          itemTotals[sale.id] || 0
        );

        return totals;
      },
      {
        total: 0,
        paid: 0,
        due: 0,
        items: 0,
      }
    );
  }, [paginatedRows, itemTotals]);

  const toggleExpand = async (saleId) => {
    if (expanded === saleId) {
      setExpanded(null);
      return;
    }

    setExpanded(saleId);

    if (!items[saleId]) {
      const {
        data,
        error: itemsError,
      } = await supabase
        .from('sale_items')
        .select('*, products(name)')
        .eq('sale_id', saleId);

      if (itemsError) {
        setError(itemsError.message);
        return;
      }

      setItems((prev) => ({
        ...prev,
        [saleId]: data || [],
      }));
    }
  };

  const handlePrint = async (sale) => {
    setError('');
    setBusyId(`print-${sale.id}`);

    try {
      let saleItems = items[sale.id];

      if (!saleItems) {
        const { data, error: itemsError } = await supabase
          .from('sale_items')
          .select('*, products(name)')
          .eq('sale_id', sale.id);

        if (itemsError) throw itemsError;
        saleItems = data || [];

        setItems((prev) => ({
          ...prev,
          [sale.id]: saleItems,
        }));
      }

      const formattedItems = saleItems.map((it) => ({
        ...it,
        product_name: it.products?.name || '—',
      }));

      let customer = null;
      if (sale.customer_id) {
        const { data: contactData } = await supabase
          .from('contacts')
          .select('name, contact_number, address')
          .eq('id', sale.customer_id)
          .single();
        customer = contactData;
      }

      const sellerInfo = {
        name: users[sale.created_by] || 'System',
      };

      printSaleInvoice({
        business,
        sale,
        items: formattedItems,
        customer,
        seller: sellerInfo,
        footerNote: business.settings?.invoice_footer_note || '',
      });
    } catch (err) {
      setError(err.message || 'Could not print invoice');
    } finally {
      setBusyId(null);
    }
  };

  const confirmSale = async (sale) => {
    setError('');
    setBusyId(sale.id);

    try {
      const {
        data: saleItems,
        error: saleItemsError,
      } = await supabase
        .from('sale_items')
        .select(
          '*, products(name, alert_quantity)'
        )
        .eq('sale_id', sale.id);

      if (saleItemsError) {
        throw saleItemsError;
      }

      const stockRows = (saleItems || []).map(
        (it) => ({
          business_id: business.id,
          product_id: it.product_id,
          variant_id: it.variant_id,
          location_id: sale.location_id,
          change_qty: -Number(it.quantity),
          reason: 'sale',
          reference_type: 'sale',
          reference_id: sale.id,
          created_by: profile.id,
        })
      );

      if (stockRows.length > 0) {
        const { error: stockErr } =
          await supabase
            .from('stock_ledger')
            .insert(stockRows);

        if (stockErr) throw stockErr;
      }

      if (sale.customer_id) {
        const owed = Number(
          sale.due_amount || 0
        );

        if (owed !== 0) {
          const { error: ledgerErr } =
            await supabase
              .from('contact_ledger')
              .insert({
                business_id: business.id,
                contact_id: sale.customer_id,
                reference_type: 'sale',
                reference_id: sale.id,
                amount: owed,
              });

          if (ledgerErr) throw ledgerErr;
        }
      }

      const { error: statusErr } =
        await supabase
          .from('sales')
          .update({
            status: 'confirmed',
          })
          .eq('id', sale.id);

      if (statusErr) throw statusErr;

      try {
        const productsById =
          Object.fromEntries(
            (saleItems || []).map((it) => [
              it.product_id,
              it.products,
            ])
          );

        await checkLowStockForItems({
          businessId: business.id,
          locationId: sale.location_id,
          locationName:
            locations[sale.location_id],
          items: (saleItems || []).map(
            (it) => ({
              product_id: it.product_id,
              quantity: it.quantity,
            })
          ),
          productsById,
        });

        if (
          sale.customer_id &&
          Number(sale.due_amount || 0) > 0
        ) {
          await notifyPaymentDueCustomer({
            businessId: business.id,
            saleId: sale.id,
            customerName:
              customers[sale.customer_id] ||
              'the customer',
            dueAmount: Number(
              sale.due_amount || 0
            ),
            currency: business.currency,
          });
        }
      } catch {
        // Notifications are best-effort.
      }

      await load();
    } catch (err) {
      setError(
        err.message ||
        'Could not confirm this sale.'
      );
    } finally {
      setBusyId(null);
    }
  };

  const openReturn = async (sale) => {
    setReturnModal(sale);
    setReturnItems([]);
    setReturnAlready({});
    setReturnQtyMap({});
    setReturnDate(todayLocal(business?.time_zone));
    setReturnReason('');
    setReturnError('');
    setReturnLoading(true);

    try {
      const { data: saleItems, error: saleItemsError } = await supabase
        .from('sale_items')
        .select('*, products(name)')
        .eq('sale_id', sale.id);
      if (saleItemsError) throw saleItemsError;
      const loadedItems = saleItems || [];
      if (loadedItems.length === 0) throw new Error('This sale has no items to return.');

      const itemIds = loadedItems.map((it) => it.id);
      const alreadyReturned = {};
      const { data: priorReturns, error: priorReturnsError } = await supabase
        .from('sell_return_items')
        .select('sale_item_id, quantity_returned')
        .in('sale_item_id', itemIds);
      if (priorReturnsError) throw priorReturnsError;

      (priorReturns || []).forEach((r) => {
        alreadyReturned[r.sale_item_id] =
          (alreadyReturned[r.sale_item_id] || 0) + Number(r.quantity_returned || 0);
      });

      const hasRemaining = loadedItems.some((it) =>
        Math.floor(Number(it.quantity || 0)) > Math.floor(alreadyReturned[it.id] || 0)
      );
      if (!hasRemaining) throw new Error('All items from this sale have already been returned.');

      setReturnItems(loadedItems);
      setReturnAlready(alreadyReturned);
    } catch (err) {
      setReturnModal(null);
      setError(err.message || 'Could not load sale items for return.');
    } finally {
      setReturnLoading(false);
    }
  };

  const closeReturn = () => {
    if (!returnSubmitting) setReturnModal(null);
  };

  const returnRows = useMemo(() => {
    return returnItems.map((it) => {
      const soldQty = Math.floor(Number(it.quantity || 0));
      const returned = Math.floor(Number(returnAlready[it.id] || 0));
      const remaining = Math.max(0, soldQty - returned);
      const unitEffective = soldQty > 0 ? Number(it.line_total || 0) / soldQty : 0;
      const qty = Number(returnQtyMap[it.id] || 0);
      return { item: it, soldQty, returned, remaining, qty, amount: qty * unitEffective };
    });
  }, [returnItems, returnAlready, returnQtyMap]);

  const returnTotal = useMemo(
    () => returnRows.reduce((sum, row) => sum + row.amount, 0),
    [returnRows]
  );

  const setReturnQty = (itemId, value, maximumQuantity) => {
    if (value === '') {
      setReturnQtyMap((prev) => ({ ...prev, [itemId]: '' }));
      return;
    }
    const qty = Number(value);
    if (!Number.isInteger(qty) || qty < 0 || qty > maximumQuantity) return;
    setReturnQtyMap((prev) => ({ ...prev, [itemId]: qty }));
  };

  const submitReturn = async (e) => {
    e.preventDefault();
    setReturnError('');
    const activeRows = returnRows.filter((r) => r.qty > 0);
    if (activeRows.length === 0) {
      setReturnError('Enter a return quantity for at least one item.');
      return;
    }
    for (const r of activeRows) {
      if (!Number.isInteger(r.qty) || r.qty <= 0 || r.qty > r.remaining) {
        setReturnError(`Return quantity for ${r.item.products?.name || 'this product'} must be a whole number between 1 and ${r.remaining}.`);
        return;
      }
    }

    setReturnSubmitting(true);
    try {
      const sale = returnModal;
      const register_id = await getOpenRegisterId(
        business.id,
        sale.location_id
      );

      const { data: sellReturn, error: srErr } = await supabase
        .from('sell_returns')
        .insert({
          business_id: business.id,
          sale_id: sale.id,
          register_id,
          return_date: returnDate,
          reason: returnReason || null,
          total_amount: returnTotal,
          created_by: profile.id,
        })
        .select()
        .single();
      if (srErr) throw srErr;

      const { error: itemsErr } = await supabase
        .from('sell_return_items')
        .insert(activeRows.map((r) => ({
          sell_return_id: sellReturn.id,
          sale_item_id: r.item.id,
          quantity_returned: r.qty,
          amount: r.amount,
        })));
      if (itemsErr) throw itemsErr;

      const { error: stockErr } = await supabase
        .from('stock_ledger')
        .insert(activeRows.map((r) => ({
          business_id: business.id,
          product_id: r.item.product_id,
          variant_id: r.item.variant_id,
          location_id: sale.location_id,
          change_qty: r.qty,
          reason: 'sell_return',
          reference_type: 'sell_return',
          reference_id: sellReturn.id,
          created_by: profile.id,
        })));
      if (stockErr) throw stockErr;

      if (sale.customer_id && returnTotal !== 0) {
        const { error: ledgerErr } = await supabase
          .from('contact_ledger')
          .insert({
            business_id: business.id,
            contact_id: sale.customer_id,
            reference_type: 'sell_return',
            reference_id: sellReturn.id,
            amount: -returnTotal,
          });
        if (ledgerErr) throw ledgerErr;
      }

      const allFullyReturned = returnRows.every((r) => r.returned + r.qty >= r.soldQty);
      const newDue = Math.max(Number(sale.due_amount || 0) - returnTotal, 0);
      const { error: saleUpdateErr } = await supabase
        .from('sales')
        .update({
          status: allFullyReturned ? 'returned' : 'partially_returned',
          due_amount: newDue,
        })
        .eq('id', sale.id);
      if (saleUpdateErr) throw saleUpdateErr;

      setItems((prev) => { const next = { ...prev }; delete next[sale.id]; return next; });
      setReturnModal(null);
      await load();
    } catch (err) {
      setReturnError(err.message || 'Could not return this sale.');
    } finally {
      setReturnSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1>Sales | Orders, quotations, and drafts for{' '}
            {business?.business_name}.</h1>
        </div>

        {canCreate && (
          <div
            style={{
              display: 'flex',
              gap: 8,
            }}
          >
            <Link
              to="/reports/sales"
              className="btn btn-secondary"
            >
              Sales Report
            </Link>
            <Link
              to="/sales/returns"
              className="btn btn-secondary"
            >
              Returns
            </Link>

            <Link
              to="/sales/due"
              className="btn btn-secondary"
            >
              Payments Due
            </Link>

            <button
              className="btn btn-primary"
              onClick={() =>
                navigate('/sales/new')
              }
            >
              + New sale
            </button>
          </div>
        )}
      </div>

      {error && (
        <div
          className="error-text"
          style={{
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      <div className="card list-panel">
        <div style={{ padding: '16px' }}>
          <DataSearchBar
            query={search.query}
            setQuery={search.setQuery}
            clearSearch={search.clearSearch}
            placeholder="Search invoice #, customer, or total…"
          />
        </div>
        <div className="list-toolbar">


          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value)
            }
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border:
                '1px solid var(--navy-border)',
            }}
          >
            <option value="all">
              All statuses
            </option>

            <option value="confirmed">
              Confirmed
            </option>

            <option value="draft">
              Draft
            </option>

            <option value="quotation">
              Quotation
            </option>

            <option value="shipped">
              Shipped
            </option>

            <option value="partially_returned">
              Partially returned
            </option>

            <option value="returned">
              Returned
            </option>
          </select>

          <select
            value={paymentStatusFilter}
            onChange={(e) =>
              setPaymentStatusFilter(
                e.target.value
              )
            }
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border:
                '1px solid var(--navy-border)',
            }}
          >
            <option value="all">
              All payment statuses
            </option>

            <option value="paid">
              Paid
            </option>

            <option value="due">
              Due
            </option>
          </select>

          {isOwner && (
            <select
              value={locationFilter}
              onChange={(e) =>
                setLocationFilter(e.target.value)
              }
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

              {locationOptions.map((l) => (
                <option
                  key={l.id}
                  value={l.id}
                >
                  {l.name}
                </option>
              ))}
            </select>
          )}

          <select
            value={customerFilter}
            onChange={(e) =>
              setCustomerFilter(e.target.value)
            }
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border:
                '1px solid var(--navy-border)',
            }}
          >
            <option value="">
              All customers
            </option>

            {customerOptions.map((customer) => (
              <option
                key={customer.id}
                value={customer.id}
              >
                {customer.name}
              </option>
            ))}
          </select>

          <select
            value={paymentMethodFilter}
            onChange={(e) =>
              setPaymentMethodFilter(e.target.value)
            }
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border:
                '1px solid var(--navy-border)',
            }}
          >
            <option value="all">
              All payment methods
            </option>

            {paymentMethodOptions.map((method) => (
              <option
                key={method}
                value={method}
              >
                {method.replace('_', ' ')}
              </option>
            ))}
          </select>

          <select
            value={addedByFilter}
            onChange={(e) =>
              setAddedByFilter(e.target.value)
            }
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border:
                '1px solid var(--navy-border)',
            }}
          >
            <option value="">
              All users
            </option>

            {addedByOptions.map((user) => (
              <option
                key={user.id}
                value={user.id}
              >
                {user.name}
              </option>
            ))}
          </select>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th></th>
              <SortableHeader label="Invoice #" sortKey="id" currentSortKey={sort.sortKey} sortDirection={sort.sortDirection} toggleSortKey={sort.toggleSortKey} />
              <th>Actions</th>
              <SortableHeader label="Total Amount" sortKey="grand_total" currentSortKey={sort.sortKey} sortDirection={sort.sortDirection} toggleSortKey={sort.toggleSortKey} />
              <SortableHeader label="Total Items" sortKey="total_items" currentSortKey={sort.sortKey} sortDirection={sort.sortDirection} toggleSortKey={sort.toggleSortKey} />
              <SortableHeader label="Status" sortKey="status" currentSortKey={sort.sortKey} sortDirection={sort.sortDirection} toggleSortKey={sort.toggleSortKey} />
              <SortableHeader label="Location" sortKey="location" currentSortKey={sort.sortKey} sortDirection={sort.sortDirection} toggleSortKey={sort.toggleSortKey} />
              <SortableHeader label="Time" sortKey="created_at" currentSortKey={sort.sortKey} sortDirection={sort.sortDirection} toggleSortKey={sort.toggleSortKey} />
              <SortableHeader label="Customer" sortKey="customer" currentSortKey={sort.sortKey} sortDirection={sort.sortDirection} toggleSortKey={sort.toggleSortKey} />
              <SortableHeader label="Customer Number" sortKey="customer_number" currentSortKey={sort.sortKey} sortDirection={sort.sortDirection} toggleSortKey={sort.toggleSortKey} />
              <SortableHeader label="Payment Method" sortKey="payment_method" currentSortKey={sort.sortKey} sortDirection={sort.sortDirection} toggleSortKey={sort.toggleSortKey} />
              <SortableHeader label="Paid Amount" sortKey="paid_amount" currentSortKey={sort.sortKey} sortDirection={sort.sortDirection} toggleSortKey={sort.toggleSortKey} />
              <SortableHeader label="Due Amount" sortKey="due_amount" currentSortKey={sort.sortKey} sortDirection={sort.sortDirection} toggleSortKey={sort.toggleSortKey} />
              <SortableHeader label="Payment Status" sortKey="payment_status" currentSortKey={sort.sortKey} sortDirection={sort.sortDirection} toggleSortKey={sort.toggleSortKey} />
              <SortableHeader label="Added By" sortKey="added_by" currentSortKey={sort.sortKey} sortDirection={sort.sortDirection} toggleSortKey={sort.toggleSortKey} />
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={15}
                  className="muted table-empty"
                >
                  Loading…
                </td>
              </tr>
            )}

            {!loading &&
              rows.length === 0 && (
                <tr>
                  <td
                    colSpan={15}
                    className="muted table-empty"
                  >
                    No sales yet.
                  </td>
                </tr>
              )}

            {!loading &&
              rows.length > 0 &&
              filteredRows.length === 0 && (
                <tr>
                  <td
                    colSpan={15}
                    className="muted table-empty"
                  >
                    No sales match your search or filters.
                  </td>
                </tr>
              )}

            {!loading &&
              paginatedRows.map((s) => {
                const paymentStatus =
                  Number(s.due_amount || 0) > 0
                    ? 'due'
                    : 'paid';

                return (
                  <Fragment key={s.id}>
                    <tr
                      onClick={() => toggleExpand(s.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        {expanded === s.id ? '▾' : '▸'}
                      </td>
                      <td>
                        #{s.id}
                      </td>
                      <td
                        className="table-actions"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div
                          style={{
                            display: 'flex',
                            gap: 4,
                            justifyContent: 'flex-start',
                            flexWrap: 'nowrap',
                          }}
                        >
                          {canEdit && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '4px 8px', fontSize: '11px' }}
                              onClick={() => navigate(`/sales/new?edit=${s.id}`)}
                            >
                              Edit
                            </button>
                          )}
                          {canReturn && RETURNABLE_STATUSES.includes(s.status) && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '4px 8px', fontSize: '11px' }}
                              disabled={busyId === s.id}
                              onClick={() => openReturn(s)}
                            >
                              {busyId === s.id ? '...' : 'Return'}
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                            disabled={busyId === `print-${s.id}`}
                            onClick={() => handlePrint(s)}
                          >
                            {busyId === `print-${s.id}` ? '...' : 'Receipt'}
                          </button>
                          {canEdit && (s.status === 'draft' || s.status === 'quotation') && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '4px 8px', fontSize: '11px' }}
                              disabled={busyId === s.id}
                              onClick={() => confirmSale(s)}
                            >
                              {busyId === s.id ? '...' : 'Confirm'}
                            </button>
                          )}
                        </div>
                      </td>
                      <td>
                        {business?.currency} {Number(s.grand_total || 0).toFixed(2)}
                      </td>
                      <td>
                        {itemTotals[s.id] || 0}
                      </td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[s.status] || 'badge-info'}`}>
                          {s.status ? s.status.replace('_', ' ') : '—'}
                        </span>
                      </td>
                      <td>
                        {locations[s.location_id] || '—'}
                      </td>
                      <td>
                        {s.created_at ? formatTimestamp(s.created_at, business?.time_zone) : '—'}
                      </td>
                      <td>
                        {customers[s.customer_id] || 'Walk-in'}
                      </td>
                      <td>
                        {s.customer_id ? customerNumbers[s.customer_id] || '—' : '—'}
                      </td>
                      <td>
                        {s.payment_method ? s.payment_method.replace('_', ' ') : '—'}
                      </td>
                      <td>
                        {business?.currency} {Number(s.paid_amount || 0).toFixed(2)}
                      </td>
                      <td>
                        {business?.currency} {Number(s.due_amount || 0).toFixed(2)}
                      </td>
                      <td>
                        <span className={`badge ${paymentStatus === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                          {paymentStatus}
                        </span>
                      </td>
                      <td>
                        {s.created_by ? users[s.created_by] || '—' : '—'}
                      </td>
                    </tr>

                    {expanded === s.id && (
                      <tr>
                        <td
                          colSpan={15}
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
                                <th>
                                  Product
                                </th>

                                <th>
                                  Qty
                                </th>

                                <th>
                                  Unit price
                                </th>

                                <th>
                                  Line total
                                </th>
                              </tr>
                            </thead>

                            <tbody>
                              {(
                                items[s.id] || []
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
                                      it.unit_price
                                    ).toFixed(
                                      2
                                    )}
                                  </td>

                                  <td>
                                    {
                                      business?.currency
                                    }{' '}
                                    {Number(
                                      it.line_total
                                    ).toFixed(
                                      2
                                    )}
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
              filteredRows.length > 0 && (
                <tr className="sales-summary-row">
                  <td colSpan={3}>
                    <strong>Total</strong>
                  </td>
                  <td>
                    <strong>
                      {business?.currency}{' '}
                      {summaryTotals.total.toFixed(2)}
                    </strong>
                  </td>
                  <td>
                    <strong>{summaryTotals.items}</strong>
                  </td>
                  <td colSpan={6}></td>
                  <td>
                    <strong>
                      {business?.currency}{' '}
                      {summaryTotals.paid.toFixed(2)}
                    </strong>
                  </td>
                  <td>
                    <strong>
                      {business?.currency}{' '}
                      {summaryTotals.due.toFixed(2)}
                    </strong>
                  </td>
                  <td colSpan={2}></td>
                </tr>
              )}
          </tbody>
        </table>

        {!loading &&
          totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 6,
                padding: '16px 0',
                flexWrap: 'wrap',
              }}
            >
              <button
                className="btn btn-secondary btn-sm"
                disabled={currentPage === 1}
                onClick={() =>
                  setCurrentPage(
                    (page) => page - 1
                  )
                }
              >
                Previous
              </button>

              {Array.from(
                {
                  length: totalPages,
                },
                (_, index) => index + 1
              ).map((page) => (
                <button
                  key={page}
                  className={
                    page === currentPage
                      ? 'btn btn-primary btn-sm'
                      : 'btn btn-secondary btn-sm'
                  }
                  onClick={() =>
                    setCurrentPage(page)
                  }
                >
                  {page}
                </button>
              ))}

              <button
                className="btn btn-secondary btn-sm"
                disabled={
                  currentPage === totalPages
                }
                onClick={() =>
                  setCurrentPage(
                    (page) => page + 1
                  )
                }
              >
                Next
              </button>
            </div>
          )}
      </div>

      {returnModal && (
        <div onClick={closeReturn} style={{ position: 'fixed', inset: 0, background: 'rgba(19, 26, 51, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--white)', borderRadius: 'var(--radius-lg)', padding: '24px 26px', width: '100%', maxWidth: 760, boxShadow: 'var(--shadow-lg)', maxHeight: '85vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 17, marginBottom: 4 }}>Return items — Sale #{returnModal.id}</h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 14 }}>
              {customers[returnModal.customer_id] || 'Walk-in'} · {locations[returnModal.location_id] || '—'}
            </p>
            {returnLoading ? <div className="muted">Loading items…</div> : (
              <form onSubmit={submitReturn}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                  <div className="field"><label>Return date</label><input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} /></div>
                  <div className="field"><label>Reason</label><input value={returnReason} onChange={(e) => setReturnReason(e.target.value)} placeholder="Damaged, wrong item, etc." /></div>
                </div>
                <table className="data-table">
                  <thead><tr><th>Product</th><th>Sold</th><th>Already returned</th><th>Remaining</th><th>Return qty</th><th>Amount</th></tr></thead>
                  <tbody>{returnRows.map((r) => (
                    <tr key={r.item.id}>
                      <td>{r.item.products?.name || '—'}</td><td>{r.soldQty}</td><td>{r.returned}</td><td>{r.remaining}</td>
                      <td><input type="number" min="0" max={r.remaining} step="1" inputMode="numeric" className="line-input line-input-sm" value={returnQtyMap[r.item.id] || ''} onChange={(e) => setReturnQty(r.item.id, e.target.value, r.remaining)} onKeyDown={(e) => { if (['.', '-', '+', 'e', 'E'].includes(e.key)) e.preventDefault(); }} onPaste={(e) => { if (!/^\d+$/.test(e.clipboardData.getData('text'))) e.preventDefault(); }} disabled={r.remaining <= 0} /></td>
                      <td>{business?.currency} {r.amount.toFixed(2)}</td>
                    </tr>
                  ))}</tbody>
                </table>
                <div className="totals-summary"><div className="totals-grand"><span>Total return amount</span><span>{business?.currency} {returnTotal.toFixed(2)}</span></div></div>
                {returnError && <div className="error-text" style={{ marginTop: 10 }}>{returnError}</div>}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                  <button type="button" className="btn btn-secondary" onClick={closeReturn} disabled={returnSubmitting}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={returnSubmitting}>{returnSubmitting ? 'Saving…' : 'Confirm return'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}