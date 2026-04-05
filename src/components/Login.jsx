import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CENTERS } from '../config/centers';
import { loginApi } from '../services/dataService';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [role, setRole] = useState('STUDENT');
  const [center, setCenter] = useState(Object.keys(CENTERS)[0]);
  const [idParam, setIdParam] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const creds = {
        role: role.toLowerCase(),
        id: role === 'STUDENT' || role === 'ADMIN' ? idParam.trim() : center,
        password: role !== 'STUDENT' ? password : ''
      };
      const resp = await loginApi(creds);
      if (resp.success) {
        login({
          role: resp.role.toUpperCase(),
          id: role === 'STUDENT' || role === 'ADMIN' ? idParam.trim() : center,
          name: resp.name,
          centerCode: resp.centerCode,
          token: resp.token
        });
        navigate('/');
      } else {
        setError(resp.message || 'Authentication failed');
      }
    } catch {
      setError('Invalid credentials or backend is offline.');
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    { key: 'STUDENT', icon: '🎓', label: 'Student' },
    { key: 'CENTRE', icon: '🏢', label: 'Centre' },
    { key: 'ADMIN', icon: '🛡️', label: 'Admin' },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, var(--csrl-blue-dark) 0%, var(--csrl-blue) 60%, #2563b0 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '72px', height: '72px', background: '#fff', borderRadius: '18px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px', padding: '10px',
            boxShadow: '0 8px 32px rgba(0,0,0,.2)'
          }}>
            <img src="/logo.png" alt="CSRL" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px' }}>
            CSRL Performance Hub
          </h1>
          <p style={{ color: 'rgba(255,255,255,.65)', fontSize: '13px', marginTop: '4px' }}>
            Student Management System
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: '28px' }}>
          {/* Role Tabs */}
          <div className="tab-bar" style={{ width: '100%', marginBottom: '20px' }}>
            {roles.map(r => (
              <button
                key={r.key}
                type="button"
                style={{ flex: 1, justifyContent: 'center' }}
                className={`tab ${role === r.key ? 'active' : ''}`}
                onClick={() => setRole(r.key)}
              >
                {r.icon} {r.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Centre selector */}
            {role !== 'ADMIN' && (
              <div>
                <label className="lbl">Select Centre</label>
                <select
                  className="inp select"
                  value={center}
                  onChange={e => setCenter(e.target.value)}
                >
                  {Object.keys(CENTERS).map(c => (
                    <option key={c} value={c}>{CENTERS[c].name} ({c})</option>
                  ))}
                </select>
              </div>
            )}

            {/* Roll / Username */}
            {role === 'STUDENT' && (
              <div>
                <label className="lbl">Roll Number</label>
                <input
                  type="text" autoFocus required
                  placeholder="e.g. 24001"
                  className="inp"
                  value={idParam}
                  onChange={e => setIdParam(e.target.value)}
                />
              </div>
            )}
            {role === 'ADMIN' && (
              <div>
                <label className="lbl">Username</label>
                <input
                  type="text" autoFocus required
                  placeholder="Admin username"
                  className="inp"
                  value={idParam}
                  onChange={e => setIdParam(e.target.value)}
                />
              </div>
            )}

            {/* Password */}
            {(role === 'CENTRE' || role === 'ADMIN') && (
              <div>
                <label className="lbl">Password</label>
                <input
                  type="password" required
                  placeholder="Enter password"
                  className="inp"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
            )}

            {error && (
              <div style={{
                background: 'var(--red-bg)', color: 'var(--red)',
                padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                fontSize: '13px', fontWeight: 500
              }}>
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', fontSize: '15px', padding: '12px', marginTop: '4px' }}
            >
              {loading ? '⏳ Signing in...' : '🔐 Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
