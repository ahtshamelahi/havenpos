import {
  Navigate,
  useLocation,
} from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import Loader from './Loader.jsx';

export default function ProtectedRoute({
  children,
  module,
  action = 'view',
}) {
  const {
    session,
    profile,
    business,
    loading,
    profileError,
    refreshProfile,
    can,
  } = useAuth();

  const location = useLocation();

  /*
   * AuthContext is still resolving:
   *
   * - Supabase session
   * - public.users profile
   * - business
   * - permissions
   *
   * NEVER redirect while this is true.
   */
  if (loading) {
    return <Loader fullScreen={true} text="Starting application..." />;
  }

  /*
   * Authentication has finished and there is
   * no authenticated Supabase session.
   */
  if (!session) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from:
            location.pathname +
            location.search,
        }}
      />
    );
  }

  /*
   * At this point loading is FALSE.
   *
   * Therefore profile === null is now a real profile-loading failure,
   * rather than simply "profile hasn't loaded yet".
   *
   * Show the error and allow the user to retry — a transient network
   * blip should not permanently block access.
   */
  if (!profile) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: 16,
        padding: 24,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 40 }}>⚠️</div>
        <h2 style={{ margin: 0, fontSize: 20 }}>Unable to load your profile</h2>
        <p style={{ margin: 0, color: 'var(--text-secondary)', maxWidth: 420, fontSize: 14 }}>
          {profileError || 'Your account profile could not be loaded. This may be a temporary network issue.'}
        </p>
        <button
          className="btn btn-primary"
          onClick={refreshProfile}
          style={{ minWidth: 120 }}
        >
          Retry
        </button>
      </div>
    );
  }

  /*
   * Business account inactive.
   */
  if (
    business?.status === 'inactive'
  ) {
    return (
      <Navigate
        to="/account-inactive"
        replace
      />
    );
  }

  /*
   * User account disabled by admin.
   */
  if (profile.is_active === false) {
    return (
      <Navigate
        to="/account-inactive"
        replace
      />
    );
  }

  /*
   * Permission check.
   */
  if (
    module &&
    !can(module, action)
  ) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  return children;
}