import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';

const NAV_ITEMS = {
  ADMIN: [
    { label: 'Dashboard', icon: '🏠', id: 'dashboard' },
    { label: 'Centre Rankings', icon: '🏆', id: 'centre-rankings' },
    { label: 'Student Database', icon: '👥', id: 'students' },
    { label: 'Import / Export', icon: '📤', id: 'import-export' },
    { label: 'Test Rankings', icon: '📊', id: 'rankings' },
  ],
  CENTRE: [
    { label: 'Dashboard', icon: '🏠', id: 'dashboard' },
    { label: 'Rankings', icon: '🏆', id: 'rankings' },
    { label: 'Subject Trends', icon: '📈', id: 'trends' },
    { label: 'My Students', icon: '👥', id: 'students' },
  ],
  STUDENT: [
    { label: 'My Profile', icon: '👤', id: 'profile' },
    { label: 'My Scores', icon: '📋', id: 'scores' },
  ],
};

export default function Layout() {
  const { user: auth, logout } = useAuth();
  const navigate = useNavigate();
  const [activePage, setActivePage] = useState('dashboard');

  useEffect(() => {
    const firstNav = NAV_ITEMS[auth?.role]?.[0]?.id || 'dashboard';
    setActivePage(firstNav);
  }, [auth?.role]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = NAV_ITEMS[auth?.role] || [];
  const initials = (auth?.name || auth?.id || 'U')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, background: '#fff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, boxShadow: 'var(--shadow)' }}>
              <img src="/logo.png" alt="CSRL" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>CSRL</div>
              <div style={{ color: 'rgba(255,255,255,.55)', fontSize: 11, lineHeight: 1.2 }}>Performance Hub</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <div
              key={item.id}
              className={`nav-item${activePage === item.id ? ' active' : ''}`}
              onClick={() => setActivePage(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,.1)', padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{auth?.name || auth?.id}</div>
              <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 11 }}>{auth?.role}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="btn btn-sm"
            style={{ width: '100%', justifyContent: 'center', background: 'rgba(255,255,255,.1)', color: 'rgba(255,255,255,.8)', border: '1px solid rgba(255,255,255,.15)' }}
          >
            🚪 Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="main">
        {/* Mobile topbar */}
        <div className="mobile-topbar" style={{ boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/logo.png" alt="CSRL" style={{ height: 32, width: 'auto' }} />
            <span style={{ color: 'var(--csrl-blue)', fontWeight: 700, fontSize: 14 }}>CSRL</span>
          </div>
          {/* Mobile bottom nav */}
          <div className="mobile-nav-strip">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className="btn btn-sm"
                style={{
                  background: activePage === item.id ? 'var(--csrl-blue)' : 'var(--gray-100)',
                  color: activePage === item.id ? '#fff' : 'var(--gray-600)',
                  padding: '6px 10px',
                  border: 'none'
                }}
              >
                {item.icon}
              </button>
            ))}
          </div>
          <button onClick={handleLogout} className="btn btn-sm btn-outline">Out</button>
        </div>

        <Outlet context={{ activePage, setActivePage }} />
      </div>
    </div>
  );
}
