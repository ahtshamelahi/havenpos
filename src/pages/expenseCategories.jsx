import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';
import './expenses.css';
import './lookupList.css';

export default function ExpenseCategories() {
  const { business, profile, can } = useAuth();
  const [rows, setRows] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [editRow, setEditRow] = useState(null);
  const [editName, setEditName] = useState('');
  const [deleteRow, setDeleteRow] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const canEdit = profile?.is_owner || can('expenses', 'edit');

  const load = async () => {
    if (!business?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('expense_categories')
      .select('*')
      .eq('business_id', business.id)
      .order('name');
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [business?.id]);

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (!business?.id) {
      setError('Business data not loaded yet. Please wait and try again.');
      return;
    }

    setError('');
    setSubmitting(true);

    const { error: err } = await supabase
      .from('expense_categories')
      .insert({ business_id: business.id, name: name.trim() })
      .select();

    setSubmitting(false);

    if (err) setError(err.message);
    else {
      setName('');
      load();
    }
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editRow || !editName.trim()) return;
    setError('');
    setSubmitting(true);
    const { error: err } = await supabase
      .from('expense_categories')
      .update({ name: editName.trim() })
      .eq('id', editRow.id);
    setSubmitting(false);
    if (err) setError(err.message);
    else {
      setEditRow(null);
      setEditName('');
      load();
    }
  };

  const confirmDelete = async () => {
    if (!deleteRow) return;
    setDeleting(true);
    setError('');
    const { error: err } = await supabase
      .from('expense_categories')
      .delete()
      .eq('id', deleteRow.id);
    setDeleting(false);
    if (err) {
      setError('Cannot delete — one or more expenses still use this category.');
    } else {
      setDeleteRow(null);
      load();
    }
  };

  const openEdit = (row) => {
    setEditRow(row);
    setEditName(row.name);
    setDeleteRow(null);
  };

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1>Expense categories</h1>
          <p className="muted">
            Organize operational expenses — rent, utilities, salaries, marketing, and more.
          </p>
        </div>
        <Link to="/expenses" className="btn btn-secondary">Back to expenses</Link>
      </div>

      <div className="expense-categories-layout">
        <section className="card expense-category-form-card">
          <h2>Add category</h2>
          <form onSubmit={add}>
            <div className="field">
              <label>Category name</label>
              <input
                placeholder="e.g. Rent, Electricity, Salaries"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError('');
                }}
                disabled={!canEdit}
              />
            </div>
            {canEdit && (
              <button
                className="btn btn-primary btn-sm"
                type="submit"
                disabled={submitting || !name.trim()}
                style={{ marginTop: 12 }}
              >
                {submitting ? 'Adding…' : 'Add category'}
              </button>
            )}
          </form>
        </section>

        <section className="card expense-category-list-card">
          {error && <div className="error-text" style={{ padding: '12px 16px 0' }}>{error}</div>}
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={2} className="muted table-empty">Loading…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={2} className="muted table-empty">No expense categories yet.</td></tr>
              )}
              {!loading && rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td className="table-actions">
                    {canEdit && (
                      <>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(row)}>
                          Edit
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDeleteRow(row)}>
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {editRow && (
        <>
          <div className="expense-backdrop" onClick={() => !submitting && setEditRow(null)} aria-hidden="true" />
          <div className="expense-modal" role="dialog" aria-modal="true">
            <div className="expense-modal-panel expense-delete-panel" onClick={(e) => e.stopPropagation()}>
              <div className="expense-modal-header">
                <div>
                  <h2>Edit category</h2>
                  <p className="muted">Update the category name used across expenses and reports.</p>
                </div>
                <button type="button" className="expense-close-btn" onClick={() => setEditRow(null)} aria-label="Close">
                  ×
                </button>
              </div>
              <form onSubmit={saveEdit}>
                <div className="expense-modal-body">
                  <div className="field">
                    <label>Category name</label>
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus required />
                  </div>
                </div>
                <div className="expense-modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setEditRow(null)} disabled={submitting}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {deleteRow && (
        <>
          <div className="expense-backdrop" onClick={() => !deleting && setDeleteRow(null)} aria-hidden="true" />
          <div className="expense-modal" role="dialog" aria-modal="true">
            <div className="expense-modal-panel expense-delete-panel" onClick={(e) => e.stopPropagation()}>
              <div className="expense-modal-header">
                <div>
                  <h2>Delete category?</h2>
                  <p className="muted">Categories in use by expenses cannot be removed.</p>
                </div>
                <button type="button" className="expense-close-btn" onClick={() => setDeleteRow(null)} aria-label="Close">
                  ×
                </button>
              </div>
              <div className="expense-modal-body">
                <p>Delete <strong>{deleteRow.name}</strong>? This cannot be undone.</p>
              </div>
              <div className="expense-modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setDeleteRow(null)} disabled={deleting}>
                  Cancel
                </button>
                <button type="button" className="btn btn-danger" onClick={confirmDelete} disabled={deleting}>
                  {deleting ? 'Deleting…' : 'Delete category'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
}