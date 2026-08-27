import {
  STATUS_BADGE,
  formatMoney,
  getExpenseStatus,
  getExpenseTitle,
} from '../../lib/expenseUtils.js';

function DetailItem({ label, children }) {
  return (
    <div className="expense-detail-item">
      <label>{label}</label>
      <p>{children}</p>
    </div>
  );
}

export default function ExpenseViewDrawer({
  open,
  expense,
  onClose,
  onEdit,
  categories,
  locations,
  currency,
  canEdit,
}) {
  if (!open || !expense) return null;

  const title = getExpenseTitle(expense, categories);
  const status = getExpenseStatus(expense);

  return (
    <>
      <div className="expense-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="expense-drawer-wrap" role="dialog" aria-modal="true" aria-labelledby="expense-drawer-title">
        <div className="expense-drawer-panel" onClick={(e) => e.stopPropagation()}>
          <div className="expense-drawer-header">
            <div>
              <h2 id="expense-drawer-title">{title}</h2>
              <p className="muted">Expense #{expense.id}</p>
            </div>
            <button type="button" className="expense-close-btn" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>

          <div className="expense-drawer-body">
            <div className="expense-detail-item" style={{ marginBottom: 18 }}>
              <label>Amount</label>
              <p className="expense-detail-amount">{formatMoney(currency, expense.amount)}</p>
            </div>

            <div className="expense-detail-grid">
              <DetailItem label="Status">
                <span className={`badge ${STATUS_BADGE[status] || 'badge-info'}`} style={{ textTransform: 'capitalize' }}>
                  {status}
                </span>
              </DetailItem>

              <DetailItem label="Category">
                {categories[expense.category_id] || '—'}
              </DetailItem>

              <DetailItem label="Business location">
                {locations[expense.location_id] || '—'}
              </DetailItem>

              <DetailItem label="Expense date">
                {expense.expense_date || '—'}
              </DetailItem>

              <DetailItem label="Payment method">
                {expense.payment_method || '—'}
              </DetailItem>

              <DetailItem label="Vendor">
                {expense.vendor || '—'}
              </DetailItem>

              <DetailItem label="Reference number">
                {expense.reference_number || '—'}
              </DetailItem>

              <DetailItem label="Notes">
                {expense.note || '—'}
              </DetailItem>
            </div>
          </div>

          <div className="expense-drawer-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
            {canEdit && (
              <button type="button" className="btn btn-primary" onClick={() => onEdit?.(expense)}>
                Edit expense
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export function DeleteExpenseDialog({
  open,
  expense,
  onClose,
  onConfirm,
  deleting,
  categories,
}) {
  if (!open || !expense) return null;

  const title = getExpenseTitle(expense, categories);

  return (
    <>
      <div className="expense-backdrop" onClick={() => !deleting && onClose?.()} aria-hidden="true" />
      <div className="expense-modal" role="dialog" aria-modal="true" aria-labelledby="delete-expense-title">
        <div className="expense-modal-panel expense-delete-panel" onClick={(e) => e.stopPropagation()}>
          <div className="expense-modal-header">
            <div>
              <h2 id="delete-expense-title">Delete expense?</h2>
              <p className="muted">This action cannot be undone.</p>
            </div>
            <button
              type="button"
              className="expense-close-btn"
              onClick={() => !deleting && onClose?.()}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="expense-modal-body">
            <p>
              You are about to delete <strong>{title}</strong> (Expense #{expense.id}).
              Reports and dashboard totals will update after deletion.
            </p>
          </div>

          <div className="expense-modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => onClose?.()} disabled={deleting}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={() => onConfirm?.()} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete expense'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}