import { Outlet, useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

const NAV_ITEMS = {
  ADMIN: [
    { label: 'Dashboard', icon: '🏠', id: 'dashboard' },
    { label: 'Rankings', icon: '🏆', id: 'rankings' },
    { label: 'Student Database', icon: '👥', id: 'students' },
  ],
  CENTRE: [
    { label: 'Dashboard', icon: '🏠', id: 'dashboard' },
    { label: 'Rankings', icon: '🏆', id: 'rankings' },
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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center p-1 shadow">
              <img src="/logo.png" alt="CSRL" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="text-white font-bold text-[13px] leading-tight">CSRL</div>
              <div className="text-[11px] leading-tight" style={{ color: 'rgba(255,255,255,.55)' }}>Performance Hub</div>
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
        <div className="px-[18px] py-4" style={{ borderTop: '1px solid rgba(255,255,255,.1)' }}>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="avatar w-8 h-8 text-sm">{initials}</div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-[13px] font-semibold truncate">{auth?.name || auth?.id}</div>
              <div className="text-[11px]" style={{ color: 'rgba(255,255,255,.5)' }}>{auth?.role}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="btn btn-sm w-full justify-center"
            style={{ background: 'rgba(255,255,255,.1)', color: 'rgba(255,255,255,.8)', border: '1px solid rgba(255,255,255,.15)' }}
          >
            🚪 Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="main">
        {/* Mobile topbar */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b md:hidden" style={{ boxShadow: 'var(--shadow)' }}>
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="CSRL" className="h-8 w-auto" />
            <span className="font-bold text-sm" style={{ color: 'var(--csrl-blue)' }}>CSRL</span>
          </div>
          {/* Mobile bottom nav */}
          <div className="flex gap-1">
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
