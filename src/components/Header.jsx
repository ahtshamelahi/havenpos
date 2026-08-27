import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';
import { formatTimestamp } from '../lib/timezone.js';
import Calculator from './Calculator.jsx';
import './Header.css';

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function Header({ onMenuClick }) {
  const { business, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const now = useClock();

  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const profileRef = useRef(null);
  const notifRef = useRef(null);

  useEffect(() => {
    if (!business?.id) return;
    loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business?.id]);

  const loadNotifications = () => {
    if (!business?.id) return;
    supabase
      .from('notifications')
      .select('*')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => setNotifications(data || []));
  };

  const toggleNotifPanel = () => {
    setNotifOpen((v) => {
      const next = !v;
      if (next) loadNotifications(); // pick up anything created since the page loaded
      return next;
    });
  };

  const markNotifRead = async (n) => {
    if (n.is_read) return;
    setNotifications((prev) => prev.map((row) => (row.id === n.id ? { ...row, is_read: true } : row)));
    await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    setNotifications((prev) => prev.map((row) => ({ ...row, is_read: true })));
    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
  };

  useEffect(() => {
    function handleClick(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const dateStr = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className="app-header">
      <div className="app-header-left">
        <button className="icon-btn menu-btn" onClick={onMenuClick} aria-label="Toggle menu">☰</button>
        <div className="header-business">
          <span className="header-business-name">Welcome to {business?.business_name || 'Your Business'}</span>
          <span className="header-datetime muted">{dateStr} · {timeStr}</span>
        </div>
      </div>

      <div className="app-header-right">
        <button className="header-pos-btn" onClick={() => navigate('/pos')}>
          🧾 POS
        </button>

        <div className="header-item" ref={notifRef}>
          <button className="icon-btn" onClick={toggleNotifPanel} aria-label="Notifications">
            🔔
            {unreadCount > 0 && <span className="icon-dot">{unreadCount}</span>}
          </button>
          {notifOpen && (
            <div className="dropdown-panel notif-panel">
              <div className="notif-panel-header">
                <div className="dropdown-title" style={{ padding: 0 }}>Notifications</div>
                {unreadCount > 0 && (
                  <button className="notif-mark-all" onClick={markAllRead}>Mark all read</button>
                )}
              </div>
              {notifications.length === 0 && <div className="dropdown-empty">No notifications yet.</div>}
              {notifications.map((n) => (
                <button
                  key={n.id}
                  className={`notif-row ${n.is_read ? '' : 'notif-unread'}`}
                  onClick={() => markNotifRead(n)}
                  title={n.is_read ? '' : 'Click to mark as read'}
                >
                  <div className="notif-message">{n.message}</div>
                  <div className="notif-time">{formatTimestamp(n.created_at, business?.time_zone)}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="header-item">
          <button className="icon-btn" onClick={() => setCalcOpen((v) => !v)} aria-label="Calculator">🧮</button>
          {calcOpen && (
            <div className="dropdown-panel" style={{ padding: 0 }}>
              <Calculator onClose={() => setCalcOpen(false)} />
            </div>
          )}
        </div>

        <div className="header-item" ref={profileRef}>
          <button className="profile-btn" onClick={() => setProfileOpen((v) => !v)}>
            <span className="avatar">{(profile?.first_name || '?').charAt(0).toUpperCase()}</span>
            <span className="profile-name">{profile?.first_name} {profile?.last_name || ''}</span>
          </button>
          {profileOpen && (
            <div className="dropdown-panel profile-panel">
              <div className="dropdown-title">{profile?.username}</div>
              <div className="muted" style={{ padding: '0 14px 8px', fontSize: 13 }}>
                {profile?.is_owner ? 'Owner' : 'Staff'}
              </div>
              <button className="dropdown-action" onClick={() => navigate('/settings')}>Settings</button>
              <button className="dropdown-action dropdown-action-danger" onClick={handleLogout}>Sign out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}