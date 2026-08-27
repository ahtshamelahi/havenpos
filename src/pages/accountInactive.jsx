import { useAuth } from '../context/AuthContext.jsx';
import './login.css';

export default function AccountInactive() {
  const { business, signOut } = useAuth();

  return (
    <div className="auth-screen">
      <div className="auth-card card" style={{ textAlign: 'center' }}>
        <div className="auth-brand" style={{ justifyContent: 'center' }}>
          <div className="auth-brand-mark">P</div>
          <span>POS Suite</span>
        </div>
        <h1 className="auth-title">Payment required</h1>
        <p className="auth-subtitle muted">
          {business?.business_name || 'Your business'}'s account is currently inactive. Your trial may have
          ended — reach out to activate your subscription and regain access.
        </p>
        <button className="btn btn-primary auth-submit" onClick={signOut}>Sign out</button>
      </div>
    </div>
  );
}
