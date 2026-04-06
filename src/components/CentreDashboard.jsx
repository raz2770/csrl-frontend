import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { LayoutDashboard, Trophy, Users, AlertTriangle, BarChart2, TrendingUp, Building2, ArrowLeft, Loader2, Search, Eye } from 'lucide-react';
import { fetchCenterDataApi, getRankingsByTest, calculateAnalytics } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import StudentProfileView from './StudentProfileView';
import { CENTERS } from '../config/centers';

const TABS = [
  { key: 'overview',   Icon: LayoutDashboard, label: 'Overview'  },
  { key: 'topbottom',  Icon: Trophy,          label: 'Rankings'  },
  { key: 'students',   Icon: Users,           label: 'Students'  },
];

function getInitials(name = '') {
  return name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function CentreDashboard() {
  const { activePage, setActivePage } = useOutletContext();
  const { user: auth } = useAuth();

  const [data,             setData]             = useState(null);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState('');
  const [viewingStudentId, setViewingStudentId] = useState(null);
  const [selectedTestKey,  setSelectedTestKey]  = useState('');
  const [searchTerm,       setSearchTerm]       = useState('');

  const centreTitle = CENTERS[auth.centerCode]?.name || auth.name || auth.centerCode;

  useEffect(() => {
    fetchCenterDataApi(null, auth.centerCode)
      .then((d) => {
        setData(d);
        const rankingCols = (d.testColumns || []).filter((c) => !String(c).includes('_'));
        const candidate   = rankingCols.length ? rankingCols[rankingCols.length - 1] : d.testColumns?.[0];
        if (candidate) setSelectedTestKey(candidate);
      })
      .catch((err) => setError('Failed to load: ' + err.message))
      .finally(() => setLoading(false));
  }, [auth.centerCode]);

  const rankingTestColumns = useMemo(
    () => (data?.testColumns || []).filter((c) => !String(c).includes('_')),
    [data]
  );

  const analytics = useMemo(
    () => data ? calculateAnalytics(data.profiles) : { totalStudents: 0 },
    [data]
  );

  const rankings = useMemo(() => {
    if (!data || !selectedTestKey) return { top10: [], bottom10: [], absentCount: 0 };
    return getRankingsByTest(data.profiles, data.tests, selectedTestKey);
  }, [data, selectedTestKey]);

  const filteredStudents = useMemo(() => {
    if (!data) return [];
    const q = searchTerm.toLowerCase();
    return data.profiles.filter((p) =>
      (p["STUDENT'S NAME"] || '').toLowerCase().includes(q) ||
      (p.ROLL_KEY || '').toLowerCase().includes(q)
    );
  }, [data, searchTerm]);

  const weakSubject = useMemo(() => {
    if (!data || !data.testColumns.length) return 'N/A';
    const totals = {};
    const counts = {};
    data.testColumns.forEach((col) => {
      const parts = col.split(' ');
      const sub   = parts.length > 1 ? parts[0] : col;
      data.tests.forEach((t) => {
        const m = parseFloat(t[col]);
        if (!isNaN(m)) {
          totals[sub] = (totals[sub] || 0) + m;
          counts[sub] = (counts[sub] || 0) + 1;
        }
      });
    });
    if (!Object.keys(totals).length) return 'N/A';
    return Object.entries(totals).sort((a, b) => a[1] / counts[a[0]] - b[1] / counts[b[0]])[0][0];
  }, [data]);

  const testMarks = useMemo(() => {
    if (!data || !selectedTestKey) return [];
    const rolls = new Set(data.profiles.map((p) => p.ROLL_KEY));
    return data.tests
      .filter((t) => rolls.has(t.ROLL_KEY))
      .map((t) => ({ ...t, score: parseFloat(t[selectedTestKey]) }))
      .filter((t) => !isNaN(t.score));
  }, [data, selectedTestKey]);

  const avgScore = useMemo(
    () => testMarks.length ? Math.round(testMarks.reduce((s, m) => s + m.score, 0) / testMarks.length) : 0,
    [testMarks]
  );
  const topScore = useMemo(
    () => testMarks.length ? Math.max(...testMarks.map((m) => m.score)) : 0,
    [testMarks]
  );

  // ── Render states ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '60vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, color: 'var(--gray-400)' }}>
        <Loader2 size={36} className="spin" />
        <p style={{ fontWeight: 600 }}>Loading {centreTitle}…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--red)', padding: 32, justifyContent: 'center' }}>
        <AlertTriangle size={20} />
        {error}
      </div>
    );
  }

  if (viewingStudentId) {
    const profile      = data.profiles.find((p) => p.ROLL_KEY === viewingStudentId);
    const studentTests = data.tests.find((t) => t.ROLL_KEY === viewingStudentId) || {};
    return (
      <div className="fade-in">
        <div className="page-header">
          <button
            type="button"
            onClick={() => setViewingStudentId(null)}
            className="btn btn-sm"
            style={{ background: 'rgba(255,255,255,.15)', color: '#fff', border: 'none', marginRight: 8, gap: 5 }}
          >
            <ArrowLeft size={14} /> Back
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

  // ── Section components ────────────────────────────────────────────────────────

  const OverviewSection = () => {
    const statCards = [
      { Icon: Users,         value: analytics.totalStudents, label: 'Students',     bg: '#e8f0fc', color: '#1a4fa0' },
      { Icon: AlertTriangle, value: weakSubject,             label: 'Weak Subject', bg: '#fdecea', color: 'var(--red)' },
      { Icon: BarChart2,     value: avgScore,                label: 'Avg Score',    bg: '#e6f5ed', color: '#1a6e3b' },
      { Icon: TrendingUp,    value: topScore,                label: 'Top Score',    bg: '#fff3e0', color: '#b45309' },
    ];
    return (
      <div className="grid-4">
        {statCards.map(({ Icon, value, label, bg, color }) => (
          <div className="stat-card" key={label}>
            <div className="stat-icon" style={{ background: bg }}>
              <Icon size={20} color={color} aria-hidden="true" />
            </div>
            <div>
              <div className="stat-val" style={{ color }}>{value}</div>
              <div className="stat-lbl">{label}</div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const RankingsPair = () => (
    <div className="grid-2">
      <div className="card">
        <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <TrendingUp size={14} aria-hidden="true" />
          Top 10 — {selectedTestKey}
        </div>
        <table className="table">
          <thead><tr><th>#</th><th>Student</th><th>Total</th></tr></thead>
          <tbody>
            {rankings.top10.map((s) => {
              const rankColor = s.rank === 1 ? '#d97706' : s.rank === 2 ? '#6b7280' : s.rank === 3 ? '#c2410c' : 'inherit';
              return (
                <tr key={s.roll}>
                  <td><span style={{ fontWeight: 800, color: rankColor }}>{s.rank}</span></td>
                  <td>
                    <div className="student-row">
                      <div className="avatar">{getInitials(s.name)}</div>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</span>
                    </div>
                  </td>
                  <td><strong style={{ color: '#1a4fa0' }}>{s.marks}</strong></td>
                </tr>
              );
            })}
            {!rankings.top10.length && (
              <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 20 }}>No data</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={14} color="var(--red)" aria-hidden="true" />
          Bottom 10 — {selectedTestKey}
        </div>
        <table className="table">
          <thead><tr><th>Rank</th><th>Student</th><th>Total</th></tr></thead>
          <tbody>
            {rankings.bottom10.map((s) => (
              <tr key={s.roll}>
                <td style={{ color: 'var(--red)', fontWeight: 700 }}>#{s.rank}</td>
                <td>
                  <div className="student-row">
                    <div className="avatar" style={{ background: '#fdecea', color: 'var(--red)' }}>{getInitials(s.name)}</div>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</span>
                  </div>
                </td>
                <td><strong style={{ color: 'var(--red)' }}>{s.marks}</strong></td>
              </tr>
            ))}
            {!rankings.bottom10.length && (
              <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 20 }}>No data</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const StudentsSection = () => (
    <div className="card">
      <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Users size={14} aria-hidden="true" />
        All Students ({filteredStudents.length})
      </div>
      <div style={{ marginBottom: 12, position: 'relative', display: 'inline-block' }}>
        <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', pointerEvents: 'none' }} />
        <input
          className="input"
          placeholder="Search by name or roll…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ maxWidth: 280, paddingLeft: 30 }}
        />
      </div>
      <table className="table">
        <thead>
          <tr><th>Roll</th><th>Name</th><th>Category</th><th>Mobile</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {filteredStudents.map((s) => (
            <tr key={s.ROLL_KEY}>
              <td><strong style={{ color: '#1a4fa0' }}>{s.ROLL_KEY}</strong></td>
              <td>
                <div className="student-row">
                  <div className="avatar">{getInitials(s["STUDENT'S NAME"])}</div>
                  <strong>{s["STUDENT'S NAME"]}</strong>
                </div>
              </td>
              <td><span className={`badge badge-${(s.CATEGORY || 'general').toLowerCase()}`}>{s.CATEGORY || 'General'}</span></td>
              <td style={{ fontSize: 13, color: 'var(--gray-600)' }}>{s['Mobile No.'] || '—'}</td>
              <td>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  aria-label="View student profile"
                  onClick={() => setViewingStudentId(s.ROLL_KEY)}
                >
                  <Eye size={13} />
                </button>
              </td>
            </tr>
          ))}
          {!filteredStudents.length && (
            <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--gray-400)' }}>No students found.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  // ── Main render ────────────────────────────────────────────────────────────────

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,.15)', flexShrink: 0 }}>
          <Building2 size={24} color="#fff" aria-hidden="true" />
        </div>
        <div>
          <h1>{centreTitle}</h1>
          <p>{data.profiles.length} students · Super 30</p>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <select
            className="input select"
            value={selectedTestKey}
            onChange={(e) => setSelectedTestKey(e.target.value)}
            style={{ background: 'rgba(255,255,255,.15)', color: '#fff', borderColor: 'rgba(255,255,255,.3)', width: 200 }}
          >
            {rankingTestColumns.map((t) => <option key={t} value={t} style={{ color: '#333' }}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="content">
        <div style={{ marginBottom: 14 }}>
          <div className="tab-bar">
            {TABS.map(({ key, Icon, label }) => (
              <button
                key={key}
                type="button"
                className={`tab${activePage === key ? ' active' : ''}`}
                onClick={() => setActivePage(key)}
              >
                <Icon size={13} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {activePage === 'overview'   && <OverviewSection />}
        {activePage === 'topbottom'  && <RankingsPair />}
        {activePage === 'students'   && <StudentsSection />}
      </div>
    </div>
  );
}
