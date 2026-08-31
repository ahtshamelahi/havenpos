import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppLayout from '../components/AppLayout.jsx';
import LineItemsEditor, { computeLine } from '../components/LineItemsEditor.jsx';
import { todayLocal } from '../lib/timezone.js';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';
import { fetchAllBatched } from '../lib/fetchUtils.js';
import { notifyPaymentDueSupplier } from '../lib/notifications.js';
import Loader from '../components/Loader.jsx';
import useLocationScope from '../hooks/useLocationScope.js';
import './userForm.css';

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

export default function PurchaseForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const purchaseId = searchParams.get('id');
  const isEditMode = Boolean(purchaseId);

  const { business, profile } = useAuth();
  const { isScopedToLocation, scopedLocationIds } = useLocationScope();

  const [locations, setLocations] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [taxRates, setTaxRates] = useState([]);

  const [locationId, setLocationId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(
    todayLocal(business?.time_zone)
  );

  const [payTerm, setPayTerm] = useState('');
  const [supplierInvoice, setSupplierInvoice] = useState('');
  const [paymentNote, setPaymentNote] = useState('');

  const [items, setItems] = useState([]);

  const [discountType, setDiscountType] = useState('fixed');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [shippingCharges, setShippingCharges] = useState('0');

  const [advancePayment, setAdvancePayment] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('');

  const [stockMap, setStockMap] = useState({});

  const [submitting, setSubmitting] = useState(false);
  const [loadingForm, setLoadingForm] = useState(true);
  const [error, setError] = useState('');

  const [originalPurchase, setOriginalPurchase] = useState(null);
  const [originalItems, setOriginalItems] = useState([]);

  /*
   * Load purchase-related data.
   * In edit mode, preload the existing purchase and items.
   */
  useEffect(() => {
    if (!business?.id) return;

    const loadData = async () => {
      setLoadingForm(true);
      setError('');

      try {
        const [
          locationsRes,
          suppliersRes,
          productsRes,
          taxRatesRes,
        ] = await Promise.all([
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
              .eq('contact_type', 'supplier')
              .eq('is_active', true);
            if (!profile?.is_owner) {
              q = q.eq('created_by', profile.id);
            }
            return q;
          })(),

          supabase
            .from('products')
            .select(`
              id,
              name,
              sku,
              cost_price,
              default_selling_price,
              applicable_tax_id,
              selling_price_tax_type
            `)
            .eq('business_id', business.id)
            .eq('is_active', true),

          supabase
            .from('tax_rates')
            .select('id, name, rate_percentage')
            .eq('business_id', business.id)
            .eq('is_active', true),
        ]);

        if (locationsRes.error) console.error('Locations error:', locationsRes.error);
        if (suppliersRes.error) console.error('Suppliers error:', suppliersRes.error);
        if (productsRes.error) console.error('Products error:', productsRes.error);
        if (taxRatesRes.error) console.error('Tax rates error:', taxRatesRes.error);

        let loadedLocations = locationsRes.data || [];
        if (isScopedToLocation) {
          loadedLocations = loadedLocations.filter((l) => scopedLocationIds.includes(l.id));
        }
        const loadedSuppliers = suppliersRes.data || [];
        const loadedProducts = productsRes.data || [];
        const loadedTaxRates = taxRatesRes.data || [];

        setLocations(loadedLocations);
        setSuppliers(loadedSuppliers);
        setProducts(loadedProducts);
        setTaxRates(loadedTaxRates);

        if (!isEditMode && loadedLocations.length > 0) {
          setLocationId((prev) => prev || String(loadedLocations[0].id));
        }

        if (isEditMode) {
          const { data: purchase, error: purchaseErr } = await supabase
            .from('purchases')
            .select('*')
            .eq('id', purchaseId)
            .eq('business_id', business.id)
            .single();

          if (purchaseErr) throw purchaseErr;
          if (!purchase) throw new Error('Purchase not found.');

          const { data: purchaseItems, error: itemsErr } = await supabase
            .from('purchase_items')
            .select('*')
            .eq('purchase_id', purchaseId)
            .order('id', { ascending: true });

          if (itemsErr) throw itemsErr;

          setOriginalPurchase(purchase);
          setOriginalItems(purchaseItems || []);

          setLocationId(String(purchase.location_id || ''));
          setSupplierId(purchase.supplier_id ? String(purchase.supplier_id) : '');
          setPurchaseDate(purchase.purchase_date || todayLocal(business?.time_zone));
          setPayTerm(purchase.pay_term || '');
          setSupplierInvoice(purchase.supplier_invoice_number || '');
          setPaymentNote(purchase.payment_note || '');
          setDiscountType(purchase.discount_type || 'fixed');
          setDiscountAmount(String(purchase.discount_amount ?? 0));
          setShippingCharges(String(purchase.shipping_charges ?? 0));
          setAdvancePayment(String(purchase.advance_payment ?? 0));
          setPaymentMethod(purchase.payment_method || '');

          const mappedItems = (purchaseItems || []).map((item) => ({
            id: item.id,
            product_id: item.product_id ? String(item.product_id) : '',
            variant_id: item.variant_id ? String(item.variant_id) : '',
            quantity: String(item.quantity ?? ''),
            unit_price: String(item.unit_cost ?? 0),
            discount_type: item.discount_type || 'fixed',
            discount_amount: String(item.discount_amount ?? 0),
            tax_id: item.tax_id ? String(item.tax_id) : '',
            line_total: item.line_total ?? 0,
          }));

          setItems(mappedItems.length > 0 ? mappedItems : []);
        }
      } catch (err) {
        setError(err.message || 'Could not load purchase data.');
      } finally {
        setLoadingForm(false);
      }
    };

    loadData();
  }, [business?.id, isEditMode, purchaseId]);

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
    () => Object.fromEntries(taxRates.map((tax) => [tax.id, tax])),
    [taxRates]
  );

  const productsById = useMemo(
    () => Object.fromEntries(products.map((product) => [product.id, product])),
    [products]
  );

  /*
   * Calculate totals for multiple purchase items
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

    items.forEach((item) => {
      const calculated = computeLine(
        item,
        taxRatesById,
        productsById,
        overallDiscountRatio
      );
      subtotal += Math.max(calculated.subtotal - calculated.discount, 0);
      taxAmount += calculated.taxAmount;
      lineTotal += calculated.lineTotal;
    });

    const shipping = Number(shippingCharges) || 0;

    const grandTotal = Math.max(lineTotal, 0) + shipping;

    return {
      subtotal,
      taxAmount,
      overallDiscount: overallDiscountAmt,
      shipping,
      grandTotal,
    };
  }, [items, taxRatesById, discountType, discountAmount, shippingCharges]);

  const getEffectiveStockMap = (purchaseStatus, purchaseLocationId, purchaseItemRows) => {
    const map = new Map();

    if (purchaseStatus !== 'received') return map;

    for (const item of purchaseItemRows || []) {
      const key = `${Number(item.product_id)}|${item.variant_id ? Number(item.variant_id) : ''}|${Number(purchaseLocationId)}`;
      const qty = Number(item.quantity || 0);
      map.set(key, (map.get(key) || 0) + qty);
    }

    return map;
  };

  /*
   * Save purchase
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

    const invalidQuantity = items.some((item) => {
      const quantity = Number(item.quantity);
      return (
        item.quantity === '' ||
        !Number.isFinite(quantity) ||
        quantity <= 0
      );
    });

    if (invalidQuantity) {
      setError('Every item quantity must be greater than 0.');
      return;
    }

    const invalidProduct = items.some((item) => !item.product_id);
    if (invalidProduct) {
      setError('Every purchase item must have a product.');
      return;
    }

    setSubmitting(true);

    try {
      const purchasePayload = {
        business_id: business.id,
        location_id: Number(locationId),
        supplier_id: supplierId ? Number(supplierId) : null,

        purchase_date: purchaseDate,
        purchase_status: statusToSet,

        pay_term: payTerm || null,
        supplier_invoice_number: supplierInvoice || null,

        subtotal: totals.subtotal,
        discount_type: discountType,
        discount_amount: totals.overallDiscount,
        tax_amount: totals.taxAmount,
        shipping_charges: totals.shipping,
        grand_total: totals.grandTotal,

        advance_payment: Number(advancePayment) || 0,
        payment_method: paymentMethod || null,
        payment_note: paymentNote || null,
        paid_on: Number(advancePayment) > 0 ? purchaseDate : null,

        created_by: profile?.id || null,
      };

      let purchaseIdToUse = purchaseId;
      let savedPurchase = null;

      if (isEditMode) {
        const { data: updatedPurchase, error: purchaseErr } = await supabase
          .from('purchases')
          .update(purchasePayload)
          .eq('id', purchaseId)
          .eq('business_id', business.id)
          .select()
          .single();

        if (purchaseErr) throw purchaseErr;
        savedPurchase = updatedPurchase;
        purchaseIdToUse = updatedPurchase.id;
      } else {
        const { data: newPurchase, error: purchaseErr } = await supabase
          .from('purchases')
          .insert(purchasePayload)
          .select()
          .single();

        if (purchaseErr) throw purchaseErr;
        savedPurchase = newPurchase;
        purchaseIdToUse = newPurchase.id;
      }

      const itemRows = items.map((item) => {
        const calculated = computeLine(item, taxRatesById);

        return {
          purchase_id: purchaseIdToUse,
          product_id: Number(item.product_id),
          variant_id: item.variant_id ? Number(item.variant_id) : null,
          quantity: Number(item.quantity),
          unit_cost: Number(item.unit_price) || 0,
          discount_type: item.discount_type || 'fixed',
          discount_amount: calculated.discount,
          tax_id: item.tax_id ? Number(item.tax_id) : null,
          line_total: calculated.lineTotal,
        };
      });

      if (isEditMode) {
        const originalItemIds = (originalItems || [])
          .map((it) => it.id)
          .filter(Boolean);

        if (originalItemIds.length > 0) {
          const { data: returnLinks, error: returnCheckErr } = await supabase
            .from('purchase_return_items')
            .select('id, purchase_item_id')
            .in('purchase_item_id', originalItemIds);

          if (returnCheckErr) throw returnCheckErr;

          if ((returnLinks || []).length > 0) {
            throw new Error(
              'This purchase cannot be edited because it already has linked returns. Please create a new adjustment instead.'
            );
          }
        }

        const { error: deleteErr } = await supabase
          .from('purchase_items')
          .delete()
          .eq('purchase_id', purchaseIdToUse);

        if (deleteErr) throw deleteErr;
      }

      const { error: itemsErr } = await supabase
        .from('purchase_items')
        .insert(itemRows);

      if (itemsErr) throw itemsErr;

      const originalStatus = originalPurchase?.purchase_status || 'draft';
      const originalLocationId = originalPurchase?.location_id ?? null;
      const originalSupplierId = originalPurchase?.supplier_id ?? null;
      const originalAdvancePayment = Number(originalPurchase?.advance_payment || 0);
      const originalGrandTotal = Number(originalPurchase?.grand_total || 0);
      const originalDue = round2(originalGrandTotal - originalAdvancePayment);

      const newGrandTotal = round2(totals.grandTotal);
      const newAdvancePayment = Number(advancePayment) || 0;
      const newDue = round2(newGrandTotal - newAdvancePayment);

      const oldEffectiveMap = isEditMode
        ? getEffectiveStockMap(originalStatus, originalLocationId, originalItems)
        : new Map();

      const newEffectiveMap = getEffectiveStockMap(
        statusToSet,
        Number(locationId),
        items.map((item) => ({
          product_id: item.product_id,
          variant_id: item.variant_id ? Number(item.variant_id) : null,
          quantity: Number(item.quantity),
        }))
      );

      const deltaKeys = new Set([...oldEffectiveMap.keys(), ...newEffectiveMap.keys()]);
      const stockRows = [];

      for (const key of deltaKeys) {
        const [productIdStr, variantIdStr, locationIdStr] = key.split('|');

        const oldQty = Number(oldEffectiveMap.get(key) || 0);
        const newQty = Number(newEffectiveMap.get(key) || 0);
        const delta = newQty - oldQty;

        if (delta !== 0) {
          stockRows.push({
            business_id: business.id,
            product_id: Number(productIdStr),
            variant_id: variantIdStr ? Number(variantIdStr) : null,
            location_id: Number(locationIdStr),
            change_qty: delta,
            reason: isEditMode ? 'purchase_edit' : 'purchase',
            reference_type: isEditMode ? 'purchase_edit' : 'purchase',
            reference_id: purchaseIdToUse,
            created_by: profile?.id || null,
          });
        }
      }

      if (stockRows.length > 0) {
        const { error: stockErr } = await supabase.from('stock_ledger').insert(stockRows);
        if (stockErr) throw stockErr;
      }

      /*
       * Supplier balance / contact ledger.
       * Keep this additive so edits can correct old balances.
       */
      const hadSupplierLedger = originalStatus === 'received' && !!originalSupplierId;
      const willHaveSupplierLedger = statusToSet === 'received' && !!supplierId;

      if (isEditMode && hadSupplierLedger) {
        const { error: reverseErr } = await supabase.from('contact_ledger').insert({
          business_id: business.id,
          contact_id: Number(originalSupplierId),
          reference_type: 'purchase_edit',
          reference_id: purchaseIdToUse,
          amount: -originalDue,
        });
        if (reverseErr) throw reverseErr;
      }

      if (willHaveSupplierLedger) {
        const { error: applyErr } = await supabase.from('contact_ledger').insert({
          business_id: business.id,
          contact_id: Number(supplierId),
          reference_type: isEditMode ? 'purchase_edit' : 'purchase',
          reference_id: purchaseIdToUse,
          amount: newDue,
        });
        if (applyErr) throw applyErr;
      }

      if (statusToSet === 'received' && supplierId) {
        const shouldNotify =
          !isEditMode ||
          originalStatus !== 'received' ||
          String(originalSupplierId || '') !== String(supplierId || '');

        if (shouldNotify) {
          try {
            await notifyPaymentDueSupplier({
              businessId: business.id,
              purchaseId: purchaseIdToUse,
              supplierName:
                suppliers.find(
                  (supplier) => Number(supplier.id) === Number(supplierId)
                )?.name || 'the supplier',
              owedAmount: newDue,
              currency: business.currency,
            });
          } catch {
            // Notification failure must not block purchase save.
          }
        }
      }

      navigate('/purchases');
    } catch (err) {
      setError(err.message || 'Could not save this purchase.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1>{isEditMode ? 'Edit purchase' : 'New purchase'}</h1>
          <p className="muted">
            {isEditMode
              ? 'Update the existing purchase and save your changes.'
              : 'Save as a draft, or mark received to add stock immediately.'}
          </p>
        </div>

        <button
          className="btn btn-secondary"
          onClick={() => navigate('/purchases')}
        >
          Cancel
        </button>
      </div>

      <div className="user-form">
        {loadingForm && (
          <div className="card form-section" style={{ border: 'none', boxShadow: 'none', background: 'transparent' }}>
            <Loader text="Loading purchase form..." />
          </div>
        )}

        {!loadingForm && (
          <>
            <section className="card form-section">
              <h2>Purchase details</h2>

              <div className="form-grid">
                <div className="field">
                  <label>Location *</label>
                  <select
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>Supplier</label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                  >
                    <option value="">Cash / unspecified</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>Purchase date</label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label>Supplier invoice #</label>
                  <input
                    value={supplierInvoice}
                    onChange={(e) => setSupplierInvoice(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label>Pay term</label>
                  <input
                    value={payTerm}
                    onChange={(e) => setPayTerm(e.target.value)}
                    placeholder="e.g. Net 30"
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
                priceField="cost_price"
                stockMap={stockMap}
                mode="purchase"
              />
            </section>

            <section className="card form-section">
              <h2>Totals & payment</h2>

              <div className="form-grid">
                <div className="field">
                  <label>Overall discount type</label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value)}
                  >
                    <option value="fixed">Fixed</option>
                    <option value="percentage">Percentage</option>
                  </select>
                </div>

                <div className="field">
                  <label>Overall discount amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label>Shipping charges</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={shippingCharges}
                    onChange={(e) => setShippingCharges(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label>Advance payment</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={advancePayment}
                    onChange={(e) => setAdvancePayment(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label>Payment method</label>
                  <input
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    placeholder="Cash, bank transfer…"
                  />
                </div>

                <div className="field">
                  <label>Payment note</label>
                  <textarea
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    placeholder="Optional payment note"
                    rows="3"
                  />
                </div>
              </div>

              <div className="totals-summary">
                <div>
                  <span>Subtotal</span>
                  <span>
                    {business?.currency}{' '}
                    {totals.subtotal.toFixed(2)}
                  </span>
                </div>

                <div>
                  <span>Discount</span>
                  <span>
                    - {business?.currency}{' '}
                    {totals.overallDiscount.toFixed(2)}
                  </span>
                </div>

                <div>
                  <span>Tax</span>
                  <span>
                    {business?.currency}{' '}
                    {totals.taxAmount.toFixed(2)}
                  </span>
                </div>

                <div>
                  <span>Shipping</span>
                  <span>
                    {business?.currency}{' '}
                    {totals.shipping.toFixed(2)}
                  </span>
                </div>

                <div className="totals-grand">
                  <span>Grand total</span>
                  <span>
                    {business?.currency}{' '}
                    {totals.grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>
            </section>

            {error && <div className="error-text">{error}</div>}

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/purchases')}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                disabled={submitting}
                onClick={() => save('draft')}
              >
                {isEditMode ? 'Update as draft' : 'Save as draft'}
              </button>

              <button
                type="button"
                className="btn btn-primary"
                disabled={submitting}
                onClick={() => save('received')}
              >
                {isEditMode ? 'Update & receive stock' : 'Save & receive stock'}
              </button>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}