import { useEffect, useState } from 'react';
import SettingsLayout from '../components/SettingsLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';
import Pagination from '../components/Pagination.jsx';
import usePagination from '../hooks/usePagination.js';

export default function Categories() {
  const { business } = useAuth();
  const [rows, setRows] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    if (!business?.id) return;
    setLoading(true);
    const { data } = await supabase.from('categories').select('*').eq('business_id', business.id).order('name');
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [business?.id]);

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError('');
    const { error: err } = await supabase.from('categories').insert({ business_id: business.id, name: name.trim() });
    if (err) setError(err.message);
    else { setName(''); load(); }
  };

  const remove = async (id) => {
    const { error: err } = await supabase.from('categories').delete().eq('id', id);
    if (err) setError('Cannot delete — one or more products still use this category.');
    else load();
  };

  const { currentPage, totalPages, totalItems, paginatedItems, firstItemIndex, lastItemIndex, goToPage, nextPage, previousPage, hasNextPage, hasPreviousPage } = usePagination(rows, 20);

  return (
    <SettingsLayout title="Product Categories" subtitle="Organize your product catalog into groups.">
      <div className="settings-card">
        <div className="settings-card-header">
          <form onSubmit={add} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input 
              className="settings-input" 
              placeholder="New category name" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              style={{ maxWidth: '300px' }}
            />
            <button className="btn btn-primary" type="submit" style={{ whiteSpace: 'nowrap' }}>Add Category</button>
          </form>
          {error && <div className="error-text" style={{ marginTop: '12px' }}>{error}</div>}
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th style={{ width: '100px' }}></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={2} className="muted table-empty">Loading…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={2} className="muted table-empty">No categories yet.</td></tr>}
              {!loading && paginatedItems.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td className="table-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => remove(r.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && rows.length > 0 && (
          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-light)' }}>
            <Pagination
              currentPage={currentPage} totalPages={totalPages} totalItems={totalItems}
              firstItemIndex={firstItemIndex} lastItemIndex={lastItemIndex}
              goToPage={goToPage} nextPage={nextPage} previousPage={previousPage}
              hasNextPage={hasNextPage} hasPreviousPage={hasPreviousPage}
            />
          </div>
        )}
      </div>
    </SettingsLayout>
  );
}
