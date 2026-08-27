import { useEffect, useState } from 'react';
import SettingsLayout from '../components/SettingsLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';

export default function UserPreferences() {
  const { business, profile, refreshProfile } = useAuth();

  const [locations, setLocations] = useState([]);
  const [defaultLocationId, setDefaultLocationId] = useState('');
  const [prefSubmitting, setPrefSubmitting] = useState(false);
  const [prefSaved, setPrefSaved] = useState(false);
  const [prefError, setPrefError] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState('');

  useEffect(() => {
    if (!business?.id) return;
    supabase.from('locations').select('id, name').eq('business_id', business.id).eq('is_active', true).then(({ data }) => setLocations(data || []));
  }, [business?.id]);

  useEffect(() => {
    if (!profile) return;
    setDefaultLocationId(profile.custom_fields?.default_pos_location_id || '');
  }, [profile]);

  const savePreferences = async (e) => {
    e.preventDefault();
    setPrefError('');
    setPrefSubmitting(true);
    try {
      const mergedFields = { ...(profile.custom_fields || {}), default_pos_location_id: defaultLocationId || null };
      const { error: err } = await supabase.from('users').update({ custom_fields: mergedFields }).eq('id', profile.id);
      if (err) throw err;
      await refreshProfile();
      setPrefSaved(true);
    } catch (err) {
      setPrefError(err.message || 'Could not save preferences.');
    } finally {
      setPrefSubmitting(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSaved(false);
    if (newPassword.length < 8) { setPwError('Password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { setPwError('Passwords do not match.'); return; }

    setPwSubmitting(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password: newPassword });
      if (err) throw err;
      setNewPassword('');
      setConfirmPassword('');
      setPwSaved(true);
    } catch (err) {
      setPwError(err.message || 'Could not update password.');
    } finally {
      setPwSubmitting(false);
    }
  };

  return (
    <SettingsLayout title="My Preferences" subtitle="Personal settings and security for your account.">
      
      <form onSubmit={savePreferences} className="settings-form" style={{ marginBottom: 24 }}>
        <section className="settings-card">
          <div className="settings-card-header">
            <h2>POS Defaults</h2>
          </div>
          <div className="settings-card-body">
            <div className="settings-grid">
              <div className="settings-field">
                <label>Default POS location</label>
                <select className="settings-select" value={defaultLocationId} onChange={(e) => { setDefaultLocationId(e.target.value); setPrefSaved(false); }}>
                  <option value="">No default — ask each time</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            </div>
            {prefError && <div className="error-text" style={{ marginTop: 14 }}>{prefError}</div>}
          </div>
          <div className="settings-actions">
            {prefSaved && <span className="badge badge-success" style={{ marginRight: 'auto', padding: '6px 12px' }}>Saved.</span>}
            <button type="submit" className="btn btn-primary" disabled={prefSubmitting}>{prefSubmitting ? 'Saving…' : 'Save preferences'}</button>
          </div>
        </section>
      </form>

      <form onSubmit={changePassword} className="settings-form">
        <section className="settings-card">
          <div className="settings-card-header">
            <h2>Change Password</h2>
          </div>
          <div className="settings-card-body">
            <div className="settings-grid">
              <div className="settings-field">
                <label>New password</label>
                <input className="settings-input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              <div className="settings-field">
                <label>Confirm new password</label>
                <input className="settings-input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>
            </div>
            {pwError && <div className="error-text" style={{ marginTop: 14 }}>{pwError}</div>}
          </div>
          <div className="settings-actions">
            {pwSaved && <span className="badge badge-success" style={{ marginRight: 'auto', padding: '6px 12px' }}>Password updated.</span>}
            <button type="submit" className="btn btn-primary" disabled={pwSubmitting}>{pwSubmitting ? 'Updating…' : 'Update password'}</button>
          </div>
        </section>
      </form>

    </SettingsLayout>
  );
}
