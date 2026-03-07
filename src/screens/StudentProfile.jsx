import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { User, MapPin, Target, BookOpen, AlertCircle, CreditCard, Calendar, Phone, Award } from 'lucide-react';

export default function StudentProfile({ profiles, tests, testColumns, auth }) {
    const { id } = useParams();

    // Row-level security: Students can only view their own profile
    if (auth.role === 'student' && auth.rollNo !== id) {
        return <Navigate to={`/profile/${auth.rollNo}`} />;
    }

    const profile = profiles.find(p => p.ROLL_KEY === id);
    if (!profile) {
        return <div className="card text-center mt-4">Profile Not Found</div>;
    }

    const studentTests = tests.find(t => t.ROLL_KEY === id) || {};

    // Group marks and calculate averages
    const groups = { CMT: [], CAT: [], RMT: [], FMT: [] };
    const averages = [];

    Object.keys(groups).forEach(prefix => {
        const cols = testColumns.filter(c => c.startsWith(prefix));
        let sum = 0;
        let count = 0;
        cols.forEach(col => {
            const val = studentTests[col];
            let marks = null;
            let isAbsent = true;
            if (val && val !== '0' && val.toLowerCase() !== 'absent') {
                marks = parseFloat(val);
                isAbsent = false;
                if (!isNaN(marks)) {
                    sum += marks;
                    count++;
                }
            }
            groups[prefix].push({ test: col, marks, isAbsent });
        });
        const avg = count > 0 ? (sum / count) : 0;
        if (cols.length > 0) {
            averages.push({ name: prefix, average: avg.toFixed(2), count });
        }
    });

    // Calculate generic Weak Area
    let minAvg = Infinity;
    let weakAreaAuto = 'No Data';
    averages.forEach(a => {
        if (a.count > 0 && parseFloat(a.average) < minAvg) {
            minAvg = parseFloat(a.average);
            weakAreaAuto = a.name;
        }
    });

    // Data for Line Chart
    const chartData = [];
    const maxTests = Math.max(...Object.values(groups).map(arr => arr.length));
    for (let i = 0; i < maxTests; i++) {
        const point = { name: `Test ${i + 1}` };
        Object.keys(groups).forEach(prefix => {
            if (groups[prefix][i]) {
                point[prefix] = groups[prefix][i].marks;
            }
        });
        chartData.push(point);
    }

    return (
        <div className="flex flex-col gap-4">
            {/* Section 1: Header */}
            <div className="card flex items-center gap-4">
                <img src={profile["STUDENT PHOTO URL"] || 'https://via.placeholder.com/120'} alt="Student" className="avatar" style={{ width: '120px', height: '120px', borderRadius: '12px' }} referrerPolicy="no-referrer" />
                <div style={{ flex: 1 }}>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        {profile["STUDENT'S NAME"]} <span className="badge badge-primary text-sm">{profile.CATEGORY}</span>
                    </h1>
                    <div className="text-muted mt-2 flex items-center gap-2">
                        <User size={16} /> Roll No: <strong>{profile.ROLL_KEY}</strong>
                    </div>
                    <div className="text-muted mt-1 flex items-center gap-2">
                        <Phone size={16} /> Mobile: {profile["Mobile No."]}
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-muted text-sm font-bold flex items-center gap-1 justify-end">
                        <Award size={16} /> JEE %ile
                    </div>
                    <div className="text-2xl font-bold text-success mt-1">
                        {profile['JEE Main (2026) Phase 1 percentile'] || 'N/A'}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2">
                {/* Section 2: Personal */}
                <div className="card">
                    <h2 className="card-title"><User size={20} /> Family & Personal</h2>
                    <div className="mt-4 flex flex-col gap-2">
                        <div><span className="text-muted font-bold">Gender:</span> {profile.GENDER}</div>
                        <div><span className="text-muted font-bold">DOB:</span> {profile["DATE OF BIRTH"]}</div>
                        <div><span className="text-muted font-bold">Father:</span> {profile["FATHER'S NAME"]}</div>
                        <div><span className="text-muted font-bold">Mother:</span> {profile["MOTHER'S NAME"]}</div>
                        <div className="mt-2 text-muted text-sm flex gap-1">
                            <MapPin size={16} style={{ flexShrink: 0 }} />
                            {profile["PARMANENT ADDRESS"]}, {profile.DISTRICT}, {profile.STATE} - {profile.PINCODE}
                        </div>
                    </div>
                </div>

                {/* Section 3: Education */}
                <div className="card">
                    <h2 className="card-title"><BookOpen size={20} /> Education History</h2>

                    <div className="mt-4">
                        <div className="font-bold border-b pb-1 mb-2">10th Details</div>
                        <div><span className="text-muted">School:</span> {profile["10th SCHOOL NAME"]}</div>
                        <div><span className="text-muted">Board:</span> {profile["10th BOARD"]}</div>
                        <div><span className="text-muted">Percentage:</span> {profile["10th Precentage"]}</div>
                    </div>

                    <div className="mt-4">
                        <div className="font-bold border-b pb-1 mb-2">12th Details</div>
                        <div><span className="text-muted">School:</span> {profile["12th SCHOOL NAME"]}</div>
                        <div><span className="text-muted">Board:</span> {profile["12th BOARD"]}</div>
                        <div><span className="text-muted">Percentage:</span> {profile["12th Precentage"]}</div>
                    </div>
                </div>

                {/* Section 4: Weak Subject */}
                <div className="card">
                    <h2 className="card-title text-danger"><AlertCircle size={20} /> Weak Subject Analysis</h2>
                    <div className="mt-4 bg-danger" style={{ background: 'var(--danger)', color: 'white', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                        <div className="text-sm font-bold opacity-80">Manual Entry</div>
                        <div className="text-xl font-bold">{profile["WEAK SUBJECT (MANUAL)"] || 'Not Specified'}</div>
                        {profile["WEAK SUBJECT NOTES"] && <div className="text-sm mt-1">{profile["WEAK SUBJECT NOTES"]}</div>}
                    </div>

                    <div className="mt-4">
                        <div className="font-bold mb-2 flex justify-between items-center">
                            <span>Auto Weak Area (From Tests):</span>
                            <span className="badge badge-danger">{weakAreaAuto}</span>
                        </div>
                        <div style={{ height: '200px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={averages}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                    <YAxis axisLine={false} tickLine={false} width={30} />
                                    <Tooltip cursor={{ fill: 'transparent' }} />
                                    <Bar dataKey="average" fill="var(--danger)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Section 5: Future College */}
                <div className="card">
                    <h2 className="card-title text-primary"><Target size={20} /> Future Target</h2>
                    <div className="mt-4 flex flex-col gap-4">
                        <div>
                            <div className="text-muted font-bold text-sm">Target College / Branch</div>
                            <div className="text-lg font-bold mt-1">{profile["FUTURE COLLEGE (TARGET)"] || 'Not Set'}</div>
                        </div>
                        {profile['JEE Main (2026) Phase 1 percentile'] && (
                            <div style={{ background: '#f1f5f9', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <div className="text-sm font-bold text-muted">JEE Main 2026 Phase 1</div>
                                <div className="text-2xl text-primary font-bold mt-1">
                                    {profile['JEE Main (2026) Phase 1 percentile']} %ile
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Section 6: Test Performance */}
            <div className="card">
                <h2 className="card-title"><Calendar size={20} /> Complete Test Performance</h2>
                <div style={{ height: '300px', marginTop: '2rem' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} />
                            <YAxis axisLine={false} tickLine={false} width={30} />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="CMT" stroke="#3b82f6" strokeWidth={3} connectNulls dot={{ r: 4 }} />
                            <Line type="monotone" dataKey="CAT" stroke="#10b981" strokeWidth={3} connectNulls dot={{ r: 4 }} />
                            <Line type="monotone" dataKey="RMT" stroke="#f59e0b" strokeWidth={3} connectNulls dot={{ r: 4 }} />
                            <Line type="monotone" dataKey="FMT" stroke="#8b5cf6" strokeWidth={3} connectNulls dot={{ r: 4 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-4 mt-8">
                    {Object.entries(groups).map(([prefix, testsList]) => {
                        if (testsList.length === 0) return null;
                        return (
                            <div key={prefix}>
                                <div className="font-bold text-lg mb-2 border-b pb-2">{prefix} Series</div>
                                <div className="flex flex-col gap-2">
                                    {testsList.map(t => (
                                        <div key={t.test} className="flex justify-between text-sm">
                                            <span className="text-muted">{t.test}</span>
                                            <span className={`font-bold ${t.isAbsent ? 'text-danger' : 'text-success'}`}>
                                                {t.isAbsent ? 'Absent' : t.marks}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
