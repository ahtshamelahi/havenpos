import { useEffect, useMemo, useState } from 'react';
import AppLayout from '../components/AppLayout.jsx';
import ReportFilters from '../components/ReportFilters.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';
import { fetchAllBatched } from '../lib/fetchUtils.js';
import { getPresetRange } from '../lib/dateRanges.js';
import PrintReportHeader from '../components/PrintReportHeader.jsx';

export default function PurchasesReport() {
  const { business } = useAuth();
  const [range, setRange] = useState(getPresetRange('this_month', business?.time_zone));
  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState('');
  const [statusFilter, setStatusFilter] = useState('received');
  const [purchases, setPurchases] = useState([]);
  const [purchaseItems, setPurchaseItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!business?.id) return;
    supabase.from('locations').select('id, name').eq('business_id', business.id).then(({ data }) => setLocations(data || []));
  }, [business?.id]);

  useEffect(() => {
    if (!business?.id) return;
    setLoading(true);
    const buildQuery = () => {
      let query = supabase.from('purchases').select('*').eq('business_id', business.id).eq('is_active', true);
      if (range.from) query = query.gte('purchase_date', range.from);
      if (range.to) query = query.lte('purchase_date', range.to);
      if (locationId) query = query.eq('location_id', Number(locationId));
      if (statusFilter !== 'all') query = query.eq('purchase_status', statusFilter);
      return query;
    };

    fetchAllBatched(buildQuery).then(async ({ data: purchaseRows }) => {
      setPurchases(purchaseRows || []);
      const ids = (purchaseRows || []).map((p) => p.id);
      if (ids.length > 0) {
        const { data: itemRows } = await fetchAllBatched(() =>
          supabase.from('purchase_items').select('*, products(name)').in('purchase_id', ids)
        );
        setPurchaseItems(itemRows || []);
      } else {
        setPurchaseItems([]);
      }
      setLoading(false);
    });
  }, [business?.id, range, locationId, statusFilter]);

  const summary = useMemo(() => {
    const spend = purchases.reduce((s, r) => s + Number(r.grand_total), 0);
    const tax = purchases.reduce((s, r) => s + Number(r.tax_amount), 0);
    const orders = purchases.length;
    return { spend, tax, orders, avg: orders > 0 ? spend / orders : 0 };
  }, [purchases]);

  const byDay = useMemo(() => {
    const map = {};
    purchases.forEach((p) => {
      if (!map[p.purchase_date]) map[p.purchase_date] = { date: p.purchase_date, orders: 0, spend: 0 };
      map[p.purchase_date].orders += 1;
      map[p.purchase_date].spend += Number(p.grand_total);
    });
    return Object.values(map).sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [purchases]);

  const topProducts = useMemo(() => {
    const map = {};
    purchaseItems.forEach((it) => {
      const key = it.product_id;
      if (!map[key]) map[key] = { name: it.products?.name || 'Unknown', qty: 0, spend: 0 };
      map[key].qty += Number(it.quantity);
      map[key].spend += Number(it.line_total);
    });
    return Object.values(map).sort((a, b) => b.spend - a.spend).slice(0, 10);
  }, [purchaseItems]);

  return (
    <AppLayout>
      <ReportFilters from={range.from} to={range.to} onChange={setRange} locations={locations} locationId={locationId} onLocationChange={setLocationId} tz={business?.time_zone} />
      <div className="card no-print" style={{ padding: 14, marginBottom: 16, marginTop: -8 }}>
        <div className="list-tabs">
          {['received', 'draft', 'cancelled', 'all'].map((s) => (
            <button key={s} className={`list-tab ${statusFilter === s ? 'list-tab-active' : ''}`} onClick={() => setStatusFilter(s)} style={{ textTransform: 'capitalize' }}>{s}</button>
          ))}
        </div>
      </div>

      <PrintReportHeader
        title="Purchases Report"
        filters={[
          { label: 'Status', value: statusFilter },
          { label: 'Period', value: `${range.from || 'Start'} to ${range.to || 'End'}` },
          { label: 'Location', value: locations.find(l => String(l.id) === String(locationId))?.name || 'All Locations' },
        ]}
      />

      <div className="summary-grid">
        <div className="summary-card"><div className="summary-card-label">Total spend</div><div className="summary-card-value">{business?.currency} {summary.spend.toFixed(2)}</div></div>
        <div className="summary-card summary-card-info"><div className="summary-card-label">Purchase orders</div><div className="summary-card-value">{summary.orders}</div></div>
        <div className="summary-card summary-card-info"><div className="summary-card-label">Avg order value</div><div className="summary-card-value">{business?.currency} {summary.avg.toFixed(2)}</div></div>
        <div className="summary-card summary-card-warning"><div className="summary-card-label">Tax paid</div><div className="summary-card-value">{business?.currency} {summary.tax.toFixed(2)}</div></div>
      </div>

      <div className="dash-grid" style={{ gridTemplateColumns: '1.2fr 1fr', marginTop: 16 }}>
        <section className="card dash-panel">
          <div className="dash-panel-header"><h2>Spend by day</h2></div>
          {loading ? <div className="muted dash-empty">Loading…</div> : byDay.length === 0 ? <div className="muted dash-empty">No purchases in this period.</div> : (
            <table className="data-table"><thead><tr><th>Date</th><th>Orders</th><th>Spend</th></tr></thead>
              <tbody>{byDay.map((d) => (<tr key={d.date}><td>{d.date}</td><td>{d.orders}</td><td>{business?.currency} {d.spend.toFixed(2)}</td></tr>))}</tbody>
            </table>
          )}
        </section>
        <section className="card dash-panel">
          <div className="dash-panel-header"><h2>Top products purchased</h2></div>
          {loading ? <div className="muted dash-empty">Loading…</div> : topProducts.length === 0 ? <div className="muted dash-empty">No items purchased in this period.</div> : (
            <table className="data-table"><thead><tr><th>Product</th><th>Qty</th><th>Spend</th></tr></thead>
              <tbody>{topProducts.map((p) => (<tr key={p.name}><td>{p.name}</td><td>{p.qty}</td><td>{business?.currency} {p.spend.toFixed(2)}</td></tr>))}</tbody>
            </table>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
