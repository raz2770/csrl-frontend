import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import StudentProfileView from './StudentProfileView';
import { fetchStudentData, buildStudentChartData } from '../services/dataService';
import { useAuth } from '../context/AuthContext';

export default function StudentDashboard() {
  const { activePage } = useOutletContext();
  const { user: auth } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudentData(auth.token)
      .then(d => setData(d))
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, [auth.token]);

  if (loading) return (
    <div style={{ display:'flex', height:'60vh', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:14, color:'var(--gray-400)' }}>
      <div style={{ fontSize:40 }}>⏳</div>
      <p style={{ fontWeight:600 }}>Loading your profile...</p>
    </div>
  );

  if (!data || !data.profiles || data.profiles.length === 0) {
    return <div style={{ padding:32, textAlign:'center', color:'var(--gray-400)', fontSize:15 }}>No profile data found for this roll number.</div>;
  }

  const profile = data.profiles[0];
  const studentTests = data.tests[0] || {};
  const testColumns = data.testColumns || [];

  const pageTitle = { profile: 'My Profile', scores: 'My Scores' };

  // ── Scores / Progress Tab ──────────────────────────────────────────────────
  const ScoresSection = () => {
    const chartData = useMemo(() => buildStudentChartData(studentTests, testColumns), []);
    // Get unique subjects
    const subjects = [...new Set(testColumns.map(c => c.split(' ')[0]).filter(Boolean))];
    const COLORS = ['#1a4fa0','#f5a623','#1a8a4a','#e86b1f','#c0392b'];

    // Full score table
    const rows = testColumns.map(col => ({
      test: col,
      score: studentTests[col] !== undefined && studentTests[col] !== '' ? studentTests[col] : '—'
    }));

    return (
      <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
        {/* Chart */}
        <div className="card">
          <div className="section-title">📈 Performance Trend by Subject</div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top:10, right:20, left:-10, bottom:5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                <XAxis dataKey="name" tick={{ fontSize:11, fill:'var(--gray-600)' }} />
                <YAxis tick={{ fontSize:11, fill:'var(--gray-400)' }} />
                <Tooltip contentStyle={{ background:'var(--white)', border:'1px solid var(--gray-100)', borderRadius:8, fontSize:12 }} />
                <Legend wrapperStyle={{ fontSize:13 }} />
                {subjects.map((sub, i) => (
                  <Line key={sub} type="monotone" dataKey={sub} stroke={COLORS[i%COLORS.length]} strokeWidth={2.5} dot={{ r:4 }} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ color:'var(--gray-400)', textAlign:'center', padding:32 }}>No test data available yet.</p>
          )}
        </div>

        {/* Full test-by-test table */}
        <div className="card">
          <div className="section-title">📋 All Test Scores</div>
          <div style={{ overflowX:'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Test</th>
                  <th>Subject</th>
                  <th>Score</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const sub = r.test.split(' ')[0];
                  const testName = r.test.split(' ').slice(1).join(' ') || r.test;
                  const isAbsent = String(r.score).toLowerCase() === 'absent';
                  const num = parseFloat(r.score);
                  let statusChip;
                  if (r.score === '—' || isAbsent) {
                    statusChip = <span className="chip" style={{ background:'var(--gray-100)', color:'var(--gray-400)' }}>{isAbsent ? 'Absent' : 'N/A'}</span>;
                  } else if (!isNaN(num) && num >= 80) {
                    statusChip = <span className="chip chip-good">✅ Good</span>;
                  } else if (!isNaN(num) && num >= 50) {
                    statusChip = <span className="chip" style={{ background:'#fff3e0', color:'#b45309' }}>📊 Average</span>;
                  } else {
                    statusChip = <span className="chip chip-weak">⚠️ Needs Work</span>;
                  }
                  return (
                    <tr key={i}>
                      <td style={{ fontWeight:600, fontSize:13 }}>{testName}</td>
                      <td><span className="chip" style={{ background:'var(--csrl-blue-light)', color:'var(--csrl-blue)' }}>{sub}</span></td>
                      <td style={{ fontWeight:700, fontSize:16, color:'var(--csrl-blue)' }}>{r.score}</td>
                      <td>{statusChip}</td>
                    </tr>
                  );
                })}
                {rows.length === 0 && <tr><td colSpan={4} style={{ textAlign:'center', color:'var(--gray-400)', padding:32 }}>No scores recorded yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>
          {activePage === 'scores' ? '📋 My Scores' : '👤 My Profile'}
        </h1>
        <p style={{ marginTop:4, opacity:.75, fontSize:13 }}>
          {profile["STUDENT'S NAME"]} · {auth.id}
        </p>
      </div>
      <div className="content">
        {activePage === 'scores'
          ? <ScoresSection />
          : <StudentProfileView profile={profile} studentTests={studentTests} testColumns={testColumns} />
        }
      </div>
    </div>
  );
}
