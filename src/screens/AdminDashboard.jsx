import React, { useState } from 'react';
import { getRankingsByTest } from '../api';
import { TrendingUp, Users, Award, LayoutList } from 'lucide-react';

export default function AdminDashboard({ profiles, tests, testColumns, analytics }) {
    const [selectedTest, setSelectedTest] = useState(testColumns[0] || '');

    const rankings = selectedTest ? getRankingsByTest(profiles, tests, selectedTest) : null;

    return (
        <div>
            <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <LayoutList /> Admin Dashboard
            </h1>

            <div className="grid grid-cols-3 mb-4">
                <div className="card text-center">
                    <div className="text-muted font-bold flex items-center justify-center gap-2">
                        <Users size={20} /> Total Students
                    </div>
                    <div className="text-2xl font-bold mt-2 text-primary">{analytics.totalStudents}</div>
                </div>
                <div className="card text-center">
                    <div className="text-muted font-bold flex items-center justify-center gap-2">
                        <TrendingUp size={20} /> Avg JEE Percentile
                    </div>
                    <div className="text-2xl font-bold mt-2 text-primary">{analytics.avgJee}</div>
                </div>
                <div className="card text-center">
                    <div className="text-muted font-bold flex items-center justify-center gap-2">
                        <Award size={20} /> Highest Percentile
                    </div>
                    <div className="text-2xl font-bold mt-2 text-primary">{analytics.highestJee}</div>
                </div>
            </div>

            <div className="card mb-4">
                <h2 className="card-title">Test Leaderboards</h2>
                <div className="flex items-center gap-4 mb-4">
                    <label className="font-bold">Select Test: </label>
                    <select
                        className="select"
                        style={{ width: 'auto', minWidth: '200px' }}
                        value={selectedTest}
                        onChange={e => setSelectedTest(e.target.value)}
                    >
                        {testColumns.map(tc => (
                            <option key={tc} value={tc}>{tc}</option>
                        ))}
                    </select>
                </div>
                {rankings && (
                    <div className="text-sm text-muted mb-4">
                        Attempted: {rankings.attemptedCount} | Absent: {rankings.absentCount}
                    </div>
                )}
            </div>

            {rankings && (
                <div className="grid grid-cols-2">
                    {/* Top 10 */}
                    <div className="card">
                        <h2 className="card-title text-success flex items-center gap-2">
                            <TrendingUp size={20} /> Top 10 Students
                        </h2>
                        {rankings.top10.length === 0 ? (
                            <p className="text-muted">No valid marks or all absent.</p>
                        ) : (
                            <div className="table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Rank</th>
                                            <th>Photo</th>
                                            <th>Roll / Name</th>
                                            <th>Marks</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rankings.top10.map((s, idx) => (
                                            <tr key={s.roll}>
                                                <td className="font-bold">{idx + 1}</td>
                                                <td>
                                                    <img src={s.photo || 'https://via.placeholder.com/48'} className="avatar" alt="pic" referrerPolicy="no-referrer" />
                                                </td>
                                                <td>
                                                    <div className="font-bold">{s.name}</div>
                                                    <div className="text-sm text-muted">{s.roll} | {s.category}</div>
                                                </td>
                                                <td className="font-bold text-success">{s.marks}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Bottom 10 */}
                    <div className="card">
                        <h2 className="card-title text-danger flex items-center gap-2">
                            <TrendingUp size={20} style={{ transform: 'rotateX(180deg)' }} /> Bottom 10 Students
                        </h2>
                        {rankings.bottom10.length === 0 ? (
                            <p className="text-muted">No valid marks or all absent.</p>
                        ) : (
                            <div className="table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Rank</th>
                                            <th>Photo</th>
                                            <th>Roll / Name</th>
                                            <th>Marks</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rankings.bottom10.map((s, idx) => (
                                            <tr key={s.roll}>
                                                <td className="font-bold">{rankings.attemptedCount - rankings.bottom10.length + idx + 1}</td>
                                                <td>
                                                    <img src={s.photo || 'https://via.placeholder.com/48'} className="avatar" alt="pic" referrerPolicy="no-referrer" />
                                                </td>
                                                <td>
                                                    <div className="font-bold">{s.name}</div>
                                                    <div className="text-sm text-muted">{s.roll} | {s.category}</div>
                                                </td>
                                                <td className="font-bold text-danger">{s.marks}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
