import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';
import AppLayout from '../components/AppLayout.jsx';

export default function ActiveRegisterRedirect() {
  const { business } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!business?.id) return;

    supabase
      .from('registers')
      .select('id')
      .eq('business_id', business.id)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error && data?.id) {
          navigate(`/registers/${data.id}`, { replace: true });
        } else {
          // If no register is currently open, fallback to the list
          navigate('/registers', { replace: true });
        }
      });
  }, [business?.id, navigate]);

  return (
    <AppLayout>
      <div className="muted" style={{ padding: '20px' }}>
        Finding active register…
      </div>
    </AppLayout>
  );
}
