import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { fetchGlobalData, getRankingsByTest, calculateAnalytics } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import StudentProfileView from './StudentProfileView';

export default function AdminDashboard() {
  const { activePage } = useOutletContext();
  const { user: auth } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewingStudentId, setViewingStudentId] = useState(null);
  const [selectedTestKey, setSelectedTestKey] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterCenter, setFilterCenter] = useState('ALL');

  useEffect(() => {
    fetchGlobalData(auth.token)
      .then(d => {
        setData(d);
        if (d.testColumns?.length > 0) setSelectedTestKey(d.testColumns[d.testColumns.length - 1]);
      })
      .catch(err => setError('Failed to load global data: ' + err.message))
      .finally(() => setLoading(false));
  }, []);

  const analytics = useMemo(() => {
    if (!data) return { totalStudents: 0, avgJee: 'N/A', highestJee: 'N/A' };
    return calculateAnalytics(data.profiles);
  }, [data]);

  const rankings = useMemo(() => {
    if (!data || !selectedTestKey) return { top10: [], bottom10: [], rankedScores: [] };
    const r = getRankingsByTest(data.profiles, data.tests, selectedTestKey);
    return { ...r, top10: r.rankedScores.slice(0, 30), bottom10: [...r.rankedScores].reverse().slice(0, 30) };
  }, [data, selectedTestKey]);

  const filteredStudents = useMemo(() => {
    if (!data) return [];
    return data.profiles.filter(p => {
      const matchSearch = (p["STUDENT'S NAME"]||'').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.ROLL_KEY||'').toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = filterCategory === 'ALL' || p.CATEGORY === filterCategory;
      const matchCenter = filterCenter === 'ALL' || p.centerCode === filterCenter;
      return matchSearch && matchCat && matchCenter;
    });
  }, [data, searchTerm, filterCategory, filterCenter]);

  const categories = useMemo(() => ['ALL', ...[...new Set(data?.profiles.map(p=>p.CATEGORY).filter(Boolean))]], [data]);
  const centersList = useMemo(() => ['ALL', ...[...new Set(data?.profiles.map(p=>p.centerCode).filter(Boolean))]], [data]);

  if (loading) return (
    <div style={{ display:'flex', height:'60vh', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'14px', color:'var(--gray-400)' }}>
      <div style={{ fontSize:'40px' }}>⏳</div>
      <p style={{ fontWeight:600 }}>Aggregating global database...</p>
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

  const RankingsSection = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
      <div className="card" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'12px' }}>
        <div className="section-title" style={{ margin:0 }}>📊 Select Test to Analyze</div>
        <select className="inp select" style={{ width:'auto', minWidth:'200px' }} value={selectedTestKey} onChange={e => setSelectedTestKey(e.target.value)}>
          {data.testColumns.map(col => <option key={col} value={col}>{col}</option>)}
        </select>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="section-title">🏆 Top 30 Performers</div>
          <div style={{ maxHeight:'460px', overflowY:'auto' }}>
            <table className="tbl">
              <thead><tr><th>#</th><th>Student</th><th>Centre</th><th>Score</th></tr></thead>
              <tbody>
                {rankings.top10.map((s, i) => (
                  <tr key={i}>
                    <td className={rankClass(i)} style={{ width:30 }}>{i + 1}</td>
                    <td><div style={{ fontWeight:600, fontSize:13 }}>{s.name}</div>
                        <div style={{ fontSize:11, color:'var(--gray-400)', fontFamily:'monospace' }}>{s.roll}</div></td>
                    <td><span className="chip" style={{ background:'var(--csrl-blue-light)', color:'var(--csrl-blue)' }}>{s.center}</span></td>
                    <td><span className="chip chip-good">{s.marks}</span></td>
                  </tr>
                ))}
                {rankings.top10.length === 0 && <tr><td colSpan={4} style={{ textAlign:'center', color:'var(--gray-400)', padding:'20px' }}>No data</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="section-title">⚠️ Needs Attention (Bottom 30)</div>
          <div style={{ maxHeight:'460px', overflowY:'auto' }}>
            <table className="tbl">
              <thead><tr><th>#</th><th>Student</th><th>Centre</th><th>Score</th></tr></thead>
              <tbody>
                {rankings.bottom10.map((s, i) => (
                  <tr key={i}>
                    <td style={{ color:'var(--gray-400)', width:30 }}>{i + 1}</td>
                    <td><div style={{ fontWeight:600, fontSize:13 }}>{s.name}</div>
                        <div style={{ fontSize:11, color:'var(--gray-400)', fontFamily:'monospace' }}>{s.roll}</div></td>
                    <td><span className="chip" style={{ background:'var(--csrl-blue-light)', color:'var(--csrl-blue)' }}>{s.center}</span></td>
                    <td><span className="chip chip-weak">{s.marks}</span></td>
                  </tr>
                ))}
                {rankings.bottom10.length === 0 && <tr><td colSpan={4} style={{ textAlign:'center', color:'var(--gray-400)', padding:'20px' }}>No data</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const StudentsSection = () => (
    <div className="card">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px', flexWrap:'wrap', gap:'10px' }}>
        <div className="section-title" style={{ margin:0 }}>🌐 Global Student Database ({filteredStudents.length})</div>
        <div className="search-row" style={{ margin:0 }}>
          <input type="text" className="inp" style={{ width:200 }} placeholder="Search name or roll..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          <select className="inp select" style={{ width:130 }} value={filterCenter} onChange={e => setFilterCenter(e.target.value)}>
            <option value="ALL">All Centres</option>
            {centersList.filter(c=>c!=='ALL').map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <select className="inp select" style={{ width:130 }} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            {categories.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div style={{ overflowX:'auto', maxHeight:'600px', overflowY:'auto' }}>
        <table className="tbl">
          <thead><tr><th>Roll No</th><th>Name</th><th>Centre</th><th>Category</th><th>Action</th></tr></thead>
          <tbody>
            {filteredStudents.map((s, i) => (
              <tr key={i}>
                <td style={{ fontWeight:700, color:'var(--csrl-blue)', fontFamily:'monospace' }}>{s.ROLL_KEY}</td>
                <td style={{ fontWeight:600 }}>{s["STUDENT'S NAME"]}</td>
                <td><span className="chip" style={{ background:'var(--csrl-blue-light)', color:'var(--csrl-blue)' }}>{s.centerCode}</span></td>
                <td><span className={`badge badge-${(s.CATEGORY||'general').toLowerCase()}`}>{s.CATEGORY||'General'}</span></td>
                <td><button onClick={() => setViewingStudentId(s.ROLL_KEY)} className="btn btn-primary btn-sm">View Profile</button></td>
              </tr>
            ))}
            {filteredStudents.length === 0 && <tr><td colSpan={5} style={{ textAlign:'center', color:'var(--gray-400)', padding:'32px' }}>No records found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  const DashboardSection = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
      <div className="grid-4">
        <div className="stat-card">
          <div className="stat-icon" style={{ background:'var(--csrl-blue-light)' }}>👥</div>
          <div><div className="stat-val" style={{ color:'var(--csrl-blue)' }}>{analytics.totalStudents}</div><div className="stat-lbl">Total Students</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background:'#fff3e0' }}>🏢</div>
          <div><div className="stat-val" style={{ color:'var(--csrl-orange)' }}>{centersList.length - 1}</div><div className="stat-lbl">Active Centres</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background:'var(--green-bg)' }}>📈</div>
          <div><div className="stat-val" style={{ color:'var(--green)' }}>{analytics.avgJee}</div><div className="stat-lbl">Avg JEE %ile</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background:'#fff3e0' }}>🏅</div>
          <div><div className="stat-val" style={{ color:'var(--csrl-gold)' }}>{analytics.highestJee}</div><div className="stat-lbl">Highest JEE %ile</div></div>
        </div>
      </div>
      <RankingsSection />
    </div>
  );

  const pageTitle = { dashboard: 'Overview', rankings: 'Test Rankings', students: 'Student Database' };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>🛡️ Super Admin — {pageTitle[activePage] || 'Overview'}</h1>
        <p style={{ marginTop:4, opacity:.75, fontSize:13 }}>Global Network · {centersList.length - 1} Centres</p>
      </div>
      <div className="content">
        {activePage === 'students' ? <StudentsSection /> :
         activePage === 'rankings' ? <RankingsSection /> :
         <DashboardSection />}
      </div>
    </div>
  );
}


