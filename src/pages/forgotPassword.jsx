import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import './login.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (err) setError(err.message);
    else setSent(true);
  };

  return (
    <div className="auth-screen">
      <div className="auth-card card">
        <div className="auth-brand">
          <div className="auth-brand-mark">P</div>
          <span>POS Suite</span>
        </div>
        <h1 className="auth-title">Reset your password</h1>
        <p className="auth-subtitle muted">We'll email you a link to set a new password.</p>

        {sent ? (
          <div className="badge badge-success" style={{ padding: '10px 14px' }}>
            Check your inbox for a reset link.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            {error && <div className="error-text">{error}</div>}
            <button type="submit" className="btn btn-primary auth-submit" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <p className="auth-footer muted">
          <Link to="/login" className="auth-link">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
