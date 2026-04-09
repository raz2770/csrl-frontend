import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import { CENTERS } from '../config/centers';
import {
  Trophy,
  LayoutDashboard,
  Users,
  FileText,
  Upload,
  TrendingUp,
  User,
  BarChart2,
  BarChart3,
  LogOut,
} from 'lucide-react';

const ADMIN_NAV = [
  { section: 'Overview' },
  { key: 'leaderboard', Icon: Trophy,         label: 'Centre Leaderboard' },
  { key: 'overview',    Icon: LayoutDashboard, label: 'Dashboard'          },
  { key: 'ranking',     Icon: TrendingUp,      label: 'Rankings'           },
  { key: 'insights',    Icon: BarChart3,       label: 'Test analysis'      },
  { section: 'Data Management' },
  { key: 'students',    Icon: Users,           label: 'Students'           },
  { key: 'marks',       Icon: FileText,        label: 'Test Marks'         },
  { section: 'Import' },
  { key: 'import',      Icon: Upload,          label: 'Import Excel'       },
];

const CENTRE_NAV = [
  { key: 'overview',   Icon: LayoutDashboard, label: 'Overview'  },
  { key: 'topbottom',  Icon: Trophy,          label: 'Rankings'  },
  { key: 'insights',   Icon: BarChart3,       label: 'Test analysis' },
  { key: 'students',   Icon: Users,           label: 'Students'  },
];

const STUDENT_NAV = [
  { key: 'profile',     Icon: User,          label: 'Profile'     },
  { key: 'performance', Icon: BarChart2,     label: 'Performance & Records' },
  { key: 'analysis',    Icon: BarChart3,     label: 'Test analysis' },
];

function centreDisplayName(code) {
  return CENTERS[code]?.name || code || '';
}

function initials(name = '') {
  return name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function Layout() {
  const { user: auth, logout } = useAuth();
  const navigate = useNavigate();
  const [activePage, setActivePage] = useState(() => {
    if (auth?.role === 'ADMIN')   return 'leaderboard';
    if (auth?.role === 'CENTRE')  return 'overview';
    return 'profile';
  });

  const role = auth?.role;
  const navItems = role === 'ADMIN' ? ADMIN_NAV : role === 'CENTRE' ? CENTRE_NAV : STUDENT_NAV;

  useEffect(() => {
    if (role === 'ADMIN')   setActivePage('leaderboard');
    else if (role === 'CENTRE') setActivePage('overview');
    else if (role === 'STUDENT') setActivePage('profile');
  }, [role]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const userInitials = initials(auth?.name || auth?.id || 'U');

  const sidebarUser =
    role === 'ADMIN'
      ? 'CSRL Admin'
      : role === 'CENTRE'
        ? `${auth?.centerCode || auth?.id || ''} — ${centreDisplayName(auth?.centerCode)}`
        : auth?.name || auth?.id || 'Student';

  const sidebarRole =
    role === 'ADMIN'
      ? 'Super Administrator'
      : role === 'CENTRE'
        ? 'Centre Login'
        : `${auth?.id || ''} · ${auth?.centerCode || ''}`;

  return (
    <div className="layout">
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <img src="/logo.png" alt="CSRL logo" style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: '50%' }} />
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>CSRL</div>
          </div>
        </div>

        {/* Logged-in user info */}
        <div className="sidebar-user-block">
          <div style={{ color: 'rgba(255,255,255,.45)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>
            Logged in as
          </div>
          <div style={{ color: '#fff', fontWeight: 600, fontSize: 13, wordBreak: 'break-word' }}>
            {sidebarUser}
          </div>
          <div style={{ color: 'rgba(255,255,255,.45)', fontSize: 11, marginTop: 2 }}>
            {sidebarRole}
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav" aria-label="Main navigation">
          {navItems.map((item) =>
            item.section ? (
              <div key={item.section} className="nav-section" aria-hidden="true">
                {item.section}
              </div>
            ) : (
              <button
                key={item.key}
                type="button"
                className={`nav-item${activePage === item.key ? ' active' : ''}`}
                onClick={() => setActivePage(item.key)}
                aria-current={activePage === item.key ? 'page' : undefined}
              >
                <item.Icon size={15} aria-hidden="true" />
                {item.label}
              </button>
            )
          )}
        </nav>

        {/* Logout — pinned below scrollable nav */}
        <div className="sidebar-logout">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleLogout}
            style={{
              width: '100%',
              justifyContent: 'center',
              color: 'rgba(255,255,255,.75)',
              borderColor: 'rgba(255,255,255,.25)',
              background: 'transparent',
              fontSize: 13,
              gap: 6,
            }}
          >
            <LogOut size={14} aria-hidden="true" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="main">
        {/* Mobile top bar */}
        <div className="mobile-topbar" style={{ boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/logo.png" alt="CSRL logo" style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: '50%' }} />
            <span style={{ color: 'var(--csrl-blue)', fontWeight: 700, fontSize: 14 }}>CSRL</span>
          </div>

          <div className="mobile-nav-strip" role="navigation" aria-label="Mobile navigation">
            {navItems.filter((n) => n.key).map((item) => (
              <button
                key={item.key}
                type="button"
                aria-label={item.label}
                aria-current={activePage === item.key ? 'page' : undefined}
                onClick={() => setActivePage(item.key)}
                className="btn btn-sm"
                style={{
                  background: activePage === item.key ? 'var(--csrl-blue)' : 'var(--gray-100)',
                  color: activePage === item.key ? '#fff' : 'var(--gray-600)',
                  padding: '6px 10px',
                  border: 'none',
                }}
              >
                <item.Icon size={14} />
              </button>
            ))}
          </div>

          <button
            type="button"
            aria-label={`Logout ${userInitials}`}
            onClick={handleLogout}
            className="btn btn-sm btn-outline"
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <LogOut size={13} />
            <span style={{ fontSize: 11 }}>{userInitials}</span>
          </button>
        </div>

        <div className="main-outlet">
          <Outlet context={{ activePage, setActivePage }} />
        </div>
      </div>
    </div>
  );
}
