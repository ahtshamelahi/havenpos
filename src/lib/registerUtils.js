import { supabase as defaultClient } from './supabaseClient';

/**
 * registerUtils.js
 * ---------------------------------------------------------------------------
 * Nothing here is persisted. Every figure the Register Report shows (total
 * sales, cash/card split, refunds, expenses, expected cash, cash
 * difference, products sold) is derived on read from sales / sell_returns /
 * expenses / sale_items rows that carry a matching `register_id`.
 *
 * PAYMENT METHOD PARSING
 * ---------------------------------------------------------------------------
 * sales.payment_method and expenses.payment_method are free-text columns —
 * there's no structured tender-breakdown table. posBilling.jsx already
 * writes a small, fixed set of strings:
 *   'Cash'
 *   'Card'
 *   'Credit'
 *   'Cash <CUR> <amt> + Card <CUR> <amt>'   (split payment)
 * parseTenderBreakdown() reads those exact shapes. Anything else (Bank
 * transfer, JazzCash, EasyPaisa, Cheque, manual sales due-payment methods,
 * etc.) is treated as "other" — it didn't move the physical cash drawer.
 */

export function parseTenderBreakdown(paymentMethod, paidAmount) {
  const amount = Number(paidAmount || 0);
  const label = (paymentMethod || '').trim();

  if (!label || amount === 0) return { cash: 0, card: 0, other: 0 };

  if (label === 'Cash') return { cash: amount, card: 0, other: 0 };
  if (label === 'Card') return { cash: 0, card: amount, other: 0 };
  if (label === 'Credit') return { cash: 0, card: 0, other: 0 };

  if (label.includes('+')) {
    // Split payment, e.g. "Cash PKR 100.00 + Card PKR 50.00"
    const cashMatch = label.match(/Cash\s+\S*\s*([\d,]+\.?\d*)/i);
    const cardMatch = label.match(/Card\s+\S*\s*([\d,]+\.?\d*)/i);
    const cash = cashMatch ? Number(cashMatch[1].replace(/,/g, '')) : 0;
    const card = cardMatch ? Number(cardMatch[1].replace(/,/g, '')) : 0;
    const other = Math.max(amount - cash - card, 0);
    return { cash, card, other };
  }

  // Bank transfer / JazzCash / EasyPaisa / Cheque / anything unrecognized
  return { cash: 0, card: 0, other: amount };
}

/**
 * Builds the full Register Report summary from raw rows already scoped to
 * one register_id (see registerReport.jsx / CloseRegisterModal for the
 * queries that produce these arrays).
 */
export function computeRegisterSummary({
  register,
  sales = [],
  sellReturns = [],
  expenses = [],
  saleItems = [],
}) {
  const openingCash = Number(register?.opening_cash || 0);

  let totalSales = 0;
  let totalPayment = 0;
  let creditSales = 0;
  let cashSales = 0;
  let cardSales = 0;
  let otherTenderSales = 0;

  sales.forEach((s) => {
    totalSales += Number(s.grand_total || 0);
    totalPayment += Number(s.paid_amount || 0);
    creditSales += Number(s.due_amount || 0);

    const { cash, card, other } = parseTenderBreakdown(s.payment_method, s.paid_amount);
    cashSales += cash;
    cardSales += card;
    otherTenderSales += other;
  });

  const totalRefund = sellReturns.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);

  // sell_returns has no payment_method column of its own — refunds are
  // assumed to be paid out of the cash drawer, the common POS default.
  // If a refund tender method is ever captured, swap this for the same
  // parseTenderBreakdown() treatment used for sales/expenses.
  const cashRefunds = totalRefund;

  const totalExpense = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const cashExpenses = expenses
    .filter((e) => (e.payment_method || '').toLowerCase() === 'cash')
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const expectedCash = openingCash + cashSales - cashRefunds - cashExpenses;

  const actualClosingCash = register?.closing_cash != null ? Number(register.closing_cash) : null;
  const cashDifference = actualClosingCash != null ? actualClosingCash - expectedCash : null;

  // Products sold table — aggregated from sale_items across every sale in
  // this register session.
  const productMap = {};
  saleItems.forEach((it) => {
    const key = it.product_id;
    if (!productMap[key]) {
      productMap[key] = {
        product_id: key,
        name: it.products?.name || `Product #${key}`,
        sku: it.products?.sku || '—',
        quantity: 0,
        amount: 0,
      };
    }
    productMap[key].quantity += Number(it.quantity || 0);
    productMap[key].amount += Number(it.line_total || 0);
  });

  return {
    openingCash,
    totalSales,
    totalPayment,
    creditSales,
    totalRefund,
    totalExpense,
    cashSales,
    cardSales,
    otherTenderSales,
    cashRefunds,
    cashExpenses,
    expectedCash,
    actualClosingCash,
    cashDifference,
    productsSold: Object.values(productMap).sort((a, b) => a.name.localeCompare(b.name)),
    saleCount: sales.length,
    refundCount: sellReturns.length,
    expenseCount: expenses.length,
  };
}

/**
 * Looks up the currently OPEN register id for a location, or null.
 * Use this at the point a sale/return/expense is created outside of
 * PosBilling.jsx (which already holds `register` in state via useRegister)
 * so that transaction still gets tagged with the right register_id.
 *
 * @param {object} supabase - pass the shared client (defaults to the app's)
 */
export async function getOpenRegisterId(businessId, locationId, supabase = defaultClient) {
  if (!businessId || !locationId) return null;

  const { data } = await supabase
    .from('registers')
    .select('id')
    .eq('business_id', businessId)
    .eq('location_id', locationId)
    .eq('status', 'open')
    .maybeSingle();

  return data?.id || null;
}
