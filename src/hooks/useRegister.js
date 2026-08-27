import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * useRegister — tracks the single OPEN register for a given location.
 *
 * A location has at most one open register at a time (enforced by the
 * partial unique index uq_registers_one_open_per_location in the DB).
 * Whoever is at the POS terminal for that location shares that register,
 * regardless of which staff member is currently logged in — the same way
 * posBilling.jsx already scopes stock/cart state to `locationId` rather
 * than to the logged-in user.
 */
export default function useRegister(locationId) {
  const { business, profile } = useAuth();
  const [register, setRegister] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!business?.id || !locationId) {
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
      .eq('location_id', locationId)
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
  }, [business?.id, locationId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openRegister = useCallback(
    async (openingCash) => {
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
        // Most likely cause: someone else already opened a register for
        // this location (uq_registers_one_open_per_location). Re-sync so
        // the UI picks up the real state instead of staying stuck.
        await refresh();
        throw err;
      }

      setRegister(data);
      return data;
    },
    [business?.id, locationId, profile?.id, refresh]
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
