import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogOut, RefreshCw, Users, LayoutDashboard, User } from 'lucide-react';

export default function Navbar({ auth, setAuth, onRefresh }) {
    const navigate = useNavigate();

    const handleLogout = () => {
        setAuth({ role: null, rollNo: null });
        navigate('/login');
    };

    return (
        <header className="header">
            <div className="brand">
                GAIL Utkarsh Super 100
            </div>

            <div className="flex items-center gap-4">
                {auth.role === 'admin' ? (
                    <>
                        <Link to="/admin" className="btn btn-secondary">
                            <LayoutDashboard size={18} /> Dashboard
                        </Link>
                        <Link to="/students" className="btn btn-secondary">
                            <Users size={18} /> Students
                        </Link>
                    </>
                ) : (
                    <Link to={`/profile/${auth.rollNo}`} className="btn btn-secondary">
                        <User size={18} /> My Profile
                    </Link>
                )}

                <button onClick={onRefresh} className="btn" title="Refresh Data">
                    <RefreshCw size={18} />
                </button>
                <button onClick={handleLogout} className="btn" style={{ background: 'var(--danger)' }}>
                    <LogOut size={18} />
                </button>
            </div>
        </header>
    );
}
