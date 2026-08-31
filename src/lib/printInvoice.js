/**
 * printInvoice — opens a clean, print-ready invoice/receipt in a new window
 * and triggers the browser's print dialog. Callable from anywhere — POS
 * Billing, the Sales list, the Purchases list, wherever — because it's a
 * plain function, not a component you have to mount in your page's JSX.
 *
 * Works for both sales and purchase documents; you decide what appears via
 * `columns`, `totals`, and the party/seller info you pass in.
 *
 * -------------------------------------------------------------------------
 * @param {object} options
 * @param {string} [options.documentType='Invoice']  e.g. 'Sales Invoice', 'Purchase Invoice', 'Receipt'
 * @param {{ name?, address?, city?, country?, contact_number? }} options.business
 * @param {{ label?, name?, contact_number? }} [options.party]
 *    The other side of the transaction — customer for a sale, supplier for
 *    a purchase. `label` defaults to 'Customer'.
 * @param {{ name?, contact_number? }} [options.seller]
 *    The staff member who processed it — name + phone shown at the very
 *    bottom, per your spec.
 * @param {string|number} [options.invoiceNumber]
 * @param {string} [options.date]
 * @param {Array<{ key: string, label: string, align?: 'left'|'right'|'center', format?: (row) => string|number }>} options.columns
 *    Exactly the columns you want on the line-items table, in order.
 * @param {Array<object>} options.rows  The line items (sale_items / purchase_items, or anything).
 * @param {Array<{ label: string, value: string|number, emphasize?: boolean }>} [options.totals]
 *    Rendered as a totals block below the table, in order. Set
 *    `emphasize: true` on the grand-total row to make it stand out.
 * @param {string} [options.footerNote]  e.g. your Invoice Settings footer note / terms.
 *
 * @example
 *   printInvoice({
 *     documentType: 'Sales Invoice',
 *     business: { name: business.business_name, address: business.landmark, city: business.city, country: business.country, contact_number: business.contact_number },
 *     party: { label: 'Customer', name: customerName, contact_number: customerPhone },
 *     seller: { name: `${profile.first_name} ${profile.last_name || ''}`, contact_number: profile.mobile_number },
 *     invoiceNumber: sale.id,
 *     date: sale.sale_date,
 *     columns: [
 *       { key: 'name', label: 'Product' },
 *       { key: 'quantity', label: 'Qty', align: 'right' },
 *       { key: 'unit_price', label: 'Unit Price', align: 'right', format: (r) => Number(r.unit_price).toFixed(2) },
 *       { key: 'line_total', label: 'Total', align: 'right', format: (r) => Number(r.line_total).toFixed(2) },
 *     ],
 *     rows: saleItemsWithProductNames,
 *     totals: [
 *       { label: 'Subtotal', value: sale.subtotal.toFixed(2) },
 *       { label: 'Discount', value: sale.discount_amount.toFixed(2) },
 *       { label: 'Tax', value: sale.tax_amount.toFixed(2) },
 *       { label: 'Grand Total', value: sale.grand_total.toFixed(2), emphasize: true },
 *       { label: 'Paid', value: sale.paid_amount.toFixed(2) },
 *       { label: 'Due', value: sale.due_amount.toFixed(2) },
 *     ],
 *   });
 */
export function printInvoice({
  documentType = 'Invoice',
  business = {},
  party = {},
  seller = {},
  invoiceNumber = '',
  date = '',
  columns = [],
  rows = [],
  totals = [],
  footerNote = '',
  saleNote = '',
} = {}) {
  const printWindow = window.open('', '_blank', 'width=850,height=1100');
  if (!printWindow) {
    // Popup blockers are common — fail loudly instead of silently doing nothing.
    window.alert('Your browser blocked the print window. Please allow pop-ups for this site and try again.');
    return;
  }

  const html = buildInvoiceHtml({ documentType, business, party, seller, invoiceNumber, date, columns, rows, totals, footerNote, saleNote });

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

// ---------------------------------------------------------------------------
// Convenience wrappers for the two document types this app actually has.
// Thin presets over printInvoice() — use these for the common case, drop to
// printInvoice() directly when you need different columns/totals.
// ---------------------------------------------------------------------------

export function printSaleInvoice({ business, sale, items, customer, seller, footerNote, saleNote }) {
  printInvoice({
    documentType: 'Sales Invoice',
    business,
    party: { label: 'Customer', name: customer?.name || 'Walk-in', contact_number: customer?.contact_number },
    seller,
    invoiceNumber: sale.id,
    date: sale.sale_date,
    columns: [
      { key: 'product_name', label: 'Product' },
      { key: 'quantity', label: 'Qty', align: 'right' },
      { key: 'unit_price', label: 'Unit Price', align: 'right', format: (r) => Number(r.unit_price).toFixed(2) },
      { key: 'discount_amount', label: 'Discount', align: 'right', format: (r) => Number(r.discount_amount || 0).toFixed(2) },
      { key: 'line_total', label: 'Total', align: 'right', format: (r) => Number(r.line_total).toFixed(2) },
    ],
    rows: items,
    totals: [
      { label: 'Subtotal', value: Number(sale.subtotal).toFixed(2) },
      { label: 'Discount', value: Number(sale.discount_amount).toFixed(2) },
      { label: 'Tax', value: Number(sale.tax_amount).toFixed(2) },
      { label: 'Shipping', value: Number(sale.shipping_charges).toFixed(2) },
      { label: 'Grand Total', value: Number(sale.grand_total).toFixed(2), emphasize: true },
      { label: 'Paid', value: Number(sale.paid_amount).toFixed(2) },
      { label: 'Due', value: Number(sale.due_amount).toFixed(2) },
    ],
    footerNote,
    saleNote,
  });
}

export function printPurchaseInvoice({ business, purchase, items, supplier, seller, footerNote }) {
  const due = Number(purchase.grand_total) - Number(purchase.advance_payment);
  printInvoice({
    documentType: 'Purchase Invoice',
    business,
    party: { label: 'Supplier', name: supplier?.name || 'Cash / unspecified', contact_number: supplier?.contact_number },
    seller,
    invoiceNumber: purchase.id,
    date: purchase.purchase_date,
    columns: [
      { key: 'product_name', label: 'Product' },
      { key: 'quantity', label: 'Qty', align: 'right' },
      { key: 'unit_cost', label: 'Unit Cost', align: 'right', format: (r) => Number(r.unit_cost).toFixed(2) },
      { key: 'discount_amount', label: 'Discount', align: 'right', format: (r) => Number(r.discount_amount || 0).toFixed(2) },
      { key: 'line_total', label: 'Total', align: 'right', format: (r) => Number(r.line_total).toFixed(2) },
    ],
    rows: items,
    totals: [
      { label: 'Subtotal', value: Number(purchase.subtotal).toFixed(2) },
      { label: 'Discount', value: Number(purchase.discount_amount).toFixed(2) },
      { label: 'Tax', value: Number(purchase.tax_amount).toFixed(2) },
      { label: 'Shipping', value: Number(purchase.shipping_charges).toFixed(2) },
      { label: 'Grand Total', value: Number(purchase.grand_total).toFixed(2), emphasize: true },
      { label: 'Paid', value: Number(purchase.advance_payment).toFixed(2) },
      { label: 'Due', value: due.toFixed(2) },
    ],
    footerNote,
  });
}

// ---------------------------------------------------------------------------
// HTML generation — self-contained (inline CSS), since a new window has no
// access to the app's bundled stylesheet.
// ---------------------------------------------------------------------------

function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildInvoiceHtml({ documentType, business, party, seller, invoiceNumber, date, columns, rows, totals, footerNote, saleNote }) {
  const addressLine = [business.address, business.city, business.country].filter(Boolean).join(', ');

  const theadCells = columns.map((c) => `<th style="text-align:${c.align || 'left'}">${esc(c.label)}</th>`).join('');
  const tbodyRows = rows.map((row) => {
    const cells = columns.map((c) => {
      const raw = typeof c.format === 'function' ? c.format(row) : row[c.key];
      return `<td style="text-align:${c.align || 'left'}">${esc(raw)}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  const totalsRows = totals.map((t) => `
    <tr class="${t.emphasize ? 'grand' : ''}">
      <td class="totals-label">${esc(t.label)}</td>
      <td class="totals-value">${esc(t.value)}</td>
    </tr>
  `).join('');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(documentType)}${invoiceNumber ? ' #' + esc(invoiceNumber) : ''}</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #1a1d29;
    margin: 0;
    padding: 28px;
  }
  .invoice { max-width: 720px; margin: 0 auto; }
  .biz-name { text-align: center; font-size: 23px; font-weight: 800; color: #1D2545; }
  .biz-address, .biz-contact { text-align: center; font-size: 13px; color: #5b6072; margin-top: 2px; }
  .doc-title {
    text-align: center; font-size: 14px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.08em; color: #1D2545; margin: 18px 0 16px;
    padding-top: 14px; border-top: 2px solid #1D2545;
  }
  .meta-grid { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 20px; }
  .meta-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #8a8fa3; font-weight: 700; margin-bottom: 2px; }
  .meta-value { font-size: 14px; font-weight: 700; color: #1a1d29; }
  .meta-sub { font-size: 12px; color: #5b6072; margin-top: 1px; }
  .meta-row { display: flex; justify-content: space-between; gap: 20px; font-size: 13px; margin-bottom: 4px; }
  .meta-row span { color: #5b6072; }
  .meta-row strong { color: #1a1d29; }
  table.items { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  table.items th {
    background: #f2f3f8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em;
    color: #5b6072; padding: 8px 10px; border-bottom: 2px solid #d9dcea;
  }
  table.items td { padding: 8px 10px; border-bottom: 1px solid #e7e9f1; font-size: 13px; }
  table.totals { width: 100%; max-width: 280px; margin-left: auto; border-collapse: collapse; margin-top: 10px; }
  table.totals td { padding: 4px 4px; font-size: 13px; }
  .totals-label { text-align: right; color: #5b6072; padding-right: 16px !important; }
  .totals-value { text-align: right; font-weight: 700; color: #1a1d29; }
  tr.grand td { border-top: 2px solid #1D2545; padding-top: 8px !important; font-size: 15px; font-weight: 800; color: #1D2545; }
  .footer-note { margin-top: 26px; font-size: 12px; color: #5b6072; text-align: center; font-style: italic; }
  .sale-note {
    margin-top: 18px; padding: 10px 14px; border-left: 3px solid #1D2545;
    background: #f5f6fb; font-size: 13px; color: #1a1d29; border-radius: 0 4px 4px 0;
    white-space: pre-wrap; word-break: break-word;
  }
  .sale-note-label { font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; color: #8a8fa3; display: block; margin-bottom: 4px; }
  .seller-footer {
    margin-top: 34px; padding-top: 12px; border-top: 1px solid #e7e9f1;
    display: flex; justify-content: space-between; font-size: 12px; color: #5b6072;
  }
  .seller-footer .label { text-transform: uppercase; font-size: 10px; letter-spacing: 0.04em; color: #8a8fa3; margin-bottom: 2px; }
  @media print {
    body { padding: 0; }
  }
</style>
</head>
<body>
  <div class="invoice">
    <div class="biz-eyebrow" style="text-align: center; font-size: 13px; font-weight: 800; color: #1D2545; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 2px;">PASHA TRADERS APP</div>
    <div class="biz-name">${esc(business.name || business.business_name || 'Pasha Traders')}</div>
    ${addressLine ? `<div class="biz-address">${esc(addressLine)}</div>` : ''}
    ${business.contact_number ? `<div class="biz-contact">${esc(business.contact_number)}</div>` : ''}

    <div class="doc-title">${esc(documentType)}</div>

    <div class="meta-grid">
      <div>
        <div class="meta-label">${esc(party.label || 'Customer')}</div>
        <div class="meta-value">${esc(party.name || 'Walk-in')}</div>
        ${party.contact_number ? `<div class="meta-sub">${esc(party.contact_number)}</div>` : ''}
      </div>
      <div>
        <div class="meta-row"><span>Invoice #</span><strong>${esc(invoiceNumber)}</strong></div>
        <div class="meta-row"><span>Date</span><strong>${esc(date)}</strong></div>
        ${seller.name ? `<div class="meta-row"><span>Served by</span><strong>${esc(seller.name)}</strong></div>` : ''}
      </div>
    </div>

    <table class="items">
      <thead><tr>${theadCells}</tr></thead>
      <tbody>${tbodyRows}</tbody>
    </table>

    <table class="totals">
      ${totalsRows}
    </table>

    ${footerNote ? `<div class="footer-note">${esc(footerNote)}</div>` : ''}

    ${saleNote ? `
    <div class="sale-note">
      <span class="sale-note-label">Note:</span>
      ${esc(saleNote)}
    </div>` : ''}

    ${(seller.name || seller.contact_number) ? `
    <div class="seller-footer">
      <div>
        <div class="label">Served by</div>
        <div>${esc(seller.name)}</div>
      </div>
      ${seller.contact_number ? `
      <div style="text-align:right">
        <div class="label">Contact</div>
        <div>${esc(seller.contact_number)}</div>
      </div>` : ''}
    </div>` : ''}
  </div>
  <script>
    window.onload = function () {
      window.focus();
      window.print();
    };
  </script>
</body>
</html>`;
}
