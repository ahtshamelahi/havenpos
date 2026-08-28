import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';
import AppLayout from '../components/AppLayout.jsx';
import RegisterReport from './registerReport.jsx';
import { OpenRegisterModal } from '../components/pos/RegisterModals.jsx';
import useRegister from '../hooks/useRegister.js';

/**
 * ActiveRegister — "my register, right now".
 *
 * Delegates entirely to useRegister() for the open/closed state (the same
 * hook posBilling.jsx uses), so there's exactly one place that decides
 * whether the current user has an open register — no duplicated queries
 * that can drift out of sync with each other.
 */
export default function ActiveRegister() {
  const { business } = useAuth();
  const { register, loading, openRegister, refresh } = useRegister();

  const [showOpenModal, setShowOpenModal] = useState(false);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!business?.id) return;

    supabase
      .from('locations')
      .select('id, name')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .then(({ data }) => {
        setLocations(data || []);
        if (data?.length > 0) setSelectedLocation(String(data[0].id));
      });
  }, [business?.id]);

  const handleOpenRegister = async (cash) => {
    setSubmitting(true);
    setError('');
    try {
      await openRegister(selectedLocation, cash);
      setShowOpenModal(false);
    } catch (err) {
      setError(err.message || 'Could not open register.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="muted" style={{ padding: '20px' }}>Loading active register…</div>
      </AppLayout>
    );
  }

  if (register) {
    return (
      <AppLayout>
        <RegisterReport
          registerId={register.id}
          hideLayout
          isSidebarView
          onRegisterClosed={refresh}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1>Active Register</h1>
          <p className="muted">You don't have an open register right now.</p>
        </div>
      </div>

      <div className="card" style={{ padding: '40px 20px', textAlign: 'center', maxWidth: 500, margin: '40px auto' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📠</div>
        <h2 style={{ marginBottom: 12 }}>No open register</h2>
        <p className="muted" style={{ marginBottom: 24 }}>
          A register must be open before you can process sales and track cash.
          Registers belong to you personally — no one else's open register
          counts here.
        </p>

        {locations.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Location</label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              style={{ maxWidth: 220, margin: '0 auto', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--navy-border)' }}
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
        )}

        {error && <div className="error-text" style={{ marginBottom: 16 }}>{error}</div>}

        <button
          className="btn btn-primary"
          onClick={() => setShowOpenModal(true)}
          disabled={!selectedLocation}
        >
          Open register
        </button>
      </div>

      {showOpenModal && (
        <OpenRegisterModal
          locationName={locations.find((l) => String(l.id) === String(selectedLocation))?.name || 'Selected Location'}
          submitting={submitting}
          onConfirm={handleOpenRegister}
          onCancel={() => setShowOpenModal(false)}
        />
      )}
    </AppLayout>
  );
}
