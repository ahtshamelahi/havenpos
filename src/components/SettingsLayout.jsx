import { NavLink } from 'react-router-dom';
import AppLayout from './AppLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import './SettingsLayout.css';

export default function SettingsLayout({ children, title, subtitle }) {
  const { profile } = useAuth();
  const isOwner = profile?.is_owner;

  return (
    <AppLayout>
      <div className="settings-layout">
        <aside className="settings-sidebar no-print">
          <div className="settings-nav-group">
            <div className="settings-nav-title">Organization</div>
            {isOwner && (
              <>
                <NavLink to="/settings/business" className="settings-nav-link">
                  <span className="settings-nav-icon">🏢</span> Business Profile
                </NavLink>
                <NavLink to="/settings/locations" className="settings-nav-link">
                  <span className="settings-nav-icon">📍</span> Locations
                </NavLink>
              </>
            )}
          </div>

          <div className="settings-nav-group">
            <div className="settings-nav-title">Products & Taxes</div>
            <NavLink to="/categories" className="settings-nav-link">
              <span className="settings-nav-icon">🗂️</span> Categories
            </NavLink>
            <NavLink to="/tax-rates" className="settings-nav-link">
              <span className="settings-nav-icon">🧾</span> Tax Rates
            </NavLink>
          </div>

          {isOwner && (
            <div className="settings-nav-group">
              <div className="settings-nav-title">Branding</div>
              <NavLink to="/settings/invoice" className="settings-nav-link">
                <span className="settings-nav-icon">🧻</span> Invoice & Receipt
              </NavLink>
            </div>
          )}

          <div className="settings-nav-group">
            <div className="settings-nav-title">Personal</div>
            <NavLink to="/settings/preferences" className="settings-nav-link">
              <span className="settings-nav-icon">⚙️</span> My Preferences
            </NavLink>
          </div>
        </aside>

        <main className="settings-content">
          {(title || subtitle) && (
            <header className="settings-header">
              {title && <h1>{title}</h1>}
              {subtitle && <p>{subtitle}</p>}
            </header>
          )}
          {children}
        </main>
      </div>
    </AppLayout>
  );
}
