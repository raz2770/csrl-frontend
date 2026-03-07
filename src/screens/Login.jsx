import React, { useState } from 'react';
import { LogIn, Code, Lock } from 'lucide-react';

export default function Login({ onLogin, profiles }) {
    const [tab, setTab] = useState('student');
    const [rollNo, setRollNo] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        if (tab === 'admin') {
            if (password === 'Gail@321') { // Simple hardcoded auth
                onLogin({ role: 'admin', rollNo: null });
            } else {
                setError('Invalid admin credentials.');
            }
        } else {
            const student = profiles.find(p => p.ROLL_KEY === rollNo.trim().toUpperCase());
            if (student) {
                onLogin({ role: 'student', rollNo: student.ROLL_KEY });
            } else {
                setError('Roll number not found.');
            }
        }
    };

    return (
        <div className="login-container">
            <div className="card">
                <h2 className="text-2xl text-center mb-4">GAIL Utkarsh Login</h2>

                <div className="login-tabs">
                    <div
                        className={`login-tab ${tab === 'student' ? 'active' : ''}`}
                        onClick={() => setTab('student')}
                    >
                        Student
                    </div>
                    <div
                        className={`login-tab ${tab === 'admin' ? 'active' : ''}`}
                        onClick={() => setTab('admin')}
                    >
                        Admin
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {error && <div className="text-danger text-center font-bold">{error}</div>}

                    {tab === 'student' ? (
                        <div>
                            <label className="text-sm font-bold">Roll Number</label>
                            <input
                                type="text"
                                className="input mt-2"
                                value={rollNo}
                                onChange={e => setRollNo(e.target.value)}
                                placeholder="Enter your roll number"
                                required
                            />
                        </div>
                    ) : (
                        <div>
                            <label className="text-sm font-bold">Password</label>
                            <input
                                type="password"
                                className="input mt-2"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Enter admin password"
                                required
                            />
                        </div>
                    )}

                    <button type="submit" className="btn justify-center mt-4">
                        <LogIn size={20} /> Login as {tab === 'student' ? 'Student' : 'Admin'}
                    </button>
                </form>
            </div>
        </div>
    );
}
