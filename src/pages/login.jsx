import { useState } from 'react';

import {
  Link,
  useNavigate,
  useLocation,
} from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';

import './login.css';

export default function Login() {
  const { signIn } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] =
    useState('');

  const [error, setError] =
    useState('');

  const [submitting, setSubmitting] =
    useState(false);

  const [showPassword, setShowPassword] =
    useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    /*
     * Prevent double-clicking the login button.
     */
    if (submitting) {
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      /*
       * Supabase authentication.
       *
       * AuthContext's onAuthStateChange()
       * handles the session/profile loading.
       */
      await signIn(
        email.trim(),
        password
      );

      /*
       * Navigate after successful authentication.
       *
       * If AuthContext is still loading the profile,
       * ProtectedRoute will simply show "Loading…"
       * instead of redirecting back to /login.
       */
      const redirectTo =
        location.state?.from ||
        '/dashboard';

      navigate(
        redirectTo,
        { replace: true }
      );
    } catch (err) {
      setError(
        err?.message ||
        'Unable to sign in. Check your email and password.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card card">
        <div className="auth-brand">
          <h2 className="auth-brand-title">
            Haven POS
          </h2>
        </div>

        <h1 className="auth-title">
          Sign in
        </h1>

        <p className="auth-subtitle muted">
          Welcome back | access your business NOW
        </p>

        {location.state?.message && (
          <div
            className="badge badge-success"
            style={{
              padding: '10px 14px',
              marginBottom: 18,
              display: 'block',
            }}
          >
            {location.state.message}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="auth-form"
        >
          <div className="field">
            <label htmlFor="email">
              Email
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              placeholder="you@business.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="field">
            <label htmlFor="password">
              Password
            </label>

            <div className="password-input-wrapper">
              <input
                id="password"
                type={
                  showPassword
                    ? 'text'
                    : 'password'
                }
                value={password}
                onChange={(e) =>
                  setPassword(
                    e.target.value
                  )
                }
                placeholder="Password"
                required
                autoComplete="current-password"
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowPassword(
                    (prev) => !prev
                  )
                }
                aria-label={
                  showPassword
                    ? 'Hide password'
                    : 'Show password'
                }
              >
                {showPassword
                  ? '🙈'
                  : '👁️'}
              </button>
            </div>
          </div>

          {error && (
            <div className="error-text">
              {error}
            </div>
          )}

          <div className="auth-row">
            <Link
              to="/forgot-password"
              className="auth-link"
            >
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={submitting}
          >
            {submitting
              ? 'Signing in…'
              : 'Sign in'}
          </button>
        </form>

        <p className="auth-footer muted">
          Don't have an account?{' '}
          <Link
            to="/signup"
            className="auth-link"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}