import { Outlet, useNavigate } from 'react-router-dom';
import { LogOut, User } from 'lucide-react';

export default function Layout({ auth, setAuth }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    setAuth(null);
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-[#0033A0] text-white shadow-xl relative z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white h-12 w-20 flex items-center justify-center rounded-sm shadow-inner rounded-br-2xl p-1">
              <img src="/logo.png" alt="CSRL" className="h-full object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-wide leading-tight">Centre For Social Responsibility & Leadership</h1>
              <p className="text-xs text-blue-200 tracking-wider">STUDENT PERFORMANCE HUB</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs bg-[#FFAA00] text-[#0033A0] px-3 py-1 rounded-full font-bold shadow-sm uppercase tracking-wide">
              {auth.role}
            </span>
            <div className="flex items-center gap-2 border-l border-white/20 pl-4 min-w-[120px]">
              <User size={18} className="text-blue-200" />
              <div className="flex flex-col">
                <span className="font-semibold text-sm truncate max-w-[150px]">{auth.name || auth.id}</span>
                {auth.role === 'STUDENT' && <span className="text-xs text-blue-200">{auth.id}</span>}
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 hover:bg-white/10 rounded-full transition-colors ml-2"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 animate-in fade-in duration-500">
        <div className="container mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
