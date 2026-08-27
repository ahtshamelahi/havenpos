import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';
import './login.css';

export default function ResetPassword() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  const [linkError, setLinkError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Supabase puts a machine-readable error in the URL hash when a
    // recovery link is expired or was already used, instead of granting a
    // session — surface that instead of a silent, confusing form.
    const hash = new URLSearchParams(window.location.hash.replace('#', ''));
    const errDescription = hash.get('error_description');
    if (errDescription) setLinkError(errDescription.replace(/\+/g, ' '));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }

    setSubmitting(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Could not update your password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card card">
        <div className="auth-brand">
          <div className="auth-brand-mark">P</div>
          <span>POS Suite</span>
        </div>
        <h1 className="auth-title">Set a new password</h1>

        {loading ? (
          <p className="auth-subtitle muted">Checking your reset link…</p>
        ) : linkError || !session ? (
          <>
            <p className="auth-subtitle muted">
              {linkError || 'This reset link is invalid or has expired.'}
            </p>
            <Link to="/forgot-password" className="btn btn-primary auth-submit" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
              Request a new link
            </Link>
          </>
        ) : (
          <>
            <p className="auth-subtitle muted">Choose a new password for your account.</p>
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="field">
                <label htmlFor="password">New password</label>
                <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
              </div>
              <div className="field">
                <label htmlFor="confirm">Confirm new password</label>
                <input id="confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
              </div>
              {error && <div className="error-text">{error}</div>}
              <button type="submit" className="btn btn-primary auth-submit" disabled={submitting}>
                {submitting ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
