import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CENTERS } from '../config/centers';
import { loginApi } from '../api';
import { GraduationCap, Building2, ShieldCheck, Loader2 } from 'lucide-react';

export default function Login({ setAuth }) {
  const [role, setRole] = useState('STUDENT'); // STUDENT, CENTRE, ADMIN
  const [center, setCenter] = useState(Object.keys(CENTERS)[0]);
  const [idParam, setIdParam] = useState(''); // Roll No, Username
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
        setAuth({ 
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
    } catch (err) {
      console.error(err);
      setError('Invalid credentials or backend server is not running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 fade-in zoom-in duration-300">
        <div className="bg-[#0033A0] p-8 text-center text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-[#FFAA00] opacity-20 blur-2xl"></div>
          <div className="mx-auto w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg mb-4 text-[#0033A0] p-1 overflow-hidden">
            <img src="/logo.png" alt="CSRL Logo" className="w-full h-full object-contain" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Welcome Back</h2>
          <p className="text-blue-200 mt-1 text-sm">Performance Management System</p>
        </div>

        <div className="p-6">
          <div className="flex bg-slate-100 p-1 rounded-lg mb-6 shadow-inner">
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-all ${role === 'STUDENT' ? 'bg-white shadow text-[#0033A0]' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setRole('STUDENT')}
            >
              <GraduationCap size={16}/> Student
            </button>
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-all ${role === 'CENTRE' ? 'bg-white shadow text-[#0033A0]' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setRole('CENTRE')}
            >
              <Building2 size={16}/> Centre
            </button>
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-all ${role === 'ADMIN' ? 'bg-white shadow text-[#0033A0]' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setRole('ADMIN')}
            >
              <ShieldCheck size={16}/> Admin
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {role !== 'ADMIN' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select Centre</label>
                <select 
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#FFAA00] focus:border-[#0033A0] outline-none transition-all"
                  value={center}
                  onChange={(e) => setCenter(e.target.value)}
                >
                  {Object.keys(CENTERS).map(c => (
                    <option key={c} value={c}>{CENTERS[c].name} ({c})</option>
                  ))}
                </select>
              </div>
            )}

            {role === 'STUDENT' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Roll Number</label>
                <input 
                  type="text" 
                  autoFocus
                  required
                  placeholder="e.g. 24001"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#FFAA00] focus:border-[#0033A0] outline-none transition-all"
                  value={idParam}
                  onChange={(e) => setIdParam(e.target.value)}
                />
              </div>
            )}

            {role === 'ADMIN' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                <input 
                  type="text" 
                  autoFocus
                  required
                  placeholder="Admin Username"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#FFAA00] focus:border-[#0033A0] outline-none transition-all"
                  value={idParam}
                  onChange={(e) => setIdParam(e.target.value)}
                />
              </div>
            )}

            {(role === 'CENTRE' || role === 'ADMIN') && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input 
                  type="password" 
                  required
                  placeholder="Enter Password"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#FFAA00] focus:border-[#0033A0] outline-none transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}

            {error && <div className="text-red-500 text-sm p-3 bg-red-50 rounded-lg border border-red-100">{error}</div>}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-[#0033A0] hover:bg-blue-800 text-white font-bold py-3 px-4 rounded-lg shadow-[0_4px_14px_0_rgba(0,51,160,0.39)] hover:shadow-[0_6px_20px_rgba(0,51,160,0.23)] hover:-translate-y-[1px] transition-all disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
