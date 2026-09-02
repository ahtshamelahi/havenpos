import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppLayout from '../components/AppLayout.jsx';
import { todayLocal } from '../lib/timezone.js';
import LineItemsEditor, { computeLine } from '../components/LineItemsEditor.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';
import {
  checkLowStockForItems,
  notifyPaymentDueCustomer,
} from '../lib/notifications.js';
import { getFifoCosts } from '../lib/fifoCost.js';
import { fetchAllBatched } from '../lib/fetchUtils.js';
import Loader from '../components/Loader.jsx';
import './userForm.css';
import useLocationScope from '../hooks/useLocationScope.js';

export default function SaleForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const editSaleId = searchParams.get('edit');
  const isEditMode = Boolean(editSaleId);

  const { business, profile } = useAuth();
  const { isScopedToLocation, scopedLocationIds } = useLocationScope();

  const [locations, setLocations] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [agents, setAgents] = useState([]);
  const [products, setProducts] = useState([]);
  const [taxRates, setTaxRates] = useState([]);

  const [locationId, setLocationId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [salesAgentId, setSalesAgentId] = useState('');
  const [saleDate, setSaleDate] = useState(
    todayLocal(business?.time_zone)
  );
  const [payTerm, setPayTerm] = useState('');
  const [items, setItems] = useState([]);
  const [discountType, setDiscountType] = useState('fixed');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [shippingCharges, setShippingCharges] = useState('0');
  const [paidAmount, setPaidAmount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [loadingSale, setLoadingSale] = useState(false);
  const [error, setError] = useState('');

  const [stockMap, setStockMap] = useState({});

  /*
  
  * This stores the original sale information when editing.
  * It is required so we can correctly reverse the old stock deduction
  * before applying the edited sale.
    */
  const [originalSale, setOriginalSale] = useState(null);
  const [originalItems, setOriginalItems] = useState([]);

  /*
  
  * LOAD FORM DATA
    */
  useEffect(() => {
    if (!business?.id) return;


    Promise.all([



      supabase
        .from('locations')
        .select('id, name')
        .eq('business_id', business.id)
        .eq('is_active', true),

      (() => {
        let q = supabase
          .from('contacts')
          .select('id, name')
          .eq('business_id', business.id)
          .eq('contact_type', 'customer')
          .eq('is_active', true);
        if (!profile?.is_owner) {
          q = q.eq('created_by', profile.id);
        }
        return q;
      })(),

      supabase
        .from('users')
        .select('id, first_name, last_name')
        .eq('business_id', business.id)
        .eq('is_sales_agent', true),

      supabase
        .from('products')
        .select(
          'id, name, sku, default_selling_price, applicable_tax_id, selling_price_tax_type, alert_quantity'
        )
        .eq('business_id', business.id)
        .eq('is_active', true)
        .eq('not_for_selling', false),

      supabase
        .from('tax_rates')
        .select('id, name, rate_percentage')
        .eq('business_id', business.id)
        .eq('is_active', true),
    ]).then(([locRes, custRes, agentRes, prodRes, taxRes]) => {
      let loadedLocations = locRes.data || [];
      if (isScopedToLocation) {
        loadedLocations = loadedLocations.filter((l) => scopedLocationIds.includes(l.id));
      }
      setLocations(loadedLocations);
      setCustomers(custRes.data || []);
      setAgents(agentRes.data || []);
      setProducts(prodRes.data || []);
      setTaxRates(taxRes.data || []);

      if (loadedLocations.length > 0 && !isEditMode) {
        setLocationId((prev) => prev || String(loadedLocations[0].id));
      }
    });


  }, [business?.id, isEditMode]);

  /*
  
  * LOAD EXISTING SALE FOR EDITING
    */
  useEffect(() => {
    if (!business?.id || !editSaleId) return;


    const loadSale = async () => {



      setLoadingSale(true);
      setError('');

      try {
        const { data: sale, error: saleError } = await supabase
          .from('sales')
          .select('*')
          .eq('id', editSaleId)
          .eq('business_id', business.id)
          .single();

        if (saleError) throw saleError;

        if (
          sale.status === 'returned' ||
          sale.status === 'partially_returned'
        ) {
          throw new Error(
            'Returned or partially returned sales cannot be edited.'
          );
        }

        const { data: saleItems, error: itemsError } = await supabase
          .from('sale_items')
          .select('*')
          .eq('sale_id', sale.id)
          .order('id');

        if (itemsError) throw itemsError;

        setOriginalSale(sale);
        setOriginalItems(saleItems || []);

        setLocationId(String(sale.location_id || ''));
        setCustomerId(String(sale.customer_id || ''));
        setSalesAgentId(String(sale.sales_agent_id || ''));
        setSaleDate(
          sale.sale_date || todayLocal(business?.time_zone)
        );
        setPayTerm(sale.pay_term || '');
        setDiscountType(sale.discount_type || 'fixed');
        setDiscountAmount(String(sale.discount_amount || 0));
        setShippingCharges(String(sale.shipping_charges || 0));
        setPaidAmount(String(sale.paid_amount || 0));
        setPaymentMethod(sale.payment_method || '');

        setItems(
          (saleItems || []).map((item) => ({
            product_id: item.product_id,
            variant_id: item.variant_id || null,
            quantity: String(item.quantity),
            unit_price: String(item.unit_price),
            discount_type: item.discount_type || 'fixed',
            discount_amount: String(item.discount_amount || 0),
            tax_id: item.tax_id || '',
          }))
        );
      } catch (err) {
        setError(
          err.message || 'Could not load this sale for editing.'
        );
      } finally {
        setLoadingSale(false);
      }
    };

    loadSale();


  }, [business?.id, editSaleId]);

  /*
  
  * LOAD STOCK
    */
  useEffect(() => {
    const loadStock = async () => {
      if (!business?.id || !locationId) {
        setStockMap({});
        return;
      }

      const { data, error: stockError } = await fetchAllBatched(() =>
        supabase
          .from('stock_ledger')
          .select('product_id, change_qty')
          .eq('business_id', business.id)
          .eq('location_id', locationId)
      );

      if (stockError) {
        console.error('Could not load stock:', stockError);
        setStockMap({});
        return;
      }

      const stockTotals = {};

      (data || []).forEach((row) => {
        stockTotals[row.product_id] =
          (stockTotals[row.product_id] || 0) +
          Number(row.change_qty || 0);
      });

      setStockMap(stockTotals);
    };


    loadStock();

  }, [business?.id, locationId]);

  const taxRatesById = useMemo(
    () => Object.fromEntries(taxRates.map((t) => [t.id, t])),
    [taxRates]
  );

  const productsById = useMemo(
    () => Object.fromEntries(products.map((p) => [p.id, p])),
    [products]
  );

  /*
  
  * CALCULATE TOTALS
    */
  const totals = useMemo(() => {
    let subtotalPreOverall = 0;

    items.forEach((it) => {
      const qty = Number(it.quantity) || 0;
      const unitPrice = Number(it.unit_price) || 0;
      const lineSub = qty * unitPrice;

      let itemDisc = Number(it.discount_amount) || 0;
      if (it.discount_type === 'percentage') {
        itemDisc = (lineSub * itemDisc) / 100;
      }
      subtotalPreOverall += Math.max(lineSub - itemDisc, 0);
    });

    let overallDiscountAmt = Number(discountAmount) || 0;
    if (discountType === 'percentage') {
      overallDiscountAmt =
        (subtotalPreOverall * overallDiscountAmt) / 100;
    }

    const overallDiscountRatio =
      subtotalPreOverall > 0
        ? overallDiscountAmt / subtotalPreOverall
        : 0;

    let subtotal = 0;
    let taxAmount = 0;
    let lineTotal = 0;

    items.forEach((it) => {
      const c = computeLine(
        it,
        taxRatesById,
        productsById,
        overallDiscountRatio
      );

      subtotal += Math.max(c.subtotal - c.discount, 0);
      taxAmount += c.taxAmount;
      lineTotal += c.lineTotal;
    });

    const shipping = Number(shippingCharges) || 0;

    const grandTotal = Math.max(lineTotal, 0) + shipping;

    const due = Math.max(
      grandTotal - (Number(paidAmount) || 0),
      0
    );

    const paymentStatus = due > 0 ? 'due' : 'paid';

    return {
      subtotal,
      taxAmount,
      overallDiscount: overallDiscountAmt,
      shipping,
      grandTotal,
      due,
      paymentStatus,
    };
  }, [
    items,
    taxRatesById,
    productsById,
    discountType,
    discountAmount,
    shippingCharges,
    paidAmount,
  ]);

  /*
  
  * STOCK CHECK
  *
  * When editing a confirmed sale:
  *
  * Current stock already includes the old sale deduction.
  * Therefore, we add the old quantities back before checking
  * the new requested quantities.
    */
  const getAvailableStockForEdit = (productId) => {
    let available = Number(
      stockMap[productId] || 0
    );


    if (



      isEditMode &&
      originalSale?.status === 'confirmed' &&
      String(originalSale.location_id) === String(locationId)
    ) {
      const oldQuantity = originalItems
        .filter(
          (item) =>
            String(item.product_id) ===
            String(productId)
        )
        .reduce(
          (sum, item) =>
            sum + Number(item.quantity || 0),
          0
        );

      available += oldQuantity;
    }

    return available;


  };

  /*
  
  * SAVE / UPDATE SALE
    */
  const save = async (statusToSet) => {
    setError('');


    if (!locationId) {



      setError('Select a location.');
      return;
    }

    if (items.length === 0) {
      setError('Add at least one item.');
      return;
    }

    const invalidQuantity = items.some(
      (item) =>
        item.quantity === '' ||
        !/^\d+$/.test(
          String(item.quantity)
        ) ||
        Number(item.quantity) <= 0
    );

    if (invalidQuantity) {
      setError(
        'Every item quantity must be greater than 0.'
      );
      return;
    }

    /*
     * STOCK CHECK
     */
    const requestedByProduct = {};

    items.forEach((item) => {
      requestedByProduct[item.product_id] =
        (requestedByProduct[item.product_id] || 0) +
        Number(item.quantity);
    });

    for (const [
      productId,
      requestedQuantity,
    ] of Object.entries(
      requestedByProduct
    )) {
      const availableQuantity =
        getAvailableStockForEdit(productId);

      if (
        statusToSet === 'confirmed' &&
        requestedQuantity > availableQuantity
      ) {
        const product = products.find(
          (p) =>
            String(p.id) ===
            String(productId)
        );

        setError(
          `${product?.name || 'Product'} has only ${availableQuantity} available, but you requested ${requestedQuantity}.`
        );

        return;
      }
    }

    setSubmitting(true);

    try {
      const salePayload = {
        business_id: business.id,
        location_id: locationId,
        customer_id: customerId || null,
        sales_agent_id: salesAgentId || null,
        channel: 'manual',
        sale_date: saleDate,
        status: statusToSet,
        pay_term: payTerm || null,
        subtotal: totals.subtotal,
        discount_type: discountType,
        discount_amount: totals.overallDiscount,
        tax_amount: totals.taxAmount,
        shipping_charges: totals.shipping,
        grand_total: totals.grandTotal,
        payment_method: paymentMethod || null,
        paid_amount: Number(paidAmount) || 0,
        due_amount: totals.due,
        //payment_status: totals.paymentStatus,
      };

      let sale;

      /*
       * UPDATE EXISTING SALE
       */
      if (isEditMode) {
        const { data: updatedSale, error: updateError } =
          await supabase
            .from('sales')
            .update(salePayload)
            .eq('id', editSaleId)
            .eq('business_id', business.id)
            .select()
            .single();

        if (updateError) throw updateError;

        sale = updatedSale;

        /*
         * If the old sale was confirmed, reverse
         * the old stock deduction first.
         */
        if (
          originalSale?.status === 'confirmed'
        ) {
          const oldStockRows =
            originalItems.map((item) => ({
              business_id: business.id,
              product_id: item.product_id,
              variant_id: item.variant_id || null,
              location_id:
                originalSale.location_id,
              change_qty: Number(item.quantity),
              reason: 'sale_edit_reversal',
              reference_type: 'sale',
              reference_id: sale.id,
              created_by: profile.id,
            }));

          if (oldStockRows.length > 0) {
            const {
              error: oldStockError,
            } = await supabase
              .from('stock_ledger')
              .insert(oldStockRows);

            if (oldStockError)
              throw oldStockError;
          }
        }

        /*
         * Remove old sale items.
         */
        const {
          error: deleteItemsError,
        } = await supabase
          .from('sale_items')
          .delete()
          .eq('sale_id', sale.id);

        if (deleteItemsError)
          throw deleteItemsError;
      }

      /*
       * CREATE NEW SALE
       */
      else {
        const { data: newSale, error: saleErr } =
          await supabase
            .from('sales')
            .insert({
              ...salePayload,
              created_by: profile.id,
            })
            .select()
            .single();

        if (saleErr) throw saleErr;

        sale = newSale;
      }

      /*
       * INSERT NEW SALE ITEMS
       */
      const fifoCosts = await getFifoCosts(business.id, items);

      const itemRows = items.map((it) => {
        const c = computeLine(
          it,
          taxRatesById,
          productsById
        );

        return {
          sale_id: sale.id,
          product_id: it.product_id,
          variant_id: it.variant_id || null,
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
          unit_cost: fifoCosts[it.product_id] || 0,
          discount_type: it.discount_type,
          discount_amount: c.discount,
          tax_id: it.tax_id || null,
          line_total: c.lineTotal,
        };
      });

      const {
        error: itemsErr,
      } = await supabase
        .from('sale_items')
        .insert(itemRows);

      if (itemsErr) throw itemsErr;

      /*
       * APPLY STOCK DEDUCTION FOR CONFIRMED SALE
       */
      if (statusToSet === 'confirmed') {
        const stockRows = items.map((it) => ({
          business_id: business.id,
          product_id: it.product_id,
          variant_id: it.variant_id || null,
          location_id: locationId,
          change_qty: -Number(it.quantity),
          reason: isEditMode
            ? 'sale_edit'
            : 'sale',
          reference_type: 'sale',
          reference_id: sale.id,
          created_by: profile.id,
        }));

        const {
          error: stockErr,
        } = await supabase
          .from('stock_ledger')
          .insert(stockRows);

        if (stockErr) throw stockErr;
      }

      /*
       * CONTACT LEDGER
       *
       * Existing sale ledger entries are removed and recreated
       * when editing.
       */
      if (isEditMode) {
        await supabase
          .from('contact_ledger')
          .delete()
          .eq('reference_type', 'sale')
          .eq('reference_id', sale.id);
      }

      if (
        customerId &&
        totals.due > 0 &&
        statusToSet === 'confirmed'
      ) {
        const {
          error: ledgerError,
        } = await supabase
          .from('contact_ledger')
          .insert({
            business_id: business.id,
            contact_id: customerId,
            reference_type: 'sale',
            reference_id: sale.id,
            amount: totals.due,
          });

        if (ledgerError)
          throw ledgerError;
      }

      /*
       * LOW STOCK + PAYMENT DUE NOTIFICATIONS
       */
      if (statusToSet === 'confirmed') {
        try {
          const productsByIdForNotification =
            Object.fromEntries(
              products.map((p) => [
                p.id,
                p,
              ])
            );

          const locationName =
            locations.find(
              (l) =>
                String(l.id) ===
                String(locationId)
            )?.name;

          await checkLowStockForItems({
            businessId: business.id,
            locationId,
            locationName,
            items: items.map((it) => ({
              product_id: it.product_id,
              quantity: it.quantity,
            })),
            productsById:
              productsByIdForNotification,
          });

          if (
            customerId &&
            totals.due > 0
          ) {
            const customerName =
              customers.find(
                (c) =>
                  String(c.id) ===
                  String(customerId)
              )?.name ||
              'the customer';

            await notifyPaymentDueCustomer({
              businessId: business.id,
              saleId: sale.id,
              customerName,
              dueAmount: totals.due,
              currency: business.currency,
            });
          }
        } catch {
          // Notifications are best-effort.
        }
      }

      navigate('/sales');
    } catch (err) {
      setError(
        err.message ||
        `Could not ${isEditMode
          ? 'update'
          : 'save'
        } this sale.`
      );
    } finally {
      setSubmitting(false);
    }


  };

  if (loadingSale) {
    return (
      <AppLayout>
        <Loader text="Loading sale..." />
      </AppLayout>
    );
  }

  return (<AppLayout> <div className="page-header"> <div> <h1>
    {isEditMode
      ? 'Edit Sale'
      : 'New sale'} </h1>


    <p className="muted">
      {isEditMode
        ? 'Update the existing sale. Changes will be saved to this sale.'
        : 'Save as a draft or quotation, or confirm to deduct stock immediately.'}
    </p>
  </div>

    <button
      className="btn btn-secondary"
      onClick={() =>
        navigate('/sales')
      }
    >
      Cancel
    </button>
  </div>

    <div className="user-form">
      <section className="card form-section">
        <h2>Sale details</h2>

        <div className="form-grid">
          <div className="field">
            <label>
              Location *
            </label>

            <select
              value={locationId}
              onChange={(e) =>
                setLocationId(
                  e.target.value
                )
              }
            >
              <option value="">
                Select…
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
          </div>

          <div className="field">
            <label>
              Customer
            </label>

            <select
              value={customerId}
              onChange={(e) =>
                setCustomerId(
                  e.target.value
                )
              }
            >
              <option value="">
                Walk-in
              </option>

              {customers.map((c) => (
                <option
                  key={c.id}
                  value={c.id}
                >
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>
              Sales agent
            </label>

            <select
              value={salesAgentId}
              onChange={(e) =>
                setSalesAgentId(
                  e.target.value
                )
              }
            >
              <option value="">
                —
              </option>

              {agents.map((a) => (
                <option
                  key={a.id}
                  value={a.id}
                >
                  {a.first_name}{' '}
                  {a.last_name || ''}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>
              Sale date
            </label>

            <input
              type="date"
              value={saleDate}
              onChange={(e) =>
                setSaleDate(
                  e.target.value
                )
              }
            />
          </div>

          <div className="field">
            <label>
              Pay term
            </label>

            <input
              value={payTerm}
              onChange={(e) =>
                setPayTerm(
                  e.target.value
                )
              }
              placeholder="e.g. Due on receipt"
            />
          </div>
        </div>
      </section>

      <section className="card form-section">
        <h2>Items</h2>

        <LineItemsEditor
          items={items}
          onChange={setItems}
          products={products}
          taxRates={taxRates}
          priceField="default_selling_price"
          stockMap={stockMap}
          mode="sale"
        />
      </section>

      <section className="card form-section">
        <h2>
          Totals & payment
        </h2>

        <div className="form-grid">
          <div className="field">
            <label>
              Overall discount type
            </label>

            <select
              value={discountType}
              onChange={(e) =>
                setDiscountType(
                  e.target.value
                )
              }
            >
              <option value="fixed">
                Fixed
              </option>

              <option value="percentage">
                Percentage
              </option>
            </select>
          </div>

          <div className="field">
            <label>
              Overall discount amount
            </label>

            <input
              type="number"
              min="0"
              step="0.01"
              value={discountAmount}
              onChange={(e) =>
                setDiscountAmount(
                  e.target.value
                )
              }
            />
          </div>

          <div className="field">
            <label>
              Shipping charges
            </label>

            <input
              type="number"
              min="0"
              step="0.01"
              value={shippingCharges}
              onChange={(e) =>
                setShippingCharges(
                  e.target.value
                )
              }
            />
          </div>

          <div className="field">
            <label>
              Paid amount
            </label>

            <input
              type="number"
              min="0"
              step="0.01"
              value={paidAmount}
              onChange={(e) =>
                setPaidAmount(
                  e.target.value
                )
              }
            />
          </div>

          <div className="field">
            <label>
              Payment method
            </label>

            <input
              value={paymentMethod}
              onChange={(e) =>
                setPaymentMethod(
                  e.target.value
                )
              }
              placeholder="Cash, card…"
            />
          </div>

          {/* <div className="field">
          <label>
            Payment status
          </label>

          <input
            value={
              totals.paymentStatus
            }
            readOnly
            style={{
              textTransform:
                'capitalize',
              fontWeight: 600,
            }}
          />
        </div> */}
        </div>

        <div className="totals-summary">
          <div>
            <span>
              Subtotal
            </span>

            <span>
              {business?.currency}{' '}
              {totals.subtotal.toFixed(
                2
              )}
            </span>
          </div>

          <div>
            <span>
              Discount
            </span>

            <span>
              - {business?.currency}{' '}
              {totals.overallDiscount.toFixed(
                2
              )}
            </span>
          </div>

          <div>
            <span>
              Tax
            </span>

            <span>
              {business?.currency}{' '}
              {totals.taxAmount.toFixed(
                2
              )}
            </span>
          </div>

          <div>
            <span>
              Shipping
            </span>

            <span>
              {business?.currency}{' '}
              {totals.shipping.toFixed(
                2
              )}
            </span>
          </div>

          <div>
            <span>
              Due
            </span>

            <span>
              {business?.currency}{' '}
              {totals.due.toFixed(
                2
              )}
            </span>
          </div>

          <div className="totals-grand">
            <span>
              Grand total
            </span>

            <span>
              {business?.currency}{' '}
              {totals.grandTotal.toFixed(
                2
              )}
            </span>
          </div>
        </div>
      </section>

      {error && (
        <div className="error-text">
          {error}
        </div>
      )}

      <div className="form-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() =>
            navigate('/sales')
          }
        >
          Cancel
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          disabled={submitting}
          onClick={() =>
            save('draft')
          }
        >
          {isEditMode
            ? 'Update as draft'
            : 'Save as draft'}
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          disabled={submitting}
          onClick={() =>
            save('quotation')
          }
        >
          {isEditMode
            ? 'Update quotation'
            : 'Save as quotation'}
        </button>

        <button
          type="button"
          className="btn btn-primary"
          disabled={submitting}
          onClick={() =>
            save('confirmed')
          }
        >
          {isEditMode
            ? 'Update & deduct stock'
            : 'Confirm & deduct stock'}
        </button>
      </div>
    </div>
  </AppLayout>


  );
}