import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';
import AppLayout from '../components/AppLayout.jsx';
import RegisterReport from './registerReport.jsx';
import { OpenRegisterModal } from '../components/pos/RegisterModals.jsx';

export default function ActiveRegister() {
  const { business, profile } = useAuth();
  const navigate = useNavigate();
  const [activeRegId, setActiveRegId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!business?.id) return;

    async function load() {
      setLoading(true);
      // Get locations
      const { data: locs } = await supabase
        .from('locations')
        .select('*')
        .eq('business_id', business.id);
      
      setLocations(locs || []);
      if (locs?.length > 0) setSelectedLocation(locs[0].id);

      // Get open register
      const { data: openReg } = await supabase
        .from('registers')
        .select('id')
        .eq('business_id', business.id)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (openReg?.id) {
        setActiveRegId(openReg.id);
      }
      setLoading(false);
    }
    
    load();
  }, [business?.id]);

  const handleOpenRegister = async (cash) => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('registers')
        .insert({
          business_id: business.id,
          location_id: selectedLocation,
          user_id: profile.id,
          opening_cash: Number(cash) || 0,
          status: 'open',
        })
        .select()
        .single();

      if (error) throw error;
      setActiveRegId(data.id);
      setShowOpenModal(false);
    } catch (err) {
      alert(err.message || 'Could not open register.');
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

  if (activeRegId) {
    return (
      <AppLayout>
        <RegisterReport 
          registerId={activeRegId} 
          hideLayout={true} 
          isSidebarView={true}
          onRegisterClosed={() => setActiveRegId(null)}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1>Active Register</h1>
          <p className="muted">You don't have any open registers right now.</p>
        </div>
      </div>

      <div className="card" style={{ padding: '40px 20px', textAlign: 'center', maxWidth: 500, margin: '40px auto' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📠</div>
        <h2 style={{ marginBottom: 12 }}>No Open Register</h2>
        <p className="muted" style={{ marginBottom: 24 }}>
          A register must be open to process sales and track cash. 
        </p>
        
        {locations.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Select Location:</label>
            <select 
              value={selectedLocation} 
              onChange={e => setSelectedLocation(e.target.value)}
              className="input"
              style={{ maxWidth: 200, margin: '0 auto', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--navy-border)' }}
            >
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
        )}

        <button 
          className="btn btn-primary" 
          onClick={() => setShowOpenModal(true)}
          disabled={!selectedLocation}
        >
          Open New Register
        </button>
      </div>

      {showOpenModal && (
        <OpenRegisterModal
          locationName={locations.find(l => String(l.id) === String(selectedLocation))?.name || 'Selected Location'}
          submitting={submitting}
          onConfirm={handleOpenRegister}
          onCancel={() => setShowOpenModal(false)}
        />
      )}
    </AppLayout>
  );
}
