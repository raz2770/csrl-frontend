import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  fetchGlobalData, getRankingsByTest, calculateAnalytics,
  rankCentres, addStudentApi, updateStudentApi, deleteStudentApi, upsertTestScoresApi
} from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import StudentProfileView from './StudentProfileView';
import StudentFormModal from './StudentFormModal';
import TestDataModal from './TestDataModal';

export default function AdminDashboard() {
  const { activePage } = useOutletContext();
  const { user: auth } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Navigation sub-state
  const [viewingStudentId, setViewingStudentId] = useState(null);
  const [selectedTestKey, setSelectedTestKey] = useState('');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterCenter, setFilterCenter] = useState('ALL');

  // Modals
  const [modalMode, setModalMode] = useState(null); // 'add' | 'edit' | 'tests' | null
  const [modalStudent, setModalStudent] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    fetchGlobalData(auth.token)
      .then(d => { setData(d); if (d.testColumns?.length > 0) setSelectedTestKey(d.testColumns[d.testColumns.length - 1]); })
      .catch(err => setError('Failed to load: ' + err.message))
      .finally(() => setLoading(false));
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const analytics = useMemo(() => data ? calculateAnalytics(data.profiles) : { totalStudents: 0, avgJee: 'N/A', highestJee: 'N/A' }, [data]);
  const rankings = useMemo(() => {
    if (!data || !selectedTestKey) return { top10: [], bottom10: [], rankedScores: [] };
    const r = getRankingsByTest(data.profiles, data.tests, selectedTestKey);
    return { ...r, top10: r.rankedScores.slice(0, 30), bottom10: [...r.rankedScores].reverse().slice(0, 30) };
  }, [data, selectedTestKey]);
  const centreRankings = useMemo(() => data ? rankCentres(data.profiles, data.tests, data.testColumns) : [], [data]);

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

  // ── CRUD handlers ──────────────────────────────────────────────────────────
  const handleAddStudent = async (form) => {
    setModalLoading(true);
    try {
      const result = await addStudentApi(auth.token, form);
      setData(d => ({ ...d, profiles: [...d.profiles, result.student] }));
      setModalMode(null);
      showToast('✅ Student added successfully!');
    } catch (e) { showToast('❌ ' + e.message); }
    finally { setModalLoading(false); }
  };

  const handleEditStudent = async (form) => {
    setModalLoading(true);
    try {
      const result = await updateStudentApi(auth.token, modalStudent.ROLL_KEY, form);
      setData(d => ({ ...d, profiles: d.profiles.map(p => p.ROLL_KEY === modalStudent.ROLL_KEY ? result.student : p) }));
      setModalMode(null);
      showToast('✅ Student updated!');
    } catch (e) { showToast('❌ ' + e.message); }
    finally { setModalLoading(false); }
  };

  const handleDeleteStudent = async (rollKey) => {
    if (!window.confirm(`Delete student ${rollKey}? This cannot be undone.`)) return;
    try {
      await deleteStudentApi(auth.token, rollKey);
      setData(d => ({ ...d, profiles: d.profiles.filter(p => p.ROLL_KEY !== rollKey), tests: d.tests.filter(t => t.ROLL_KEY !== rollKey) }));
      showToast('🗑️ Student deleted.');
    } catch (e) { showToast('❌ ' + e.message); }
  };

  const handleSaveTestScores = async (scores) => {
    setModalLoading(true);
    try {
      const result = await upsertTestScoresApi(auth.token, modalStudent.ROLL_KEY, scores);
      setData(d => ({
        ...d,
        tests: d.tests.map(t => t.ROLL_KEY === modalStudent.ROLL_KEY ? result.testRecord : t)
          .concat(d.tests.find(t => t.ROLL_KEY === modalStudent.ROLL_KEY) ? [] : [result.testRecord])
      }));
      setModalMode(null);
      showToast('✅ Test scores saved!');
    } catch (e) { showToast('❌ ' + e.message); }
    finally { setModalLoading(false); }
  };

  const rankClass = (i) => i === 0 ? 'rank-gold' : i === 1 ? 'rank-silver' : i === 2 ? 'rank-bronze' : '';

  if (loading) return (
    <div style={{ display:'flex', height:'60vh', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'14px', color:'var(--gray-400)' }}>
      <div style={{ fontSize:40 }}>⏳</div><p style={{ fontWeight:600 }}>Aggregating all centre data...</p>
    </div>
  );
  if (error) return <div style={{ color:'var(--red)', padding:32, textAlign:'center' }}>{error}</div>;

  if (viewingStudentId) {
    const profile = data.profiles.find(p => p.ROLL_KEY === viewingStudentId);
    const studentTests = data.tests.find(t => t.ROLL_KEY === viewingStudentId) || {};
    return (
      <div className="fade-in">
        <div className="page-header">
          <button onClick={() => setViewingStudentId(null)} className="btn btn-sm" style={{ background:'rgba(255,255,255,.15)', color:'#fff', border:'none', marginRight:8 }}>← Back</button>
          <div><h1>Student Profile</h1><p>{profile?.["STUDENT'S NAME"]} · {viewingStudentId}</p></div>
        </div>
        <div className="content">
          <StudentProfileView profile={profile} studentTests={studentTests} testColumns={data.testColumns} />
        </div>
      </div>
    );
  }

  const pageTitle = { dashboard: 'Overview', 'centre-rankings': 'Centre Rankings', students: 'Student Database', rankings: 'Test Rankings' };

  // ── Sections ───────────────────────────────────────────────────────────────

  const DashboardSection = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div className="grid-4">
        <div className="stat-card"><div className="stat-icon" style={{ background:'var(--csrl-blue-light)' }}>👥</div><div><div className="stat-val" style={{ color:'var(--csrl-blue)' }}>{analytics.totalStudents}</div><div className="stat-lbl">Total Students</div></div></div>
        <div className="stat-card"><div className="stat-icon" style={{ background:'#fff3e0' }}>🏢</div><div><div className="stat-val" style={{ color:'var(--csrl-orange)' }}>{centersList.length - 1}</div><div className="stat-lbl">Active Centres</div></div></div>
        <div className="stat-card"><div className="stat-icon" style={{ background:'var(--green-bg)' }}>📈</div><div><div className="stat-val" style={{ color:'var(--green)' }}>{analytics.avgJee}</div><div className="stat-lbl">Avg JEE %ile</div></div></div>
        <div className="stat-card"><div className="stat-icon" style={{ background:'#fff3e0' }}>🏅</div><div><div className="stat-val" style={{ color:'var(--csrl-gold)' }}>{analytics.highestJee}</div><div className="stat-lbl">Highest JEE %ile</div></div></div>
      </div>
      {/* Mini Centre Rankings preview */}
      <div className="card">
        <div className="section-title">🏆 Centre Performance Leaderboard</div>
        <table className="tbl">
          <thead><tr><th>#</th><th>Centre</th><th>Students</th><th>Avg Score</th><th>Weak Subject</th></tr></thead>
          <tbody>
            {centreRankings.slice(0, 5).map((c, i) => (
              <tr key={c.code}>
                <td className={rankClass(i)}>{c.rank}</td>
                <td style={{ fontWeight:700, color:'var(--csrl-blue)' }}>{c.code}</td>
                <td>{c.studentCount}</td>
                <td><span className="chip chip-good">{c.avgScore}</span></td>
                <td><span className="chip chip-weak">{c.weakSubject}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const CentreRankingsSection = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className="grid-3">
        <div className="stat-card"><div className="stat-icon" style={{ background:'#fff3e0' }}>🥇</div><div><div className="stat-val" style={{ color:'var(--csrl-gold)' }}>{centreRankings[0]?.code || '—'}</div><div className="stat-lbl">Top Centre</div></div></div>
        <div className="stat-card"><div className="stat-icon" style={{ background:'var(--csrl-blue-light)' }}>🏢</div><div><div className="stat-val" style={{ color:'var(--csrl-blue)' }}>{centreRankings.length}</div><div className="stat-lbl">Total Centres</div></div></div>
        <div className="stat-card"><div className="stat-icon" style={{ background:'var(--green-bg)' }}>📊</div><div><div className="stat-val" style={{ color:'var(--green)', fontSize:18 }}>{centreRankings[0]?.avgScore || '—'}</div><div className="stat-lbl">Highest Avg Score</div></div></div>
      </div>
      <div className="card">
        <div className="section-title">🏆 All Centre Rankings — by Average Test Score</div>
        <div style={{ overflowX:'auto' }}>
          <table className="tbl">
            <thead>
              <tr><th>#</th><th>Centre Code</th><th>Students</th><th>Avg Score</th><th>Weak Subject</th><th>Performance</th></tr>
            </thead>
            <tbody>
              {centreRankings.map((c, i) => {
                const maxAvg = centreRankings[0]?.avgScore || 1;
                const pct = Math.round((c.avgScore / maxAvg) * 100);
                return (
                  <tr key={c.code}>
                    <td className={rankClass(i)} style={{ fontWeight:800 }}>{c.rank}</td>
                    <td style={{ fontWeight:700, color:'var(--csrl-blue)', fontSize:15 }}>{c.code}</td>
                    <td>{c.studentCount}</td>
                    <td><span className={`chip ${c.rank <= 3 ? 'chip-good' : ''}`} style={c.rank > 3 ? { background:'var(--csrl-blue-light)', color:'var(--csrl-blue)' } : {}}>{c.avgScore}</span></td>
                    <td><span className="chip chip-weak">{c.weakSubject}</span></td>
                    <td style={{ width:120 }}>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width:`${pct}%`, background: c.rank <= 5 ? 'var(--green)' : c.rank <= 15 ? 'var(--csrl-gold)' : 'var(--csrl-orange)' }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {centreRankings.length === 0 && <tr><td colSpan={6} style={{ textAlign:'center', color:'var(--gray-400)', padding:32 }}>No data available</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const StudentsSection = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <input type="text" className="inp" style={{ width:200 }} placeholder="Search name or roll..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          <select className="inp select" style={{ width:130 }} value={filterCenter} onChange={e => setFilterCenter(e.target.value)}>
            <option value="ALL">All Centres</option>
            {centersList.filter(c=>c!=='ALL').map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <select className="inp select" style={{ width:130 }} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            {categories.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button onClick={() => { setModalStudent(null); setModalMode('add'); }} className="btn btn-primary">
          ➕ Add Student
        </button>
      </div>
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <div style={{ overflowX:'auto', maxHeight:600, overflowY:'auto' }}>
          <table className="tbl">
            <thead><tr><th>Roll No</th><th>Name</th><th>Centre</th><th>Category</th><th>Actions</th></tr></thead>
            <tbody>
              {filteredStudents.map((s, i) => (
                <tr key={i}>
                  <td style={{ fontWeight:700, color:'var(--csrl-blue)', fontFamily:'monospace' }}>{s.ROLL_KEY}</td>
                  <td style={{ fontWeight:600 }}>{s["STUDENT'S NAME"]}</td>
                  <td><span className="chip" style={{ background:'var(--csrl-blue-light)', color:'var(--csrl-blue)' }}>{s.centerCode}</span></td>
                  <td><span className={`badge badge-${(s.CATEGORY||'general').toLowerCase()}`}>{s.CATEGORY||'General'}</span></td>
                  <td>
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={() => setViewingStudentId(s.ROLL_KEY)} className="btn btn-primary btn-sm">View</button>
                      <button onClick={() => { setModalStudent(s); setModalMode('edit'); }} className="btn btn-outline btn-sm">Edit</button>
                      <button onClick={() => { setModalStudent(s); setModalMode('tests'); }} className="btn btn-sm" style={{ background:'#fff3e0', color:'#b45309', border:'1px solid #fed7aa' }}>Tests</button>
                      <button onClick={() => handleDeleteStudent(s.ROLL_KEY)} className="btn btn-danger btn-sm">Del</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredStudents.length === 0 && <tr><td colSpan={5} style={{ textAlign:'center', color:'var(--gray-400)', padding:32 }}>No records found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const RankingsSection = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className="card" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div className="section-title" style={{ margin:0 }}>📊 Select Test</div>
        <select className="inp select" style={{ width:'auto', minWidth:220 }} value={selectedTestKey} onChange={e => setSelectedTestKey(e.target.value)}>
          {data.testColumns.map(col => <option key={col} value={col}>{col}</option>)}
        </select>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="section-title">🏆 Top 30 Performers</div>
          <div style={{ maxHeight:460, overflowY:'auto' }}>
            <table className="tbl">
              <thead><tr><th>#</th><th>Student</th><th>Centre</th><th>Score</th></tr></thead>
              <tbody>
                {rankings.top10.map((s, i) => (
                  <tr key={i} style={{ cursor:'pointer' }} onClick={() => setViewingStudentId(s.roll)}>
                    <td className={rankClass(i)}>{i+1}</td>
                    <td><div style={{ fontWeight:600, fontSize:13 }}>{s.name}</div><div style={{ fontSize:11, color:'var(--gray-400)', fontFamily:'monospace' }}>{s.roll}</div></td>
                    <td><span className="chip" style={{ background:'var(--csrl-blue-light)', color:'var(--csrl-blue)' }}>{s.center}</span></td>
                    <td><span className="chip chip-good">{s.marks}</span></td>
                  </tr>
                ))}
                {rankings.top10.length === 0 && <tr><td colSpan={4} style={{ textAlign:'center', color:'var(--gray-400)', padding:20 }}>No data</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="section-title">⚠️ Bottom 30 — Needs Attention</div>
          <div style={{ maxHeight:460, overflowY:'auto' }}>
            <table className="tbl">
              <thead><tr><th>#</th><th>Student</th><th>Centre</th><th>Score</th></tr></thead>
              <tbody>
                {rankings.bottom10.map((s, i) => (
                  <tr key={i} style={{ cursor:'pointer' }} onClick={() => setViewingStudentId(s.roll)}>
                    <td style={{ color:'var(--gray-400)' }}>{i+1}</td>
                    <td><div style={{ fontWeight:600, fontSize:13 }}>{s.name}</div><div style={{ fontSize:11, color:'var(--gray-400)', fontFamily:'monospace' }}>{s.roll}</div></td>
                    <td><span className="chip" style={{ background:'var(--csrl-blue-light)', color:'var(--csrl-blue)' }}>{s.center}</span></td>
                    <td><span className="chip chip-weak">{s.marks}</span></td>
                  </tr>
                ))}
                {rankings.bottom10.length === 0 && <tr><td colSpan={4} style={{ textAlign:'center', color:'var(--gray-400)', padding:20 }}>No data</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fade-in">
      {/* Toast */}
      {toast && (
        <div style={{
          position:'fixed', top:16, right:16, zIndex:2000,
          background: toast.startsWith('❌') ? 'var(--red)' : '#1a8a4a',
          color:'#fff', padding:'12px 20px', borderRadius:'var(--radius)', boxShadow:'var(--shadow-lg)',
          fontSize:14, fontWeight:600
        }}>{toast}</div>
      )}

      {/* Modals */}
      {(modalMode === 'add' || modalMode === 'edit') && (
        <StudentFormModal
          mode={modalMode}
          student={modalStudent}
          loading={modalLoading}
          onClose={() => setModalMode(null)}
          onSubmit={modalMode === 'add' ? handleAddStudent : handleEditStudent}
        />
      )}
      {modalMode === 'tests' && (
        <TestDataModal
          student={modalStudent}
          testColumns={data.testColumns}
          existingScores={data.tests.find(t => t.ROLL_KEY === modalStudent?.ROLL_KEY) || {}}
          loading={modalLoading}
          onClose={() => setModalMode(null)}
          onSubmit={handleSaveTestScores}
        />
      )}

      <div className="page-header">
        <h1>🛡️ Super Admin — {pageTitle[activePage] || 'Overview'}</h1>
        <p style={{ marginTop:4, opacity:.75, fontSize:13 }}>Global Network · {centreRankings.length} Centres · {analytics.totalStudents} Students</p>
      </div>
      <div className="content">
        {activePage === 'centre-rankings' ? <CentreRankingsSection /> :
         activePage === 'students' ? <StudentsSection /> :
         activePage === 'rankings' ? <RankingsSection /> :
         <DashboardSection />}
      </div>
    </div>
  );
}
