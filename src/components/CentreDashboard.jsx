import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { fetchCenterDataApi, getRankingsByTest, calculateAnalytics, getSubjectAverages } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import StudentProfileView from './StudentProfileView';

export default function CentreDashboard() {
  const { activePage } = useOutletContext();
  const { user: auth } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewingStudentId, setViewingStudentId] = useState(null);
  const [selectedTestKey, setSelectedTestKey] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');

  useEffect(() => {
    fetchCenterDataApi(null, auth.centerCode)
      .then(d => {
        setData(d);
        const rankingCols = (d.testColumns || []).filter((c) => !String(c).includes('_'));
        const candidate = rankingCols.length ? rankingCols[rankingCols.length - 1] : d.testColumns?.[0];
        if (candidate) setSelectedTestKey(candidate);
      })
      .catch(err => setError('Failed to load: ' + err.message))
      .finally(() => setLoading(false));
  }, [auth.centerCode]);

  const rankingTestColumns = useMemo(
    () => (data?.testColumns || []).filter((c) => !String(c).includes('_')),
    [data]
  );

  const analytics = useMemo(() => {
    if (!data) return { totalStudents: 0, avgJee: 'N/A', highestJee: 'N/A' };
    return calculateAnalytics(data.profiles);
  }, [data]);

  const rankings = useMemo(() => {
    if (!data || !selectedTestKey) return { top10: [], bottom10: [], absentCount: 0 };
    return getRankingsByTest(data.profiles, data.tests, selectedTestKey);
  }, [data, selectedTestKey]);

  const filteredStudents = useMemo(() => {
    if (!data) return [];
    return data.profiles.filter(p => {
      const matchSearch = (p["STUDENT'S NAME"] || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.ROLL_KEY || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = filterCategory === 'ALL' || p.CATEGORY === filterCategory;
      return matchSearch && matchCat;
    });
  }, [data, searchTerm, filterCategory]);

  const categories = useMemo(() => {
    const cats = new Set(data?.profiles.map(p => p.CATEGORY).filter(Boolean));
    return ['ALL', ...Array.from(cats)];
  }, [data]);

  // Weak subject from test averages
  const weakSubject = useMemo(() => {
    if (!data || !data.testColumns.length) return 'N/A';
    const totals = {}, counts = {};
    data.testColumns.forEach(col => {
      const parts = col.split(' ');
      const sub = parts.length > 1 ? parts[0] : col;
      data.tests.forEach(t => {
        const m = parseFloat(t[col]);
        if (!isNaN(m)) { totals[sub] = (totals[sub]||0)+m; counts[sub] = (counts[sub]||0)+1; }
      });
    });
    if (!Object.keys(totals).length) return 'N/A';
    return Object.entries(totals).sort((a,b)=>(a[1]/counts[a[0]])-(b[1]/counts[b[0]]))[0][0];
  }, [data]);

  // Subject averages — must stay here (above early returns) to follow Rules of Hooks
  const subjectAverages = useMemo(() => {
    if (!data) return [];
    return getSubjectAverages(data.tests, data.testColumns);
  }, [data]);

  if (loading) return (
    <div style={{ display:'flex', height:'60vh', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'14px', color:'var(--gray-400)' }}>
      <div style={{ fontSize:'40px', animation:'spin 1s linear infinite' }}>⏳</div>
      <p style={{ fontWeight:600 }}>Loading {auth.name}...</p>
    </div>
  );

  if (error) return <div style={{ color:'var(--red)', padding:'32px', textAlign:'center' }}>{error}</div>;

  if (viewingStudentId) {
    const profile = data.profiles.find(p => p.ROLL_KEY === viewingStudentId);
    const studentTests = data.tests.find(t => t.ROLL_KEY === viewingStudentId) || {};
    return (
      <div className="fade-in">
        <div className="page-header">
          <button onClick={() => setViewingStudentId(null)} className="btn btn-sm" style={{ background:'rgba(255,255,255,.15)', color:'#fff', border:'none', marginRight:'8px' }}>
            ← Back
          </button>
          <div>
            <h1>Student Profile</h1>
            <p>{profile?.["STUDENT'S NAME"]} · {viewingStudentId}</p>
          </div>
        </div>
        <div className="content">
          <StudentProfileView profile={profile} studentTests={studentTests} testColumns={data.testColumns} />
        </div>
      </div>
    );
  }

  const rankClass = (i) => i === 0 ? 'rank-gold' : i === 1 ? 'rank-silver' : i === 2 ? 'rank-bronze' : '';

  const pageTitle = { dashboard: 'Dashboard', rankings: 'Test Rankings', students: 'My Students', trends: 'Subject Trends' };

  // ─── STUDENTS PAGE ────────────────────────────────────────────────────────────
  const StudentsSection = () => (
    <div className="card">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px', flexWrap:'wrap', gap:'10px' }}>
        <div className="section-title" style={{ margin:0 }}>👥 Student Directory ({filteredStudents.length})</div>
        <div className="search-row" style={{ margin:0 }}>
          <input type="text" className="input" style={{ width:200 }} placeholder="Search name or roll..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          <select className="input select" style={{ width:130 }} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div style={{ overflowX:'auto', maxHeight:'600px', overflowY:'auto' }}>
        <table className="table">
          <thead><tr><th>Roll No</th><th>Name</th><th>Category</th><th>Action</th></tr></thead>
          <tbody>
            {filteredStudents.map((s, i) => (
              <tr key={i}>
                <td style={{ fontWeight:700, color:'var(--csrl-blue)', fontFamily:'monospace' }}>{s.ROLL_KEY}</td>
                <td>
                  <div className="student-row">
                    {s['STUDENT PHOTO URL']
                      ? <img src={s['STUDENT PHOTO URL']} style={{width:32,height:32,borderRadius:'50%',objectFit:'cover'}} alt="" referrerPolicy="no-referrer"/>
                      : <div className="avatar" style={{width:32,height:32,fontSize:12}}>{(s["STUDENT'S NAME"]||'?')[0]}</div>
                    }
                    <span style={{ fontWeight:600 }}>{s["STUDENT'S NAME"]}</span>
                  </div>
                </td>
                <td><span className={`badge badge-${(s.CATEGORY||'general').toLowerCase()}`}>{s.CATEGORY||'General'}</span></td>
                <td><button onClick={() => setViewingStudentId(s.ROLL_KEY)} className="btn btn-primary btn-sm">View Profile</button></td>
              </tr>
            ))}
            {filteredStudents.length === 0 && <tr><td colSpan={4} style={{ textAlign:'center', color:'var(--gray-400)', padding:'32px' }}>No students found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ─── RANKINGS PAGE ─────────────────────────────────────────────────────────────
  const RankingsSection = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
      <div className="card" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'12px' }}>
        <div className="section-title" style={{ margin:0 }}>📊 Select Test to Analyze</div>
        <select className="input select" style={{ width:'auto', minWidth:'200px' }} value={selectedTestKey} onChange={e => setSelectedTestKey(e.target.value)}>
          {rankingTestColumns.map(col => <option key={col} value={col}>{col}</option>)}
        </select>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="section-title">🏆 Top 10 — {selectedTestKey}</div>
          <table className="table">
            <thead><tr><th>#</th><th>Student</th><th>Score</th></tr></thead>
            <tbody>
              {rankings.top10.map((s, i) => (
                <tr key={s.roll}>
                  <td className={rankClass(i)}>{i + 1}</td>
                  <td>
                    <div style={{ fontWeight:600, fontSize:13 }}>{s.name}</div>
                    <div style={{ fontSize:11, color:'var(--gray-400)', fontFamily:'monospace' }}>{s.roll}</div>
                  </td>
                  <td><span className="chip chip-good">{s.marks}</span></td>
                </tr>
              ))}
              {rankings.top10.length === 0 && <tr><td colSpan={3} style={{ textAlign:'center', color:'var(--gray-400)', padding:'20px' }}>No data</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="section-title">⚠️ Needs Attention</div>
          <table className="table">
            <thead><tr><th>#</th><th>Student</th><th>Score</th></tr></thead>
            <tbody>
              {rankings.bottom10.map((s, i) => (
                <tr key={s.roll}>
                  <td style={{ color:'var(--gray-400)' }}>{i + 1}</td>
                  <td>
                    <div style={{ fontWeight:600, fontSize:13 }}>{s.name}</div>
                    <div style={{ fontSize:11, color:'var(--gray-400)', fontFamily:'monospace' }}>{s.roll}</div>
                  </td>
                  <td><span className="chip chip-weak">{s.marks}</span></td>
                </tr>
              ))}
              {rankings.bottom10.length === 0 && <tr><td colSpan={3} style={{ textAlign:'center', color:'var(--gray-400)', padding:'20px' }}>No data</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // ─── DASHBOARD PAGE ────────────────────────────────────────────────────────────
  const DashboardSection = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
      <div className="grid-4">
        <div className="stat-card">
          <div className="stat-icon" style={{ background:'var(--csrl-blue-light)' }}>👥</div>
          <div><div className="stat-val" style={{ color:'var(--csrl-blue)' }}>{analytics.totalStudents}</div><div className="stat-lbl">Total Students</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background:'#fff3e0' }}>📈</div>
          <div><div className="stat-val" style={{ color:'var(--csrl-gold)' }}>{analytics.avgJee}</div><div className="stat-lbl">Avg JEE %ile</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background:'var(--green-bg)' }}>🏅</div>
          <div><div className="stat-val" style={{ color:'var(--green)' }}>{analytics.highestJee}</div><div className="stat-lbl">Top JEE %ile</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background:'var(--red-bg)' }}>⚠️</div>
          <div><div className="stat-val" style={{ color:'var(--red)', fontSize:18 }}>{weakSubject}</div><div className="stat-lbl">Weakest Subject</div></div>
        </div>
      </div>
      <RankingsSection />
    </div>
  );

  const SubjectTrendsSection = () => {
    const maxAvg = Math.max(...subjectAverages.map(s => s.avg), 1);
    const COLORS = ['#1a4fa0','#f5a623','#1a8a4a','#e86b1f','#c0392b','#8e44ad'];
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
        {/* Subject cards */}
        <div className="grid-4">
          {subjectAverages.map((s, i) => {
            const isWeak = i === subjectAverages.length - 1;
            const isTop = i === 0;
            return (
              <div key={s.subject} className="stat-card" style={{ borderLeft: `4px solid ${COLORS[i % COLORS.length]}` }}>
                <div className="stat-icon" style={{ background: isWeak ? 'var(--red-bg)' : isTop ? 'var(--green-bg)' : 'var(--csrl-blue-light)' }}>
                  {isWeak ? '⚠️' : isTop ? '🏆' : '📊'}
                </div>
                <div>
                  <div className="stat-val" style={{ color: COLORS[i % COLORS.length], fontSize: 20 }}>{s.avg}</div>
                  <div className="stat-lbl">{s.subject} {isWeak ? '(Weakest)' : isTop ? '(Strongest)' : ''}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bar chart */}
        <div className="card">
          <div className="section-title">📊 Subject-wise Average Score</div>
          {subjectAverages.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={subjectAverages} margin={{ top:10, right:20, left:-10, bottom:5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                <XAxis dataKey="subject" tick={{ fontSize:13, fill:'var(--gray-600)' }} />
                <YAxis tick={{ fontSize:12, fill:'var(--gray-400)' }} />
                <Tooltip
                  contentStyle={{ background:'var(--white)', border:'1px solid var(--gray-100)', borderRadius:8, fontSize:13 }}
                  formatter={(val) => [`${val} avg marks`, 'Average']}
                />
                <Bar dataKey="avg" radius={[6,6,0,0]}>
                  {subjectAverages.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ color:'var(--gray-400)', textAlign:'center', padding:32 }}>No test data available yet.</p>
          )}
        </div>

        {/* Raw avg table */}
        <div className="card">
          <div className="section-title">📋 Subject Performance Details</div>
          <table className="table">
            <thead><tr><th>Subject</th><th>Avg Score</th><th>Data Points</th><th>Status</th></tr></thead>
            <tbody>
              {subjectAverages.map((s, i) => (
                <tr key={s.subject}>
                  <td style={{ fontWeight:700 }}>{s.subject}</td>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div className="progress-bar" style={{ flex:1 }}>
                        <div className="progress-fill" style={{ width:`${Math.round((s.avg/maxAvg)*100)}%`, background:COLORS[i%COLORS.length] }} />
                      </div>
                      <span style={{ fontWeight:700, color:COLORS[i%COLORS.length], minWidth:30 }}>{s.avg}</span>
                    </div>
                  </td>
                  <td style={{ color:'var(--gray-600)' }}>{s.count} records</td>
                  <td>
                    {i === 0 && <span className="chip chip-good">🏆 Strongest</span>}
                    {i === subjectAverages.length - 1 && i !== 0 && <span className="chip chip-weak">⚠️ Focus Needed</span>}
                    {i > 0 && i < subjectAverages.length - 1 && <span className="chip" style={{ background:'#f1f5f9', color:'var(--gray-600)' }}>ℹ️ Average</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>🏢 {auth.name} — {pageTitle[activePage] || 'Dashboard'}</h1>
        <p style={{ marginTop:4, opacity:.75, fontSize:13 }}>Centre Performance Hub</p>
      </div>
      <div className="content">
        {activePage === 'students' ? <StudentsSection /> :
         activePage === 'rankings' ? <RankingsSection /> :
         activePage === 'trends' ? <SubjectTrendsSection /> :
         <DashboardSection />}
      </div>
    </div>
  );
}



