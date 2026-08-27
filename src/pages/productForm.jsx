import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../components/AppLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';
import '../pages/userForm.css';

const emptyForm = {
name: '',
sku: '',
barcode_type: '',
barcode_number: '',
category_id: '',
alert_quantity: '',
description: '',
not_for_selling: false,
rack_row_position: '',
applicable_tax_id: '',
selling_price_tax_type: '',
cost_price: '',
default_selling_price: '',
warranty_info: '',
is_active: true,
};

function autoSku(name) {
const stamp = Date.now().toString(36).toUpperCase().slice(-5);

const base =
name
.trim()
.slice(0, 3)
.toUpperCase()
.replace(/[^A-Z0-9]/g, '') || 'PRD';

return `${base}-${stamp}`;
}

function getTaxRate(taxId, taxRates) {
const tax = taxRates.find(
(t) => String(t.id) === String(taxId)
);

return tax ? Number(tax.rate_percentage || 0) : 0;
}

function calculateSellingPrice({
costPrice,
profitMargin,
taxRate,
taxType,
}) {
const cost = Number(costPrice);
const margin = Number(profitMargin);
const tax = Number(taxRate);

if (
!Number.isFinite(cost) ||
!Number.isFinite(margin) ||
cost < 0 ||
margin < 0
) {
return '';
}

const priceBeforeTax =
cost + (cost * margin) / 100;

if (taxType === 'inclusive') {
return Number(
priceBeforeTax * (1 + tax / 100)
).toFixed(2);
}

return Number(priceBeforeTax).toFixed(2);
}

function calculateProfitMargin({
costPrice,
sellingPrice,
taxRate,
taxType,
}) {
const cost = Number(costPrice);
const selling = Number(sellingPrice);
const tax = Number(taxRate);

if (
!Number.isFinite(cost) ||
!Number.isFinite(selling) ||
cost <= 0 ||
selling < 0
) {
return '';
}

let sellingPriceBeforeTax = selling;

if (taxType === 'inclusive') {
sellingPriceBeforeTax =
selling / (1 + tax / 100);
}

const profit =
sellingPriceBeforeTax - cost;

return Number(
(profit / cost) * 100
).toFixed(2);
}

export default function ProductForm() {
const { id } = useParams();
const isEdit = !!id;
const navigate = useNavigate();
const { business, profile } = useAuth();

const [form, setForm] = useState(emptyForm);
const [categories, setCategories] = useState([]);
const [taxRates, setTaxRates] = useState([]);
const [locations, setLocations] = useState([]);
const [selectedLocations, setSelectedLocations] = useState([]);

const [loading, setLoading] = useState(isEdit);
const [submitting, setSubmitting] = useState(false);
const [error, setError] = useState('');

const [showOpeningStock, setShowOpeningStock] = useState(false);
const [openingStockLocation, setOpeningStockLocation] = useState('');
const [openingStockQuantity, setOpeningStockQuantity] = useState('');
const [createdProductId, setCreatedProductId] = useState(null);

useEffect(() => {
if (!business?.id) return;


Promise.all([
  supabase
    .from('categories')
    .select('id, name')
    .eq('business_id', business.id)
    .order('name'),

  supabase
    .from('tax_rates')
    .select('id, name, rate_percentage')
    .eq('business_id', business.id)
    .eq('is_active', true)
    .order('name'),

  supabase
    .from('locations')
    .select('id, name')
    .eq('business_id', business.id)
    .eq('is_active', true),
]).then(([catRes, taxRes, locRes]) => {
  setCategories(catRes.data || []);
  setTaxRates(taxRes.data || []);
  setLocations(locRes.data || []);
});


}, [business?.id]);

useEffect(() => {
if (!isEdit) return;


let cancelled = false;

async function load() {
  const [{ data: productRow }, { data: locRows }] =
    await Promise.all([
      supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single(),

      supabase
        .from('product_locations')
        .select('location_id')
        .eq('product_id', id),
    ]);

  if (cancelled) return;

  if (productRow) {
    setForm({
      ...emptyForm,
      ...productRow,
      category_id: productRow.category_id || '',
      applicable_tax_id: productRow.applicable_tax_id || '',
      alert_quantity: productRow.alert_quantity ?? '',
      barcode_type: productRow.barcode_type || '',
      barcode_number: productRow.barcode_number || '',
      selling_price_tax_type:
        productRow.selling_price_tax_type || '',
    });
  }

  setSelectedLocations(
    (locRows || []).map((l) => l.location_id)
  );

  setLoading(false);
}

load();

return () => {
  cancelled = true;
};


}, [isEdit, id]);

const update = (key) => (e) => {
const val =
e.target.type === 'checkbox'
? e.target.checked
: e.target.value;


setForm((f) => ({
  ...f,
  [key]: val,
}));


};

const handleCostPriceChange = (e) => {
setForm((current) => ({
...current,
cost_price: e.target.value,
}));
};

const handleSellingPriceChange = (e) => {
const sellingPrice = e.target.value;


const taxRate = getTaxRate(
  form.applicable_tax_id,
  taxRates
);

const profitMargin = calculateProfitMargin({
  costPrice: form.cost_price,
  sellingPrice,
  taxRate,
  taxType: form.selling_price_tax_type,
});

setForm((current) => ({
  ...current,
  default_selling_price: sellingPrice,
  profit_margin: profitMargin,
}));

};

const handleProfitMarginChange = (e) => {
const profitMargin = e.target.value;


const taxRate = getTaxRate(
  form.applicable_tax_id,
  taxRates
);

const sellingPrice = calculateSellingPrice({
  costPrice: form.cost_price,
  profitMargin,
  taxRate,
  taxType: form.selling_price_tax_type,
});

setForm((current) => ({
  ...current,
  profit_margin: profitMargin,
  default_selling_price: sellingPrice,
}));


};

const handleTaxChange = (e) => {
const taxId = e.target.value;


const taxRate = getTaxRate(
  taxId,
  taxRates
);

const sellingPrice = calculateSellingPrice({
  costPrice: form.cost_price,
  profitMargin: form.profit_margin,
  taxRate,
  taxType: form.selling_price_tax_type,
});

setForm((current) => ({
  ...current,
  applicable_tax_id: taxId,
  default_selling_price:
    form.profit_margin !== ''
      ? sellingPrice
      : current.default_selling_price,
}));


};

const handleTaxTypeChange = (e) => {
const taxType = e.target.value;


const taxRate = getTaxRate(
  form.applicable_tax_id,
  taxRates
);

const sellingPrice = calculateSellingPrice({
  costPrice: form.cost_price,
  profitMargin: form.profit_margin,
  taxRate,
  taxType,
});

setForm((current) => ({
  ...current,
  selling_price_tax_type: taxType,
  default_selling_price:
    form.profit_margin !== ''
      ? sellingPrice
      : current.default_selling_price,
}));


};

const toggleLocation = (locId) => {
setSelectedLocations((sel) =>
sel.includes(locId)
? sel.filter((l) => l !== locId)
: [...sel, locId]
);
};

const saveProductLocationsAndInitialLedger = async (
productId
) => {
const { error: deleteLocationsError } =
await supabase
.from('product_locations')
.delete()
.eq('product_id', productId);


if (deleteLocationsError) {
  throw deleteLocationsError;
}

if (selectedLocations.length === 0) {
  return;
}

const locationRows = selectedLocations.map(
  (location_id) => ({
    product_id: productId,
    location_id,
  })
);

const { error: insertLocationsError } =
  await supabase
    .from('product_locations')
    .insert(locationRows);

if (insertLocationsError) {
  throw insertLocationsError;
}

if (!isEdit) {
  const zeroLedgerRows = selectedLocations.map(
    (location_id) => ({
      business_id: business.id,
      product_id: productId,
      location_id,
      change_qty: 0,
      reason: 'adjustment',
      created_by: profile?.id || null,
    })
  );

  const { error: ledgerError } =
    await supabase
      .from('stock_ledger')
      .insert(zeroLedgerRows);

  if (ledgerError) {
    throw ledgerError;
  }
}


};

const handleSubmit = async (
e,
saveAndAddOpeningStock = false
) => {
e.preventDefault();
setError('');


const productName = form.name.trim();

if (
  !productName ||
  form.cost_price === '' ||
  form.default_selling_price === ''
) {
  setError(
    'Name, cost price, and selling price are required.'
  );
  return;
}

if (
  !isEdit &&
  selectedLocations.length === 0
) {
  setError(
    'Select at least one location where this product will be stocked.'
  );
  return;
}

if (
  form.alert_quantity !== '' &&
  (
    !/^\d+$/.test(
      String(form.alert_quantity)
    ) ||
    Number(form.alert_quantity) < 0
  )
) {
  setError(
    'Alert quantity must be a whole number greater than or equal to 0.'
  );
  return;
}

setSubmitting(true);

try {
  const payload = {
    business_id: business.id,
    name: productName,
    sku:
      form.sku.trim() ||
      autoSku(productName),
    barcode_type:
      form.barcode_type || null,
    barcode_number:
      form.barcode_number.trim() || null,
    category_id:
      form.category_id || null,
    alert_quantity:
      form.alert_quantity === ''
        ? null
        : Number(form.alert_quantity),
    description:
      form.description || null,
    not_for_selling:
      form.not_for_selling,
    rack_row_position:
      form.rack_row_position || null,
    applicable_tax_id:
      form.applicable_tax_id || null,
    selling_price_tax_type:
      form.selling_price_tax_type || null,
    cost_price:
      Number(form.cost_price),
    default_selling_price:
      Number(form.default_selling_price),
    warranty_info:
      form.warranty_info || null,
    is_active:
      form.is_active,
  };

  let productId = id;

  if (isEdit) {
    const { error: err } =
      await supabase
        .from('products')
        .update(payload)
        .eq('id', id);

    if (err) {
      throw err;
    }
  } else {
    const { data, error: err } =
      await supabase
        .from('products')
        .insert(payload)
        .select()
        .single();

    if (err) {
      throw err;
    }

    productId = data.id;
  }

  await saveProductLocationsAndInitialLedger(
    productId
  );

  if (!saveAndAddOpeningStock) {
    navigate('/products');
    return;
  }

  setCreatedProductId(productId);

  setOpeningStockLocation(
    String(selectedLocations[0] || '')
  );

  setShowOpeningStock(true);
} catch (err) {
  if (err.code === '23505') {
    setError(
      'A product with this name already exists for this business.'
    );
  } else {
    setError(
      err.message ||
        'Could not save this product.'
    );
  }
} finally {
  setSubmitting(false);
}


};

const saveOpeningStock = async () => {
setError('');


const quantity = Number(
  openingStockQuantity
);

if (!openingStockLocation) {
  setError(
    'Select a location for the opening stock.'
  );
  return;
}

if (
  openingStockQuantity === '' ||
  !/^\d+$/.test(
    String(openingStockQuantity)
  ) ||
  quantity < 0
) {
  setError(
    'Opening quantity must be a whole number greater than or equal to 0.'
  );
  return;
}

if (!createdProductId) {
  setError(
    'Product was not created correctly. Please try again.'
  );
  return;
}

setSubmitting(true);

try {
  const { error: ledgerError } =
    await supabase
      .from('stock_ledger')
      .insert({
        business_id: business.id,
        product_id: createdProductId,
        location_id:
          Number(openingStockLocation),
        change_qty: quantity,
        reason: 'adjustment',
        created_by: profile?.id || null,
      });

  if (ledgerError) {
    throw ledgerError;
  }

  navigate('/products');
} catch (err) {
  setError(
    err.message ||
      'Could not save opening stock.'
  );
} finally {
  setSubmitting(false);
}


};

if (loading) {
return ( <AppLayout> <div className="muted">
Loading… </div> </AppLayout>
);
}

return ( <AppLayout> <div className="page-header"> <div> <h1>
{isEdit
? 'Edit product'
: 'Add product'} </h1>


      <p className="muted">
        Leave SKU blank to auto-generate one.
      </p>
    </div>

    <button
      className="btn btn-secondary"
      onClick={() =>
        navigate('/products')
      }
    >
      Cancel
    </button>
  </div>

  {!showOpeningStock ? (
    <form className="user-form">

      <section className="card form-section">
        <h2>Basic details</h2>

        <div className="form-grid">

          <div className="field">
            <label>
              Product name *
            </label>

            <input
              value={form.name}
              onChange={update('name')}
              required
            />
          </div>

          <div className="field">
            <label>SKU</label>

            <input
              value={form.sku}
              onChange={update('sku')}
              placeholder="Auto-generated if blank"
            />
          </div>

          <div className="field">
            <label>Category</label>

            <select
              value={form.category_id}
              onChange={update('category_id')}
            >
              <option value="">—</option>

              {categories.map((c) => (
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
            <label>Alert quantity</label>

            <input
              type="number"
              min="0"
              step="1"
              value={form.alert_quantity}
              onChange={update('alert_quantity')}
            />
          </div>

          <div className="field">
            <label>Barcode type</label>

            <select
              value={form.barcode_type}
              onChange={update('barcode_type')}
            >
              <option value="">—</option>

              {[
                'EAN13',
                'EAN8',
                'CODE128',
                'CODE39',
                'QR',
                'UPCA',
              ].map((b) => (
                <option
                  key={b}
                  value={b}
                >
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Barcode number</label>

            <input
              value={form.barcode_number}
              onChange={update('barcode_number')}
              placeholder="Auto-generated if blank"
            />
          </div>

          <div className="field">
            <label>
              Rack / row position
            </label>

            <input
              value={form.rack_row_position}
              onChange={update(
                'rack_row_position'
              )}
            />
          </div>

          <div className="field checkbox-field">
            <label>
              <input
                type="checkbox"
                checked={
                  form.not_for_selling
                }
                onChange={update(
                  'not_for_selling'
                )}
              />{' '}
              Not for selling
            </label>
          </div>

          <div
            className="field"
            style={{
              gridColumn: '1 / -1',
            }}
          >
            <label>Description</label>

            <input
              value={form.description}
              onChange={update(
                'description'
              )}
            />
          </div>

        </div>
      </section>

      <section className="card form-section">
        <h2>Pricing & tax</h2>

        <div className="form-grid">

          <div className="field">
            <label>Cost price *</label>

            <input
              type="number"
              step="0.01"
              min="0"
              value={form.cost_price}
              onChange={
                handleCostPriceChange
              }
              required
            />
          </div>

          <div className="field">
            <label>
              Profit margin %
            </label>

            <input
              type="number"
              step="0.01"
              min="0"
              value={
                form.profit_margin || ''
              }
              onChange={
                handleProfitMarginChange
              }
              placeholder="Enter desired profit %"
            />
          </div>

          <div className="field">
            <label>
              Default selling price *
            </label>

            <input
              type="number"
              step="0.01"
              min="0"
              value={
                form.default_selling_price
              }
              onChange={
                handleSellingPriceChange
              }
              required
            />
          </div>

          <div className="field">
            <label>
              Applicable tax
            </label>

            <select
              value={
                form.applicable_tax_id
              }
              onChange={
                handleTaxChange
              }
            >
              <option value="">—</option>

              {taxRates.map((t) => (
                <option
                  key={t.id}
                  value={t.id}
                >
                  {t.name} (
                  {Number(
                    t.rate_percentage
                  )}
                  %)
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>
              Selling price tax type
            </label>

            <select
              value={
                form.selling_price_tax_type
              }
              onChange={
                handleTaxTypeChange
              }
            >
              <option value="">—</option>

              <option value="inclusive">
                Inclusive
              </option>

              <option value="exclusive">
                Exclusive
              </option>
            </select>
          </div>

          <div className="field">
            <label>Warranty info</label>

            <input
              value={form.warranty_info}
              onChange={update(
                'warranty_info'
              )}
            />
          </div>

          <div className="field checkbox-field">
            <label>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={update(
                  'is_active'
                )}
              />{' '}
              Active
            </label>
          </div>

        </div>
      </section>

      <section className="card form-section">
        <h2>Stocked at</h2>

        <div className="chip-row">

          {locations.map((loc) => (
            <button
              type="button"
              key={loc.id}
              className={`chip ${
                selectedLocations.includes(
                  loc.id
                )
                  ? 'chip-selected'
                  : ''
              }`}
              onClick={() =>
                toggleLocation(loc.id)
              }
            >
              {loc.name}
            </button>
          ))}

          {locations.length === 0 && (
            <span className="muted">
              No locations yet — add one in Settings.
            </span>
          )}

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
            navigate('/products')
          }
        >
          Cancel
        </button>

        <button
          type="button"
          className="btn btn-primary"
          disabled={submitting}
          onClick={(e) =>
            handleSubmit(e, false)
          }
        >
          {submitting
            ? 'Saving…'
            : isEdit
              ? 'Save changes'
              : 'Create product'}
        </button>

        {!isEdit && (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={submitting}
            onClick={(e) =>
              handleSubmit(e, true)
            }
          >
            {submitting
              ? 'Saving…'
              : 'Save and add opening stock'}
          </button>
        )}

      </div>

    </form>
  ) : (

    <div className="user-form">

      <section className="card form-section">

        <h2>Opening stock</h2>

        <p className="muted">
          Add the initial quantity for this product.
          This will be recorded as an adjustment in
          the stock ledger.
        </p>

        <div className="form-grid">

          <div className="field">
            <label>Location *</label>

            <select
              value={
                openingStockLocation
              }
              onChange={(e) =>
                setOpeningStockLocation(
                  e.target.value
                )
              }
            >
              <option value="">
                Select location
              </option>

              {selectedLocations.map(
                (locationId) => {
                  const location =
                    locations.find(
                      (l) =>
                        l.id ===
                        locationId
                    );

                  if (!location) {
                    return null;
                  }

                  return (
                    <option
                      key={location.id}
                      value={location.id}
                    >
                      {location.name}
                    </option>
                  );
                }
              )}
            </select>
          </div>

          <div className="field">
            <label>
              Opening quantity *
            </label>

            <input
              type="number"
              min="0"
              step="1"
              value={
                openingStockQuantity
              }
              onChange={(e) =>
                setOpeningStockQuantity(
                  e.target.value
                )
              }
              autoFocus
            />
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
          disabled={submitting}
          onClick={() =>
            navigate('/products')
          }
        >
          Skip
        </button>

        <button
          type="button"
          className="btn btn-primary"
          disabled={submitting}
          onClick={saveOpeningStock}
        >
          {submitting
            ? 'Saving…'
            : 'Save opening stock'}
        </button>

      </div>

    </div>
  )}

</AppLayout>


);
}
