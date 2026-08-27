import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import './Sidebar.css';


const NAV_ITEMS = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    module: null,
    icon: 'dashboard',
  },
  {
    to: '/pos',
    label: 'POS Billing',
    module: 'pos',
    icon: 'pos',
  },
  {
    to: '/users',
    label: 'User Management',
    module: 'user_management',
    icon: 'users',
  },
  {
    to: '/contacts',
    label: 'Contacts',
    module: 'contacts',
    icon: 'contacts',
  },
  {
    to: '/sales',
    label: 'Sales',
    module: 'sales',
    icon: 'sales',
  },
  {
    to: '/purchases',
    label: 'Purchases',
    module: 'purchases',
    icon: 'purchases',
  },
  {
    to: '/products',
    label: 'Products',
    module: 'products',
    icon: 'products',
  },
  {
    to: '/stock',
    label: 'Stock',
    module: 'stock',
    icon: 'stock',
  },
  {
    to: '/expenses',
    label: 'Expenses',
    module: 'expenses',
    icon: 'expenses',
  },
  {
    to: '/reports',
    label: 'Reports',
    module: 'reports',
    icon: 'reports',
  },
  {
    to: '/settings',
    label: 'Settings',
    module: 'settings',
    icon: 'settings',
  },
];


function NavIcon({ name }) {
  const p = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  switch (name) {
    case 'dashboard':
      return (
        <svg {...p}>
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
      );

    case 'pos':
      return (
        <svg {...p}>
          <rect x="2" y="4" width="20" height="14" rx="2" />
          <path d="M2 9h20" />
          <path d="M6 14h4" />
        </svg>
      );

    case 'sales':
      return (
        <svg {...p}>
          <path d="M3 12h4l3-8 4 16 3-8h4" />
        </svg>
      );

    case 'purchases':
      return (
        <svg {...p}>
          <path d="M6 6h15l-1.5 9h-12z" />
          <circle cx="9" cy="20" r="1" />
          <circle cx="18" cy="20" r="1" />
          <path d="M3 3h2l1 3" />
        </svg>
      );

    case 'products':
      return (
        <svg {...p}>
          <path d="M21 8l-9-5-9 5 9 5 9-5z" />
          <path d="M3 8v8l9 5 9-5V8" />
          <path d="M12 13v8" />
        </svg>
      );

    case 'contacts':
      return (
        <svg {...p}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
        </svg>
      );

    case 'stock':
      return (
        <svg {...p}>
          <path d="M3 7l9-4 9 4-9 4-9-4z" />
          <path d="M3 7v10l9 4 9-4V7" />
        </svg>
      );

    case 'expenses':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9 9h3.5a2 2 0 010 4H9m3 0h3M12 7v2m0 8v-2" />
        </svg>
      );

    case 'reports':
      return (
        <svg {...p}>
          <path d="M4 19V5a1 1 0 011-1h14a1 1 0 011 1v14" />
          <path d="M8 15v-4M12 15V9M16 15v-7" />
          <path d="M4 19h16" />
        </svg>
      );

    case 'users':
      return (
        <svg {...p}>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
          <path d="M16.5 8.2a3 3 0 110 5.9" />
          <path d="M20 20c0-2.6-1.7-4.6-4-5.4" />
        </svg>
      );

    case 'settings':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.6V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.6-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.6-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.6V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.6 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.3 1.5h.1a2 2 0 110 4h-.1a1.7 1.7 0 00-1.6 1z" />
        </svg>
      );

    default:
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}


export default function Sidebar({ open, onClose }) {
  const { can, profile } = useAuth();

  const location = useLocation();

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;

    return (
      window.localStorage.getItem('sidebar-collapsed') === '1'
    );
  });


  useEffect(() => {
    window.localStorage.setItem(
      'sidebar-collapsed',
      collapsed ? '1' : '0'
    );
  }, [collapsed]);


  const visibleItems = NAV_ITEMS.filter(
    (item) =>
      !item.module ||
      profile?.is_owner ||
      can(item.module, 'view')
  );


  return (
    <>
      <aside
        className={`sidebar ${open ? 'sidebar-open' : ''
          } ${collapsed ? 'sidebar-collapsed' : ''
          }`}
      >

        {/* ==================================================
            POS BRAND
            ================================================== */}

        <div className="sidebar-brand">
          <span className="sidebar-brand-text">
            POS
          </span>
        </div>


        {/* ==================================================
            NAVIGATION
            ================================================== */}

        <nav className="sidebar-nav">

          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}

              className={({ isActive }) => {
                const isRegistersActive =
                  item.to === '/active-register' &&
                  location.pathname.startsWith('/registers');

                return `sidebar-link ${isActive || isRegistersActive
                    ? 'sidebar-link-active'
                    : ''
                  }`;
              }}

              onClick={onClose}

              title={
                collapsed
                  ? item.label
                  : undefined
              }
            >

              <span
                className="sidebar-link-icon"
                aria-hidden="true"
              >
                <NavIcon name={item.icon} />
              </span>

              <span className="sidebar-link-label">
                {item.label}
              </span>

            </NavLink>
          ))}

        </nav>


        {/* ==================================================
            COLLAPSE BUTTON
            ================================================== */}

        {/*
        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={() =>
            setCollapsed((v) => !v)
          }
          title={
            collapsed
              ? 'Expand sidebar'
              : 'Collapse sidebar'
          }
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: collapsed
                ? 'rotate(180deg)'
                : 'none',
              transition:
                'transform 0.2s ease',
              flex: 'none',
            }}
          >
            <path d="M15 6l-6 6 6 6" />
          </svg>

          <span className="sidebar-link-label">
            Collapse
          </span>
        </button>
        */}

      </aside>


      {/* ====================================================
          MOBILE BACKDROP
          ==================================================== */}

      {open && (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
        />
      )}
    </>
  );
}