import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';
import { todayLocal } from '../lib/timezone.js';
import { fetchAllBatched } from '../lib/fetchUtils.js';
import './userForm.css';

export default function SellReturnForm({
  embedded = false,
  initialSaleId = '',
  onSuccess,
}) {
  const navigate = useNavigate();
  const { business, profile } = useAuth();

  const [sales, setSales] = useState([]);
  const [saleId, setSaleId] = useState(
    initialSaleId ? String(initialSaleId) : ''
  );

  const [saleSearch, setSaleSearch] = useState('');

  const [saleItems, setSaleItems] = useState([]);
  const [alreadyReturned, setAlreadyReturned] = useState({});
  const [returnQty, setReturnQty] = useState({});
  const [returnDate, setReturnDate] = useState(
    todayLocal(business?.time_zone)
  );
  const [reason, setReason] = useState('');
  const [loadingItems, setLoadingItems] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialSaleId) {
      setSaleId(String(initialSaleId));
    }
  }, [initialSaleId]);

  useEffect(() => {
    if (!business?.id) return;


    fetchAllBatched(() =>
      supabase
        .from('sales')
        .select(
          'id, sale_date, customer_id, location_id, contacts(name)'
        )
        .eq('business_id', business.id)
        .eq('status', 'confirmed')
        .order('sale_date', { ascending: false })
    ).then(({ data, error }) => {
      if (error) {
        console.error('Error loading sales:', error);
        return;
      }

      setSales(data || []);
    });

  }, [business?.id]);

  useEffect(() => {
    if (!saleId) {
      setSaleItems([]);
      setAlreadyReturned({});
      return;
    }


    setLoadingItems(true);

    supabase
      .from('sale_items')
      .select('*, products(name)')
      .eq('sale_id', saleId)
      .then(async ({ data, error }) => {
        if (error) {
          console.error('Error loading sale items:', error);
          setSaleItems([]);
          setLoadingItems(false);
          return;
        }

        const items = data || [];

        setSaleItems(items);

        const itemIds = items.map((item) => item.id);
        const returned = {};

        if (itemIds.length > 0) {
          const { data: priorReturns, error: returnError } =
            await supabase
              .from('sell_return_items')
              .select('sale_item_id, quantity_returned')
              .in('sale_item_id', itemIds);

          if (returnError) {
            console.error(
              'Error loading previous returns:',
              returnError
            );
          }

          (priorReturns || []).forEach((returnItem) => {
            returned[returnItem.sale_item_id] =
              (returned[returnItem.sale_item_id] || 0) +
              Number(returnItem.quantity_returned);
          });
        }

        setAlreadyReturned(returned);
        setReturnQty({});
        setLoadingItems(false);
      });

  }, [saleId]);

  const selectedSale = sales.find(
    (sale) => sale.id === Number(saleId)
  );

  const filteredSales = useMemo(() => {
    const search = saleSearch.trim().toLowerCase();


    if (!search) {
      return sales;
    }

    return sales.filter((sale) => {
      const invoiceNumber = String(sale.id);
      const customerName = sale.contacts?.name || 'Walk-in';
      const saleDate = sale.sale_date || '';

      return (
        invoiceNumber.includes(search) ||
        customerName.toLowerCase().includes(search) ||
        saleDate.toLowerCase().includes(search)
      );
    });


  }, [sales, saleSearch]);

  const rows = useMemo(
    () =>
      saleItems.map((item) => {
        const soldQty = Number(item.quantity);
        const returned = alreadyReturned[item.id] || 0;
        const remaining = soldQty - returned;


        const unitEffective =
          soldQty > 0
            ? Number(item.line_total) / soldQty
            : 0;

        const qty = Number(returnQty[item.id] || 0);
        const amount = qty * unitEffective;

        return {
          item,
          soldQty,
          returned,
          remaining,
          unitEffective,
          qty,
          amount,
        };
      }),
    [saleItems, alreadyReturned, returnQty]


  );

  const totalAmount = rows.reduce(
    (sum, row) => sum + row.amount,
    0
  );

  const setQty = (itemId, value) => {
    // Allow clearing the input
    if (value === '') {
      setReturnQty((prev) => ({
        ...prev,
        [itemId]: '',
      }));
      return;
    }


    // Only allow whole numbers
    if (!/^\d+$/.test(value)) {
      return;
    }

    const quantity = Number(value);

    // Only allow quantities greater than 0
    if (quantity <= 0) {
      return;
    }

    setReturnQty((prev) => ({
      ...prev,
      [itemId]: value,
    }));


  };

  const handleSubmit = async (e) => {
    e.preventDefault();


    setError('');

    const activeRows = rows.filter(
      (row) => Number(row.qty) > 0
    );

    if (!saleId) {
      setError('Select a sale.');
      return;
    }

    if (activeRows.length === 0) {
      setError(
        'Enter a whole-number return quantity greater than 0 for at least one item.'
      );
      return;
    }

    for (const row of activeRows) {
      const quantity = Number(row.qty);

      if (
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        setError(
          `Return quantity for ${row.item.products?.name} must be a whole number greater than 0.`
        );
        return;
      }

      if (quantity > row.remaining) {
        setError(
          `Return quantity for ${row.item.products?.name} exceeds what's left to return.`
        );
        return;
      }
    }

    setSubmitting(true);

    try {
      const { data: sellReturn, error: srErr } =
        await supabase
          .from('sell_returns')
          .insert({
            business_id: business.id,
            sale_id: saleId,
            return_date: returnDate,
            reason: reason || null,
            total_amount: totalAmount,
            created_by: profile.id,
          })
          .select()
          .single();

      if (srErr) throw srErr;

      const itemRows = activeRows.map((row) => ({
        sell_return_id: sellReturn.id,
        sale_item_id: row.item.id,
        quantity_returned: Number(row.qty),
        amount: row.amount,
      }));

      const { error: itemsErr } = await supabase
        .from('sell_return_items')
        .insert(itemRows);

      if (itemsErr) throw itemsErr;

      // Sell returns are restocked as sellable immediately.
      const stockRows = activeRows.map((row) => ({
        business_id: business.id,
        product_id: row.item.product_id,
        location_id: selectedSale.location_id,
        change_qty: Number(row.qty),
        reason: 'sell_return',
        reference_type: 'sell_return',
        reference_id: sellReturn.id,
        created_by: profile.id,
      }));

      const { error: stockErr } = await supabase
        .from('stock_ledger')
        .insert(stockRows);

      if (stockErr) throw stockErr;

      if (
        selectedSale.customer_id &&
        totalAmount !== 0
      ) {
        await supabase
          .from('contact_ledger')
          .insert({
            business_id: business.id,
            contact_id: selectedSale.customer_id,
            reference_type: 'sell_return',
            reference_id: sellReturn.id,
            amount: -totalAmount,
          });
      }

      if (embedded && onSuccess) {
        setSaleId('');
        setSaleSearch('');
        setReturnQty({});
        setReason('');
        onSuccess();
      } else {
        navigate('/sales/returns');
      }
    } catch (err) {
      setError(
        err.message || 'Could not save this return.'
      );
    } finally {
      setSubmitting(false);
    }


  };

  const form = (<form
    onSubmit={handleSubmit}
    className="user-form"
  > <section className="card form-section"> <h2>Return details</h2>


      <div className="form-grid">
        <div className="field">
          <label>Sale / Invoice # *</label>

          <input
            type="text"
            list="sales-invoice-list"
            value={
              saleId
                ? `#${saleId}`
                : saleSearch
            }
            onChange={(e) => {
              const value = e.target.value;

              const invoiceNumber = value.replace(
                /^#/,
                ''
              );

              const matchingSale = sales.find(
                (sale) =>
                  String(sale.id) ===
                  invoiceNumber
              );

              if (matchingSale) {
                setSaleId(
                  String(matchingSale.id)
                );
                setSaleSearch(
                  String(matchingSale.id)
                );
              } else {
                setSaleId('');
                setSaleSearch(invoiceNumber);
              }
            }}
            placeholder="Search or type invoice #"
            required
          />

          <datalist id="sales-invoice-list">
            {filteredSales.map((sale) => (
              <option
                key={sale.id}
                value={`#${sale.id}`}
              >
                {sale.sale_date} —{' '}
                {sale.contacts?.name ||
                  'Walk-in'}
              </option>
            ))}
          </datalist>

          {saleId && selectedSale && (
            <small className="muted">
              Invoice #{selectedSale.id} —{' '}
              {selectedSale.sale_date} —{' '}
              {selectedSale.contacts?.name ||
                'Walk-in'}
            </small>
          )}
        </div>

        <div className="field">
          <label>Return date</label>

          <input
            type="date"
            value={returnDate}
            onChange={(e) =>
              setReturnDate(e.target.value)
            }
          />
        </div>

        <div
          className="field"
          style={{
            gridColumn: '1 / -1',
          }}
        >
          <label>Reason</label>

          <input
            value={reason}
            onChange={(e) =>
              setReason(e.target.value)
            }
            placeholder="Damaged, wrong item, etc."
          />
        </div>
      </div>
    </section>

    {saleId && (
      <section className="card form-section">
        <h2>Items</h2>

        {loadingItems ? (
          <div className="muted">
            Loading items…
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Sold</th>
                <th>Already returned</th>
                <th>Remaining</th>
                <th>Return qty</th>
                <th>Amount</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={row.item.id}>
                  <td>
                    {row.item.products?.name}
                  </td>

                  <td>
                    {row.soldQty}
                  </td>

                  <td>
                    {row.returned}
                  </td>

                  <td>
                    {row.remaining}
                  </td>

                  <td>
                    <input
                      type="number"
                      min="1"
                      max={row.remaining}
                      step="1"
                      inputMode="numeric"
                      className="line-input line-input-sm"
                      value={
                        returnQty[row.item.id] ||
                        ''
                      }
                      onChange={(e) =>
                        setQty(
                          row.item.id,
                          e.target.value
                        )
                      }
                      disabled={
                        row.remaining <= 0
                      }
                    />
                  </td>

                  <td>
                    {business?.currency}{' '}
                    {row.amount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="totals-summary">
          <div className="totals-grand">
            <span>Total credit</span>

            <span>
              {business?.currency}{' '}
              {totalAmount.toFixed(2)}
            </span>
          </div>
        </div>
      </section>
    )}

    {error && (
      <div className="error-text">
        {error}
      </div>
    )}

    <div className="form-actions">
      {!embedded && (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() =>
            navigate('/sales/returns')
          }
        >
          Cancel
        </button>
      )}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={
          submitting || !saleId
        }
      >
        {submitting
          ? 'Saving…'
          : 'Save return'}
      </button>
    </div>
  </form>


  );

  if (embedded) {
    return (
      <div style={{ marginTop: 24 }}>
        <h2 style={{ marginBottom: 8 }}>
          New return </h2>


        <p
          className="muted"
          style={{ marginBottom: 16 }}
        >
          Restocks the items and credits the
          customer's balance.
        </p>

        {form}
      </div>
    );

  }

  return (<AppLayout> <div className="page-header"> <div> <h1>New sales return</h1>


    <p className="muted">
      Restocks the items and credits the
      customer's balance.
    </p>
  </div>

    <button
      className="btn btn-secondary"
      onClick={() =>
        navigate('/sales/returns')
      }
    >
      Cancel
    </button>
  </div>

    {form}
  </AppLayout>


  );
}