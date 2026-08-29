import { useAuth } from '../context/AuthContext.jsx';
import './login.css';

export default function AccountInactive() {
  const { business, profile, profileError, signOut } = useAuth();

  // Distinguish between a disabled user account and an inactive business.
  const isUserDisabled =
    profile?.is_active === false ||
    (profileError &&
      profileError.includes('disabled'));

  const title = isUserDisabled
    ? 'Account disabled'
    : 'Payment required';

  const message = isUserDisabled
    ? (profileError ||
        'Your account has been disabled by your administrator. Please contact them to regain access.')
    : `${business?.business_name || 'Your business'}'s account is currently inactive. Your trial may have ended — reach out to activate your subscription and regain access.`;

  return (
    <div className="auth-screen">
      <div className="auth-card card" style={{ textAlign: 'center' }}>
        <div className="auth-brand" style={{ justifyContent: 'center' }}>
          <h2 className="auth-brand-title">Haven POS</h2>
        </div>

        <h1 className="auth-title">{title}</h1>

        <p className="auth-subtitle muted">{message}</p>

        <button
          className="btn btn-primary auth-submit"
          onClick={signOut}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
