import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users } from 'lucide-react';

export default function StudentList({ profiles, tests }) {
    const [search, setSearch] = useState('');
    const navigate = useNavigate();

    const filtered = profiles.filter(p => {
        const s = search.toLowerCase();
        return (
            (p.ROLL_KEY || '').toLowerCase().includes(s) ||
            (p["STUDENT'S NAME"] || '').toLowerCase().includes(s) ||
            (p.CATEGORY || '').toLowerCase().includes(s) ||
            (p.DISTRICT || '').toLowerCase().includes(s)
        );
    });

    return (
        <div>
            <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Users /> Students List
            </h1>

            <div className="card mb-4">
                <div className="flex items-center gap-2" style={{ position: 'relative' }}>
                    <Search size={20} className="text-muted" style={{ position: 'absolute', left: '10px' }} />
                    <input
                        type="text"
                        className="input"
                        style={{ paddingLeft: '40px' }}
                        placeholder="Search by Roll, Name, Category, or District..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="card">
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Photo</th>
                                <th>Roll No</th>
                                <th>Name</th>
                                <th>Category</th>
                                <th>JEE Percentile</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(p => (
                                <tr key={p.ROLL_KEY} onClick={() => navigate(`/profile/${p.ROLL_KEY}`)} style={{ cursor: 'pointer' }}>
                                    <td>
                                        <img src={p["STUDENT PHOTO URL"] || 'https://via.placeholder.com/48'} className="avatar" alt="student" referrerPolicy="no-referrer" />
                                    </td>
                                    <td className="font-bold">{p.ROLL_KEY}</td>
                                    <td>{p["STUDENT'S NAME"]}</td>
                                    <td>
                                        <span className="badge badge-primary">{p.CATEGORY}</span>
                                    </td>
                                    <td className="font-bold text-success">
                                        {p['JEE Main (2026) Phase 1 percentile'] || 'N/A'}
                                    </td>
                                    <td>
                                        <button className="btn btn-secondary text-sm">View Profile</button>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="text-center text-muted">No students found matching your search.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
