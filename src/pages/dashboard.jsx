import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import AppLayout from '../components/AppLayout.jsx';
import Pagination from '../components/Pagination.jsx';
import usePagination from '../hooks/usePagination.js';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';
import { fetchAllBatched } from '../lib/fetchUtils.js';
import {
  getPresetRange,
  DASHBOARD_PRESETS,
} from '../lib/dateRanges.js';
import './dashboard.css';
import useLocationScope from '../hooks/useLocationScope.js';

const CARD_DEFS = [
  {
    key: 'totalSales',
    label: 'Total Sales',
    accent: 'navy',
  },
  {
    key: 'net',
    label: 'Net',
    accent: 'success',
  },
  {
    key: 'invoiceDue',
    label: 'Invoice Due',
    accent: 'warning',
  },
  {
    key: 'totalSalesReturn',
    label: 'Total Sales Return',
    accent: 'danger',
  },
  {
    key: 'totalPurchase',
    label: 'Total Purchase',
    accent: 'info',
  },
  {
    key: 'purchaseDue',
    label: 'Purchase Due',
    accent: 'warning',
  },
  {
    key: 'totalPurchaseReturn',
    label: 'Total Purchase Return',
    accent: 'danger',
  },
  {
    key: 'totalExpense',
    label: 'Expense',
    accent: 'info',
  },
];

const ITEMS_PER_PAGE = 10;

export default function Dashboard() {
  const { business, profile } = useAuth();
  const { isOwner, isScopedToLocation, scopedLocationIds } = useLocationScope();
  const navigate = useNavigate();

  const [locationFilter, setLocationFilter] = useState('');
  const [locationsList, setLocationsList] = useState([]);

  const [preset, setPreset] = useState('today');
  const [range, setRange] = useState(
    getPresetRange('today', business?.time_zone)
  );
  const [cardsLoading, setCardsLoading] =
    useState(true);

  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [sellReturns, setSellReturns] =
    useState([]);
  const [purchaseReturns, setPurchaseReturns] =
    useState([]);
  const [expenses, setExpenses] = useState([]);

  // Sections below the cards are intentionally NOT date-filtered.
  const [sectionsLoading, setSectionsLoading] =
    useState(true);
  const [salesDue, setSalesDue] = useState([]);
  const [purchasesDue, setPurchasesDue] =
    useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [shipments, setShipments] = useState([]);

  // ---------- Sales Graph State ----------
  const [graphFilter, setGraphFilter] =
    useState('last30');

  const [graphMonth, setGraphMonth] =
    useState(() => {
      const d = new Date();

      return `${d.getFullYear()}-${String(
        d.getMonth() + 1
      ).padStart(2, '0')}`;
    });

  const [graphYear, setGraphYear] =
    useState(() => new Date().getFullYear());

  const [graphData, setGraphData] = useState([]);
  const [graphLoading, setGraphLoading] =
    useState(false);

  // ---------- Pagination ----------
  const salesDuePagination = usePagination(
    salesDue,
    ITEMS_PER_PAGE
  );

  const purchasesDuePagination = usePagination(
    purchasesDue,
    ITEMS_PER_PAGE
  );

  const lowStockPagination = usePagination(
    lowStock,
    ITEMS_PER_PAGE
  );

  const shipmentsPagination = usePagination(
    shipments,
    ITEMS_PER_PAGE
  );

  const toLocalISODate = (date) => {
    const y = date.getFullYear();

    const m = String(
      date.getMonth() + 1
    ).padStart(2, '0');

    const d = String(
      date.getDate()
    ).padStart(2, '0');

    return `${y}-${m}-${d}`;
  };

  const handlePresetChange = (e) => {
    const key = e.target.value;

    setPreset(key);

    if (key !== 'custom') {
      setRange(getPresetRange(key, business?.time_zone));
    }
  };

  const handleCustomDate = (field) => (e) => {
    setPreset('custom');

    setRange((r) => ({
      ...r,
      [field]: e.target.value,
    }));
  };

  useEffect(() => {
    if (!business?.id) return;
    supabase
      .from('locations')
      .select('id, name')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .then(({ data }) => setLocationsList(data || []));
  }, [business?.id]);
  useEffect(() => {
    if (!business?.id) return;

    let cancelled = false;

    async function load() {
      setCardsLoading(true);

      const withScope = (
        query,
        column,
        locationCol = 'location_id'
      ) => {
        let q = query;

        if (range.from) {
          q = q.gte(column, range.from);
        }

        if (range.to) {
          q = q.lte(column, range.to);
        }

        if (isScopedToLocation && scopedLocationIds.length > 0) {
          q = q.in(locationCol, scopedLocationIds);
        } else if (!isScopedToLocation && locationFilter) {
          q = q.eq(locationCol, Number(locationFilter));
        }

        return q;
      };

      const [
        salesRes,
        purchasesRes,
        sellReturnsRes,
        purchaseReturnsRes,
        expensesRes,
      ] = await Promise.all([
        fetchAllBatched(() =>
          withScope(
            supabase
              .from('sales')
              .select('grand_total, due_amount')
              .eq('business_id', business.id)
              .in('status', ['confirmed', 'shipped', 'returned', 'partially_returned'])
              .eq('is_active', true),
            'sale_date'
          )
        ),

        fetchAllBatched(() =>
          withScope(
            supabase
              .from('purchases')
              .select('grand_total, advance_payment')
              .eq('business_id', business.id)
              .eq('purchase_status', 'received')
              .eq('is_active', true),
            'purchase_date'
          )
        ),

        fetchAllBatched(() => {
          let q = supabase
            .from('sell_returns')
            .select('total_amount, sales(location_id)')
            .eq('business_id', business.id);
          if (range.from) q = q.gte('return_date', range.from);
          if (range.to) q = q.lte('return_date', range.to);
          return fetchAllBatched(() => q).then((res) => ({
            data: (res.data || []).filter((sr) => {
              if (isScopedToLocation) {
                if (scopedLocationIds.length === 0) return false;
                return scopedLocationIds.includes(sr.sales?.location_id);
              }
              if (locationFilter) return String(sr.sales?.location_id) === String(locationFilter);
              return true;
            })
          }));
        }),

        fetchAllBatched(() => {
          let q = supabase
            .from('purchase_returns')
            .select('total_amount, purchases(location_id)')
            .eq('business_id', business.id);
          if (range.from) q = q.gte('return_date', range.from);
          if (range.to) q = q.lte('return_date', range.to);
          return fetchAllBatched(() => q).then((res) => ({
            data: (res.data || []).filter((pr) => {
              if (isScopedToLocation) {
                if (scopedLocationIds.length === 0) return false;
                return scopedLocationIds.includes(pr.purchases?.location_id);
              }
              if (locationFilter) return String(pr.purchases?.location_id) === String(locationFilter);
              return true;
            })
          }));
        }),

        fetchAllBatched(() =>
          withScope(
            supabase
              .from('expenses')
              .select('amount')
              .eq('business_id', business.id),
            'expense_date'
          )
        ),
      ]);

      if (cancelled) return;

      setSales(salesRes.data || []);
      setPurchases(
        purchasesRes.data || []
      );
      setSellReturns(
        sellReturnsRes.data || []
      );
      setPurchaseReturns(
        purchaseReturnsRes.data || []
      );
      setExpenses(
        expensesRes.data || []
      );

      setCardsLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [business?.id, range, locationFilter]);

  // ---------- Sales Graph ----------
  useEffect(() => {
    if (!business?.id) return;

    let cancelled = false;

    async function loadGraph() {
      setGraphLoading(true);

      let start;
      let end;

      if (graphFilter === 'last30') {
        end = new Date();
        start = new Date();

        start.setDate(
          end.getDate() - 29
        );
      } else if (graphFilter === 'month') {
        const [
          y,
          m,
        ] = graphMonth
          .split('-')
          .map(Number);

        start = new Date(
          y,
          m - 1,
          1
        );

        end = new Date(
          y,
          m,
          0
        );
      } else if (graphFilter === 'year') {
        start = new Date(
          graphYear,
          0,
          1
        );

        end = new Date(
          graphYear,
          11,
          31
        );
      }

      const startStr =
        toLocalISODate(start);

      const endStr =
        toLocalISODate(end);

      const { data } = await fetchAllBatched(() => {
        let q = supabase
          .from('sales')
          .select('sale_date, grand_total')
          .eq('business_id', business.id)
          .eq('status', 'confirmed')
          .eq('is_active', true)
          .gte('sale_date', startStr)
          .lte('sale_date', endStr);

        if (isScopedToLocation && scopedLocationIds.length > 0) {
          q = q.in('location_id', scopedLocationIds);
        } else if (!isScopedToLocation && locationFilter) {
          q = q.eq('location_id', Number(locationFilter));
        }

        return q;
      });

      if (cancelled) return;

      const agg = new Map();

      if (graphFilter === 'year') {
        const months = [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ];

        months.forEach((m) => {
          agg.set(m, 0);
        });

        (data || []).forEach((r) => {
          const monthIdx =
            parseInt(
              r.sale_date.split('-')[1],
              10
            ) - 1;

          const key =
            months[monthIdx];

          agg.set(
            key,
            agg.get(key) +
            Number(r.grand_total)
          );
        });

        setGraphData(
          months.map((m) => ({
            label: m,
            value: Number(
              agg
                .get(m)
                .toFixed(2)
            ),
          }))
        );
      } else {
        const dates = [];

        const cur = new Date(start);

        while (cur <= end) {
          dates.push(
            toLocalISODate(cur)
          );

          cur.setDate(
            cur.getDate() + 1
          );
        }

        dates.forEach((d) => {
          agg.set(d, 0);
        });

        (data || []).forEach((r) => {
          agg.set(
            r.sale_date,
            (agg.get(
              r.sale_date
            ) || 0) +
            Number(
              r.grand_total
            )
          );
        });

        setGraphData(
          dates.map((d) => {
            const [
              y,
              m,
              day,
            ] = d
              .split('-')
              .map(Number);

            const dateObj =
              new Date(
                y,
                m - 1,
                day
              );

            return {
              label:
                dateObj.toLocaleDateString(
                  'en-US',
                  {
                    month: 'short',
                    day: 'numeric',
                  }
                ),

              value: Number(
                (
                  agg.get(d) ||
                  0
                ).toFixed(2)
              ),
            };
          })
        );
      }

      setGraphLoading(false);
    }

    loadGraph();

    return () => {
      cancelled = true;
    };
  }, [
    business?.id,
    graphFilter,
    graphMonth,
    graphYear,
    locationFilter,
  ]);

  // ---------- Live Sections ----------
  useEffect(() => {
    if (!business?.id) return;

    let cancelled = false;

    async function load() {
      setSectionsLoading(true);

      const [
        salesDueRes,
        purchasesRes,
        productsRes,
        stockRes,
        locationsRes,
        categoriesRes,
        shipmentsRes,
      ] = await Promise.all([
        fetchAllBatched(() =>
          supabase
            .from('sales')
            .select('id, sale_date, due_amount, grand_total, paid_amount, location_id, contacts(name)')
            .eq('business_id', business.id)
            .in('status', ['confirmed', 'shipped', 'returned', 'partially_returned'])
            .eq('is_active', true)
            .gt('due_amount', 0)
            .order('due_amount', { ascending: false })
        ),

        fetchAllBatched(() =>
          supabase
            .from('purchases')
            .select('id, purchase_date, grand_total, advance_payment, location_id, contacts(name)')
            .eq('business_id', business.id)
            .eq('purchase_status', 'received')
            .eq('is_active', true)
            .order('purchase_date', { ascending: false })
        ),

        fetchAllBatched(() =>
          supabase
            .from('products')
            .select('id, name, sku, category_id, alert_quantity')
            .eq('business_id', business.id)
            .eq('is_active', true)
            .not('alert_quantity', 'is', null)
        ),

        fetchAllBatched(() =>
          supabase
            .from('stock_ledger')
            .select('product_id, location_id, change_qty')
            .eq('business_id', business.id)
        ),

        supabase
          .from('locations')
          .select('id, name')
          .eq('business_id', business.id),

        supabase
          .from('categories')
          .select('id, name')
          .eq('business_id', business.id),

        fetchAllBatched(() =>
          supabase
            .from('shipments')
            .select('id, shipment_status, shipped_date, created_at, sale_id, sales(sale_date, location_id, contacts(name))')
            .neq('shipment_status', 'delivered')
            .order('created_at', { ascending: false })
        ),
      ]);

      if (cancelled) return;

      const locationNames =
        Object.fromEntries(
          (
            locationsRes.data ||
            []
          ).map((l) => [
            l.id,
            l.name,
          ])
        );

      const categoryNames =
        Object.fromEntries(
          (
            categoriesRes.data ||
            []
          ).map((c) => [
            c.id,
            c.name,
          ])
        );

      setSalesDue(
        (
          salesDueRes.data ||
          []
        ).map((s) => ({
          ...s,
          locationName:
            locationNames[
            s.location_id
            ],
        }))
      );

      const duePurchases =
        (
          purchasesRes.data ||
          []
        )
          .map((p) => ({
            ...p,

            due:
              Number(
                p.grand_total
              ) -
              Number(
                p.advance_payment
              ),

            locationName:
              locationNames[
              p.location_id
              ],
          }))
          .filter(
            (p) => p.due > 0
          )
          .sort(
            (a, b) =>
              b.due - a.due
          );

      setPurchasesDue(
        duePurchases
      );

      const onHand = {};

      (
        stockRes.data ||
        []
      ).forEach((row) => {
        const key = `${row.product_id}:${row.location_id}`;

        onHand[key] =
          (onHand[key] || 0) +
          Number(
            row.change_qty
          );
      });

      const low = [];

      (
        productsRes.data ||
        []
      ).forEach((p) => {
        Object.keys(
          locationNames
        ).forEach((locId) => {
          const key = `${p.id}:${locId}`;

          if (!(key in onHand)) {
            return;
          }

          const qty =
            onHand[key];

          if (
            qty <=
            Number(
              p.alert_quantity
            )
          ) {
            low.push({
              ...p,
              qty,
              locationName:
                locationNames[
                locId
                ],
              categoryName:
                categoryNames[
                p.category_id
                ],
            });
          }
        });
      });

      low.sort(
        (a, b) =>
          a.qty - b.qty
      );

      setLowStock(low);

      setShipments(
        (
          shipmentsRes.data ||
          []
        ).map((s) => ({
          ...s,

          customerName:
            s.sales?.contacts
              ?.name ||
            'Walk-in',

          locationName:
            locationNames[
            s.sales?.location_id
            ],
        }))
      );

      setSectionsLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [business?.id]);

  const figures = useMemo(() => {
    const totalSales =
      sales.reduce(
        (s, r) =>
          s +
          Number(
            r.grand_total
          ),
        0
      );

    const totalSalesReturn =
      sellReturns.reduce(
        (s, r) =>
          s +
          Number(
            r.total_amount
          ),
        0
      );

    const invoiceDue =
      sales.reduce(
        (s, r) =>
          s +
          Number(
            r.due_amount
          ),
        0
      );

    const totalPurchase =
      purchases.reduce(
        (s, r) =>
          s +
          Number(
            r.grand_total
          ),
        0
      );

    const totalPurchaseReturn =
      purchaseReturns.reduce(
        (s, r) =>
          s +
          Number(
            r.total_amount
          ),
        0
      );

    const purchaseDue =
      purchases.reduce(
        (s, r) =>
          s +
          Math.max(
            Number(
              r.grand_total
            ) -
            Number(
              r.advance_payment
            ),
            0
          ),
        0
      );

    const totalExpense =
      expenses.reduce(
        (s, r) =>
          s +
          Number(
            r.amount
          ),
        0
      );

    const net =
      totalSales -
      totalSalesReturn;

    return {
      totalSales,
      net,
      invoiceDue,
      totalSalesReturn,
      totalPurchase,
      purchaseDue,
      totalPurchaseReturn,
      totalExpense,
    };
  }, [
    sales,
    purchases,
    sellReturns,
    purchaseReturns,
    expenses,
  ]);

  const currency =
    business?.currency || '';

  const fmt = (n) =>
    `${currency} ${Number(n).toFixed(2)}`;

  return (
    <AppLayout>
      <div className="dash-filter-bar">
        <span className="dash-filter-label">
          Summary period
        </span>

        <select
          value={preset}
          onChange={
            handlePresetChange
          }
          className="dash-filter-select"
        >
          {DASHBOARD_PRESETS.map(
            (p) => (
              <option
                key={p.key}
                value={p.key}
              >
                {p.label}
              </option>
            )
          )}

          <option value="custom">
            Custom Range
          </option>
        </select>

        {preset === 'custom' && (
          <>
            <input
              type="date"
              value={range.from}
              onChange={handleCustomDate(
                'from'
              )}
              className="dash-filter-date"
            />

            <span className="muted">
              to
            </span>

            <input
              type="date"
              value={range.to}
              onChange={handleCustomDate(
                'to'
              )}
              className="dash-filter-date"
            />
          </>
        )}

        {isOwner && (
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="dash-filter-select"
          >
            <option value="">All Locations</option>
            {locationsList.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        )}

        <span className="muted dash-filter-note">
          {isOwner
            ? locationFilter
              ? `Filtered for ${locationsList.find((l) => String(l.id) === String(locationFilter))?.name || 'Location'}`
              : 'All Locations Summary'
            : 'My Location Summary'}
        </span>
      </div>

      <div className="dash-summary-grid">
        {CARD_DEFS.map((c) => (
          <div
            key={c.key}
            className={`dash-summary-card dash-summary-card-${c.accent}`}
          >

            <div>
              <div className="dash-summary-label">
                {c.label}
              </div>

              <div className="dash-summary-value">
                {cardsLoading
                  ? '—'
                  : fmt(
                    figures[
                    c.key
                    ]
                  )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ---------- Sales Overview Graph ---------- */}
      <section className="card dash-section dash-graph-section">
        <div className="dash-section-header graph-header">
          <div className="graph-filters">
            <select
              value={graphFilter}
              onChange={(e) =>
                setGraphFilter(
                  e.target.value
                )
              }
              className="dash-filter-select graph-filter-select"
            >
              <option value="last30">
                Last 30 Days
              </option>

              <option value="month">
                Specific Month
              </option>

              <option value="year">
                Whole Year
              </option>
            </select>

            {graphFilter ===
              'month' && (
                <input
                  type="month"
                  value={graphMonth}
                  onChange={(e) =>
                    setGraphMonth(
                      e.target.value
                    )
                  }
                  className="dash-filter-date graph-filter-date"
                />
              )}

            {graphFilter ===
              'year' && (
                <select
                  value={graphYear}
                  onChange={(e) =>
                    setGraphYear(
                      Number(
                        e.target.value
                      )
                    )
                  }
                  className="dash-filter-select graph-filter-select"
                >
                  {Array.from(
                    {
                      length: 11,
                    },
                    (_, i) =>
                      new Date().getFullYear() -
                      5 +
                      i
                  ).map((y) => (
                    <option
                      key={y}
                      value={y}
                    >
                      {y}
                    </option>
                  ))}
                </select>
              )}
          </div>

          <h2>
            Sales Overview
          </h2>
        </div>

        {graphLoading ? (
          <div className="muted dash-empty">
            Loading chart…
          </div>
        ) : graphData.length ===
          0 ||
          graphData.every(
            (d) => d.value === 0
          ) ? (
          <div className="muted dash-empty">
            No sales data for this period.
          </div>
        ) : (
          <div className="graph-chart-wrap">
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <BarChart
                data={graphData}
                margin={{
                  top: 10,
                  right: 10,
                  left: -10,
                  bottom: 0,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--border-light)"
                />

                <XAxis
                  dataKey="label"
                  tick={{
                    fontSize: 12,
                    fill: 'var(--text-muted)',
                  }}
                  tickLine={false}
                  axisLine={{
                    stroke:
                      'var(--border-light)',
                  }}
                  interval={
                    graphFilter ===
                      'year'
                      ? 0
                      : 'preserveStartEnd'
                  }
                />

                <YAxis
                  tick={{
                    fontSize: 12,
                    fill: 'var(--text-muted)',
                  }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) =>
                    v >= 1000
                      ? `${(
                        v / 1000
                      ).toFixed(
                        0
                      )}k`
                      : v
                  }
                  width={50}
                />

                <Tooltip
                  cursor={{
                    fill: 'rgba(0,0,0,0.04)',
                  }}
                  content={({
                    active,
                    payload,
                    label,
                  }) => {
                    if (
                      !active ||
                      !payload?.length
                    ) {
                      return null;
                    }

                    return (
                      <div className="graph-tooltip">
                        <div className="graph-tooltip-label">
                          {label}
                        </div>

                        <div className="graph-tooltip-value">
                          {fmt(
                            payload[0]
                              .value
                          )}
                        </div>
                      </div>
                    );
                  }}
                />

                <Bar
                  dataKey="value"
                  radius={[
                    4,
                    4,
                    0,
                    0,
                  ]}
                  maxBarSize={44}
                >
                  {graphData.map(
                    (_, i) => (
                      <Cell
                        key={`cell-${i}`}
                        fill="var(--navy-600)"
                      />
                    )
                  )}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* ---------- Sales Payment Due ---------- */}
      <section className="card dash-section">
        <div className="dash-section-header">
          <h2>
            Sales Payment Due
          </h2>

          <Link
            to="/sales/due"
            className="btn btn-ghost btn-sm"
          >
            View all
          </Link>
        </div>

        {sectionsLoading ? (
          <div className="muted dash-empty">
            Loading…
          </div>
        ) : salesDue.length ===
          0 ? (
          <div className="muted dash-empty">
            Nothing outstanding right now.
          </div>
        ) : (
          <>
            <div className="dashboard-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>
                      Invoice
                    </th>

                    <th>
                      Customer
                    </th>

                    <th>
                      Location
                    </th>

                    <th>
                      Date
                    </th>

                    <th>
                      Total
                    </th>

                    <th>
                      Paid
                    </th>

                    <th>
                      Due
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {salesDuePagination.paginatedItems.map(
                    (s) => (
                      <tr
                        key={s.id}
                      >
                        <td>
                          #{s.id}
                        </td>

                        <td>
                          {s.contacts
                            ?.name ||
                            'Walk-in'}
                        </td>

                        <td>
                          {s.locationName ||
                            '—'}
                        </td>

                        <td>
                          {s.sale_date}
                        </td>

                        <td>
                          {fmt(
                            Number(
                              s.grand_total
                            )
                          )}
                        </td>

                        <td>
                          {fmt(
                            Number(
                              s.paid_amount
                            )
                          )}
                        </td>

                        <td className="dash-due-cell">
                          {fmt(
                            Number(
                              s.due_amount
                            )
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              {...salesDuePagination}
            />
          </>
        )}
      </section>

      {/* ---------- Purchase Payment Due ---------- */}
      <section className="card dash-section">
        <div className="dash-section-header">
          <h2>
            Purchase Payment Due
          </h2>

          <Link
            to="/purchases/due"
            className="btn btn-ghost btn-sm"
          >
            View all
          </Link>
        </div>

        {sectionsLoading ? (
          <div className="muted dash-empty">
            Loading…
          </div>
        ) : purchasesDue.length ===
          0 ? (
          <div className="muted dash-empty">
            Nothing outstanding right now.
          </div>
        ) : (
          <>
            <div className="dashboard-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>
                      Purchase
                    </th>

                    <th>
                      Supplier
                    </th>

                    <th>
                      Location
                    </th>

                    <th>
                      Date
                    </th>

                    <th>
                      Total
                    </th>

                    <th>
                      Paid
                    </th>

                    <th>
                      Due
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {purchasesDuePagination.paginatedItems.map(
                    (p) => (
                      <tr
                        key={p.id}
                      >
                        <td>
                          #{p.id}
                        </td>

                        <td>
                          {p.contacts
                            ?.name ||
                            'Cash / unspecified'}
                        </td>

                        <td>
                          {p.locationName ||
                            '—'}
                        </td>

                        <td>
                          {p.purchase_date}
                        </td>

                        <td>
                          {fmt(
                            Number(
                              p.grand_total
                            )
                          )}
                        </td>

                        <td>
                          {fmt(
                            Number(
                              p.advance_payment
                            )
                          )}
                        </td>

                        <td className="dash-due-cell">
                          {fmt(
                            p.due
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              {...purchasesDuePagination}
            />
          </>
        )}
      </section>

      {/* ---------- Low Stock Alerts ---------- */}
      <section className="card dash-section">
        <div className="dash-section-header">
          <h2>
            Low Stock Alerts
          </h2>

          <Link
            to="/stock"
            className="btn btn-ghost btn-sm"
          >
            View all
          </Link>
        </div>

        {sectionsLoading ? (
          <div className="muted dash-empty">
            Loading…
          </div>
        ) : lowStock.length ===
          0 ? (
          <div className="muted dash-empty">
            All products are above their alert threshold.
          </div>
        ) : (
          <>
            <div className="dashboard-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>
                      Product
                    </th>

                    <th>
                      SKU
                    </th>

                    <th>
                      Category
                    </th>

                    <th>
                      Location
                    </th>

                    <th>
                      On Hand
                    </th>

                    <th>
                      Alert Qty
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {lowStockPagination.paginatedItems.map(
                    (p, i) => (
                      <tr
                        key={`${p.id}-${p.locationName}-${i}`}
                      >
                        <td>
                          {p.name}
                        </td>

                        <td>
                          {p.sku}
                        </td>

                        <td>
                          {p.categoryName ||
                            '—'}
                        </td>

                        <td>
                          {p.locationName ||
                            '—'}
                        </td>

                        <td className="dash-due-cell">
                          {p.qty}
                        </td>

                        <td>
                          {p.alert_quantity}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              {...lowStockPagination}
            />
          </>
        )}
      </section>

      {/* ---------- Pending Shipments ---------- */}
      <section className="card dash-section">
        <div className="dash-section-header">
          <h2>
            Pending Shipments
          </h2>

          <button
            className="btn btn-ghost btn-sm"
            onClick={() =>
              navigate('/shipments')
            }
          >
            View all
          </button>
        </div>

        {sectionsLoading ? (
          <div className="muted dash-empty">
            Loading…
          </div>
        ) : shipments.length ===
          0 ? (
          <div className="muted dash-empty">
            Nothing pending — nice work.
          </div>
        ) : (
          <>
            <div className="dashboard-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>
                      Sale
                    </th>

                    <th>
                      Customer
                    </th>

                    <th>
                      Location
                    </th>

                    <th>
                      Status
                    </th>

                    <th>
                      Shipped Date
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {shipmentsPagination.paginatedItems.map(
                    (s) => (
                      <tr
                        key={s.id}
                      >
                        <td>
                          #{s.sale_id}
                        </td>

                        <td>
                          {s.customerName}
                        </td>

                        <td>
                          {s.locationName ||
                            '—'}
                        </td>

                        <td>
                          <span className="badge badge-warning">
                            {
                              s.shipment_status
                            }
                          </span>
                        </td>

                        <td>
                          {s.shipped_date ||
                            '—'}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              {...shipmentsPagination}
            />
          </>
        )}
      </section>
    </AppLayout>
  );
}