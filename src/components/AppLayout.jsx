import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Header from './Header.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import './AppLayout.css';

function daysLeft(business) {
  if (!business?.business_start_date) return null;
  // Trial length isn't in the schema as a stored column, so this is a
  // best-effort display only — the source of truth for status is
  // businesses.status, set by application logic / platform owner.
  return null;
}

export default function AppLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { business } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="app-main">
        <Header onMenuClick={() => setSidebarOpen((v) => !v)} />
        {business?.status === 'trial' && (
          <div className="banner banner-trial">
            <span>Trial active — upgrade any time to keep full access after your trial ends.</span>
            <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }} onClick={() => navigate('/settings')}>
              Manage billing
            </button>
          </div>
        )}
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
