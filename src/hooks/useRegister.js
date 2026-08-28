import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * useRegister — tracks the CURRENT USER's single open register.
 *
 * A register now belongs to whoever opened it (enforced by the partial
 * unique index uq_registers_one_open_per_user in the DB): each user can
 * have at most one open register at a time, at any one location. Two
 * different cashiers CAN have separate open registers at the same
 * location — the drawer belongs to the person, not the terminal.
 *
 * Because of that, this hook takes no `locationId` argument for reading —
 * it always resolves to "my open register", full stop. `locationId` is
 * only needed when actually opening a new one (see openRegister below).
 */
export default function useRegister() {
  const { business, profile } = useAuth();
  const [register, setRegister] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!business?.id || !profile?.id) {
      setRegister(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const { data, error: err } = await supabase
      .from('registers')
      .select('*')
      .eq('business_id', business.id)
      .eq('user_id', profile.id)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (err) {
      setError(err.message);
      setRegister(null);
    } else {
      setRegister(data || null);
    }

    setLoading(false);
  }, [business?.id, profile?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openRegister = useCallback(
    async (locationId, openingCash) => {
      if (!business?.id || !locationId || !profile?.id) {
        throw new Error('Missing business, location, or user — cannot open a register.');
      }

      const { data, error: err } = await supabase
        .from('registers')
        .insert({
          business_id: business.id,
          location_id: locationId,
          user_id: profile.id,
          opening_cash: Number(openingCash) || 0,
          status: 'open',
        })
        .select()
        .single();

      if (err) {
        // Most likely cause: this user already has an open register
        // somewhere (uq_registers_one_open_per_user). Re-sync so the UI
        // picks up the real state instead of staying stuck.
        await refresh();
        throw err;
      }

      setRegister(data);
      return data;
    },
    [business?.id, profile?.id, refresh]
  );

  const closeRegister = useCallback(
    async (closingCash) => {
      if (!register?.id) throw new Error('No open register to close.');

      const { data, error: err } = await supabase
        .from('registers')
        .update({
          closing_cash: Number(closingCash) || 0,
          status: 'closed',
          closed_at: new Date().toISOString(),
        })
        .eq('id', register.id)
        .select()
        .single();

      if (err) throw err;

      setRegister(null);
      return data;
    },
    [register?.id]
  );

  return { register, loading, error, refresh, openRegister, closeRegister };
}
