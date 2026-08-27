import { getPresetRange } from './dateRanges.js';
import { todayLocal } from './timezone.js';

export const EXPENSE_PAYMENT_METHODS = [
  'Cash',
  'Bank',
  'JazzCash',
  'EasyPaisa',
  'Card',
  'Cheque',
];

export const EXPENSE_DATE_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_week', label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'this_year', label: 'This Year' },
  { key: 'custom', label: 'Custom' },
];

export const STATUS_BADGE = {
  pending: 'badge-warning',
  paid: 'badge-success',
};

export function getExpenseStatus(row) {
  if (row?.status) return row.status;
  return row?.payment_method ? 'paid' : 'pending';
}

export function getExpenseTitle(row, categories = {}) {
  if (row?.title?.trim()) return row.title.trim();
  if (row?.note?.trim()) return row.note.trim();
  if (row?.category_id && categories[row.category_id]) {
    return categories[row.category_id];
  }
  return row?.id ? `Expense #${row.id}` : '—';
}

export function formatMoney(currency, amount) {
  return `${currency || ''} ${Number(amount || 0).toFixed(2)}`.trim();
}

export function sumAmounts(rows) {
  return (rows || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
}

export function matchesDatePreset(row, preset, customRange, tz) {
  if (!preset || preset === 'all') return true;

  const date = row.expense_date;
  if (!date) return false;

  if (preset === 'custom') {
    const { from, to } = customRange || {};
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  }

  const range = getPresetRange(preset, tz);
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}

export function buildExpensePayload(form, businessId) {
  return {
    business_id: businessId,
    location_id: form.location_id,
    category_id: form.category_id || null,
    expense_date: form.expense_date,
    amount: Number(form.amount),
    note: form.note?.trim() || null,
    payment_method: form.payment_method || null,
    title: form.title?.trim() || null,
    vendor: form.vendor?.trim() || null,
    reference_number: form.reference_number?.trim() || null,
    status: form.status || 'pending',
  };
}

export function exportExpensesCsv(rows, { categories, locations, currency, businessName, tz }) {
  const headers = [
    'Expense ID',
    'Title',
    'Category',
    'Location',
    'Date',
    'Amount',
    'Payment Method',
    'Status',
    'Vendor',
    'Reference',
    'Notes',
  ];

  const escape = (value) => {
    const str = String(value ?? '');
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };

  const lines = rows.map((row) => [
    row.id,
    getExpenseTitle(row, categories),
    categories[row.category_id] || '',
    locations[row.location_id] || '',
    row.expense_date || '',
    Number(row.amount || 0).toFixed(2),
    row.payment_method || '',
    getExpenseStatus(row),
    row.vendor || '',
    row.reference_number || '',
    row.note || '',
  ].map(escape).join(','));

  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${(businessName || 'business').replace(/\s+/g, '-').toLowerCase()}-expenses-${todayLocal(tz)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export const emptyExpenseForm = (tz) => ({
  title: '',
  category_id: '',
  location_id: '',
  expense_date: todayLocal(tz),
  amount: '',
  payment_method: '',
  vendor: '',
  reference_number: '',
  note: '',
  status: 'pending',
});

export function expenseToForm(data, tz) {
  if (!data) return emptyExpenseForm(tz);
  return {
    title: data.title || '',
    category_id: data.category_id || '',
    location_id: data.location_id || '',
    expense_date: data.expense_date || todayLocal(tz),
    amount: data.amount != null ? String(data.amount) : '',
    payment_method: data.payment_method || '',
    vendor: data.vendor || '',
    reference_number: data.reference_number || '',
    note: data.note || '',
    status: getExpenseStatus(data),
  };
}