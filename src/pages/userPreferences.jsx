import { useState } from 'react';
import SettingsLayout from '../components/SettingsLayout.jsx';
import { supabase } from '../lib/supabaseClient';

export default function UserPreferences() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState('');

  const changePassword = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSaved(false);

    if (newPassword.length < 8) {
      setPwError('Password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match.');
      return;
    }

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
    <SettingsLayout title="My Security" subtitle="Update your account password and security settings.">
      <form onSubmit={changePassword} className="settings-form">
        <section className="settings-card">
          <div className="settings-card-header">
            <h2>Change Password</h2>
          </div>
          <div className="settings-card-body">
            <div className="settings-grid">
              <div className="settings-field">
                <label>New password</label>
                <input
                  className="settings-input"
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setPwSaved(false);
                  }}
                />
              </div>
              <div className="settings-field">
                <label>Confirm new password</label>
                <input
                  className="settings-input"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setPwSaved(false);
                  }}
                />
              </div>
            </div>
            {pwError && <div className="error-text" style={{ marginTop: 14 }}>{pwError}</div>}
          </div>
          <div className="settings-actions">
            {pwSaved && (
              <span className="badge badge-success" style={{ marginRight: 'auto', padding: '6px 12px' }}>
                Password updated successfully.
              </span>
            )}
            <button type="submit" className="btn btn-primary" disabled={pwSubmitting}>
              {pwSubmitting ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </section>
      </form>
    </SettingsLayout>
  );
}
