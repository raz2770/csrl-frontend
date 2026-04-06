import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CENTERS } from '../config/centers';
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
      await login({
        role: role.toLowerCase(),
        id:   role === 'STUDENT' || role === 'ADMIN' ? idParam.trim() : center,
        password,
      });
      navigate('/');
    } catch (err) {
      // Firebase error codes → friendly messages
      const code = err?.code || '';
      if (code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential')) {
        setError('Invalid credentials. Please check your ID and password.');
      } else if (code.includes('too-many-requests')) {
        setError('Too many failed attempts. Please try again later.');
      } else {
        setError(err?.message || 'Authentication failed. Please try again.');
      }
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
                <label className="label">Select Centre</label>
                <select
                  className="input select"
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
                <label className="label">Roll Number</label>
                <input
                  type="text" autoFocus required
                  placeholder="e.g. 24001"
                  className="input"
                  value={idParam}
                  onChange={e => setIdParam(e.target.value)}
                />
              </div>
            )}
            {role === 'ADMIN' && (
              <div>
                <label className="label">Username</label>
                <input
                  type="text" autoFocus required
                  placeholder="Admin username"
                  className="input"
                  value={idParam}
                  onChange={e => setIdParam(e.target.value)}
                />
              </div>
            )}

            {/* Password */}
            {(role === 'CENTRE' || role === 'ADMIN') && (
              <div>
                <label className="label">Password</label>
                <input
                  type="password" required
                  placeholder="Enter password"
                  className="input"
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
