import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { LayoutDashboard, Trophy, Users, AlertTriangle, BarChart2, BarChart3, TrendingUp, Building2, ArrowLeft, Loader2, Search, Eye } from 'lucide-react';
import {
  fetchCenterDataApi,
  fetchOverview,
  fetchRankings,
  fetchSubjectAverages,
  fetchTestInsights,
} from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import StudentProfileView from './StudentProfileView';
import { CENTERS } from '../config/centers';
import TestInsightsPanel from './TestInsightsPanel';

const TABS = [
  { key: 'overview',  Icon: LayoutDashboard, label: 'Overview'  },
  { key: 'topbottom', Icon: Trophy,          label: 'Rankings'  },
  { key: 'insights',  Icon: BarChart3,       label: 'Test analysis' },
  { key: 'students',  Icon: Users,           label: 'Students'  },
];

function getInitials(name = '') {
  return name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function CentreDashboard() {
  const { activePage, setActivePage } = useOutletContext();
  const { user: auth } = useAuth();

  const [data,             setData]             = useState(null);
  const [overview,         setOverview]         = useState(null);
  const [topRanked,        setTopRanked]        = useState([]);
  const [bottomRanked,     setBottomRanked]     = useState([]);
  const [allRanked,        setAllRanked]        = useState([]);
  const [subjectAvgs,      setSubjectAvgs]      = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState('');
  const [viewingStudentId, setViewingStudentId] = useState(null);
  const [selectedTestKey,  setSelectedTestKey]  = useState('');
  const [searchTerm,       setSearchTerm]       = useState('');
  const [testInsights, setTestInsights]         = useState(null);
  const [testInsightsLoading, setTestInsightsLoading] = useState(false);
  const [testInsightsError, setTestInsightsError]   = useState('');

  const centreTitle = CENTERS[auth.centerCode]?.name || auth.name || auth.centerCode;

  // ── Initial load ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      try {
        const [d, ov] = await Promise.all([
          fetchCenterDataApi(null, auth.centerCode),
          fetchOverview(null, auth.centerCode).catch(() => null),
        ]);
        setData(d);
        setOverview(ov);

        // Select first total-column from descending-sorted list as default test key
        const rankingCols = (d.testColumns || [])
          .filter((c) => !String(c).includes('_'))
          .sort((a, b) => String(b).localeCompare(String(a), undefined, { numeric: true, sensitivity: 'base' }));
        const candidate   = rankingCols.length ? rankingCols[0] : d.testColumns?.[0];
        if (candidate) setSelectedTestKey(candidate);
      } catch (err) {
        setError('Failed to load: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [auth.centerCode]);

  // Subject performance + weak subject for the selected test only
  useEffect(() => {
    if (!auth.centerCode || !selectedTestKey) return undefined;
    let cancelled = false;
    fetchSubjectAverages(null, auth.centerCode, selectedTestKey)
      .then((avgs) => {
        if (!cancelled) setSubjectAvgs(Array.isArray(avgs) ? avgs : []);
      })
      .catch(() => {
        if (!cancelled) setSubjectAvgs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [auth.centerCode, selectedTestKey]);

  // ── Reload rankings when selectedTestKey changes ──────────────────────────────

  useEffect(() => {
    if (!selectedTestKey) return;
    Promise.all([
      fetchRankings(null, { testKey: selectedTestKey, centerCode: auth.centerCode, limit: 30, order: 'desc' }).catch(() => ({ ranked: [] })),
      fetchRankings(null, { testKey: selectedTestKey, centerCode: auth.centerCode, limit: 30, order: 'asc'  }).catch(() => ({ ranked: [] })),
      fetchRankings(null, { testKey: selectedTestKey, centerCode: auth.centerCode, limit: Math.max(1000, data?.profiles?.length || 0), order: 'desc' }).catch(() => ({ ranked: [] })),
    ]).then(([top, bottom, all]) => {
      setTopRanked(top.ranked    || []);
      setBottomRanked(bottom.ranked || []);
      setAllRanked(all.ranked || []);
    });
  }, [selectedTestKey, auth.centerCode, data?.profiles?.length]);

  useEffect(() => {
    if (activePage !== 'insights' || !selectedTestKey) return undefined;
    let cancelled = false;
    setTestInsightsLoading(true);
    setTestInsightsError('');
    fetchTestInsights(null, selectedTestKey, null)
      .then((d) => {
        if (!cancelled) setTestInsights(d);
      })
      .catch((err) => {
        if (!cancelled) setTestInsightsError(err.message || 'Failed to load test analysis');
      })
      .finally(() => {
        if (!cancelled) setTestInsightsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activePage, selectedTestKey]);

  const rankingTestColumns = useMemo(
    () => (data?.testColumns || [])
      .filter((c) => !String(c).includes('_'))
      .sort((a, b) => String(b).localeCompare(String(a), undefined, { numeric: true, sensitivity: 'base' })),
    [data]
  );

  const filteredStudents = useMemo(() => {
    if (!data) return [];
    const q = searchTerm.toLowerCase();
    return data.profiles.filter((p) =>
      (p["STUDENT'S NAME"] || '').toLowerCase().includes(q) ||
      (p.ROLL_KEY         || '').toLowerCase().includes(q)
    );
  }, [data, searchTerm]);

  /** Lowest centre-wide subject average(s) from parsed test marks (same rule as overview KPI). */
  const { minSubjectAvg, weakSubjectFromPerformance } = useMemo(() => {
    if (!subjectAvgs.length) return { minSubjectAvg: null, weakSubjectFromPerformance: null };
    const minAvg = Math.min(...subjectAvgs.map((s) => s.avg));
    const tied = subjectAvgs.filter((s) => s.avg === minAvg);
    const label = tied.length === 1
      ? tied[0].subject
      : tied.map((t) => t.subject).join(', ');
    return { minSubjectAvg: minAvg, weakSubjectFromPerformance: label };
  }, [subjectAvgs]);

  // ── Render states ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="fade-in dashboard-page" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, color: 'var(--gray-400)' }}>
          <Loader2 size={36} className="spin" />
          <p style={{ fontWeight: 600 }}>Loading {centreTitle}…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fade-in dashboard-page" style={{ justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--red)' }}>
          <AlertTriangle size={20} />{error}
        </div>
      </div>
    );
  }

  if (viewingStudentId) {
    const profile      = data.profiles.find((p) => p.ROLL_KEY === viewingStudentId);
    const studentTests = data.tests.find((t) => t.ROLL_KEY === viewingStudentId) || {};
    return (
      <div className="fade-in dashboard-page">
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
        <div className="content dashboard-page-body">
          <div className="dashboard-scroll">
            <StudentProfileView profile={profile} studentTests={studentTests} testColumns={data.testColumns} />
          </div>
        </div>
      </div>
    );
  }

  // ── Section components ────────────────────────────────────────────────────────

  const OverviewSection = () => {
    const totalStudents = overview?.totalStudents ?? data.profiles.length;
    const weakSubject   = weakSubjectFromPerformance ?? overview?.weakSubject ?? 'N/A';
    const avgScore      = topRanked.length
      ? Math.round(topRanked.reduce((s, r) => s + r.marks, 0) / topRanked.length)
      : 0;
    const topScore = topRanked.length ? topRanked[0]?.marks ?? 0 : 0;

    const statCards = [
      { Icon: Users,         value: totalStudents, label: 'Students',     bg: '#e8f0fc', color: '#1a4fa0' },
      { Icon: AlertTriangle, value: weakSubject,   label: 'Weak Subject', bg: '#fdecea', color: 'var(--red)' },
      { Icon: BarChart2,     value: avgScore,      label: 'Avg Score',    bg: '#e6f5ed', color: '#1a6e3b' },
      { Icon: TrendingUp,    value: topScore,      label: 'Top Score',    bg: '#fff3e0', color: '#b45309' },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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

        {subjectAvgs.length > 0 && (
          <div className="card">
            <div className="section-title">Subject Performance — {selectedTestKey}</div>
            <div style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: -8, marginBottom: 12 }}>
              Averages for this test only. Weakest subject first (lowest average).
            </div>
            {subjectAvgs.map((s) => {
              const isWeakest = minSubjectAvg != null && s.avg === minSubjectAvg;
              return (
                <div key={s.subject} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                    <span style={{ fontWeight: isWeakest ? 700 : 400, color: isWeakest ? 'var(--red)' : 'inherit' }}>
                      {s.subject}
                      {isWeakest && <AlertTriangle size={12} style={{ marginLeft: 5 }} color="var(--red)" aria-hidden="true" />}
                    </span>
                    <span style={{ fontWeight: 600 }}>{s.avg}</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${Math.min(100, s.avg)}%`, background: isWeakest ? '#e74c3c' : '#1a4fa0' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const RankingsPair = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="grid-2">
        <div className="card">
        <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <TrendingUp size={14} aria-hidden="true" />
          Top 30 — {selectedTestKey}
        </div>
        <div className="table-wrap">
        <table className="table">
          <thead><tr><th>#</th><th>Student</th><th>Stream</th><th>Total</th></tr></thead>
          <tbody>
            {topRanked.map((s) => {
              const rankColor = s.rank === 1 ? '#d97706' : s.rank === 2 ? '#6b7280' : s.rank === 3 ? '#c2410c' : 'inherit';
              return (
                <tr key={s.roll} style={{ cursor: 'pointer' }} onClick={() => setViewingStudentId(s.roll)}>
                  <td><span style={{ fontWeight: 800, color: rankColor }}>{s.rank}</span></td>
                  <td>
                    <div className="student-row">
                      <div className="avatar">{getInitials(s.name)}</div>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 3, background: s.stream === 'NEET' ? '#e6f5ed' : '#e8f0fc', color: s.stream === 'NEET' ? '#1a6e3b' : '#1a4fa0', fontWeight: 600 }}>
                      {s.stream || 'JEE'}
                    </span>
                  </td>
                  <td><strong style={{ color: '#1a4fa0' }}>{s.marks}</strong></td>
                </tr>
              );
            })}
            {!topRanked.length && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 20 }}>No data for {selectedTestKey}</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

        <div className="card">
        <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={14} color="var(--red)" aria-hidden="true" />
          Bottom 30 — {selectedTestKey}
        </div>
        <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Rank</th><th>Student</th><th>Total</th></tr></thead>
          <tbody>
            {bottomRanked.map((s) => (
              <tr key={s.roll} style={{ cursor: 'pointer' }} onClick={() => setViewingStudentId(s.roll)}>
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
            {!bottomRanked.length && (
              <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 20 }}>No data</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
      </div>

      <div className="card">
        <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Trophy size={14} aria-hidden="true" />
          All students rankwise — {selectedTestKey}
        </div>
        <div className="table-wrap" style={{ maxHeight: 440, overflowY: 'auto' }}>
          <table className="table">
            <thead><tr><th>Rank</th><th>Student</th><th>Stream</th><th>Total</th></tr></thead>
            <tbody>
              {allRanked.map((s) => (
                <tr key={`all-${s.roll}`} style={{ cursor: 'pointer' }} onClick={() => setViewingStudentId(s.roll)}>
                  <td><strong>#{s.rank}</strong></td>
                  <td>
                    <div className="student-row">
                      <div className="avatar">{getInitials(s.name)}</div>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 3, background: s.stream === 'NEET' ? '#e6f5ed' : '#e8f0fc', color: s.stream === 'NEET' ? '#1a6e3b' : '#1a4fa0', fontWeight: 600 }}>
                      {s.stream || 'JEE'}
                    </span>
                  </td>
                  <td><strong style={{ color: '#1a4fa0' }}>{s.marks}</strong></td>
                </tr>
              ))}
              {!allRanked.length && (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 20 }}>No data for {selectedTestKey}</td></tr>
              )}
            </tbody>
          </table>
        </div>
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
          style={{ maxWidth: 280, paddingLeft: 30, width: '100%' }}
        />
      </div>
      <div className="table-wrap">
      <table className="table">
        <thead>
          <tr><th>Roll</th><th>Name</th><th>Stream</th><th>Category</th><th>Mobile</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {filteredStudents.map((s) => (
            <tr key={s.ROLL_KEY} style={{ cursor: 'pointer' }} onClick={() => setViewingStudentId(s.ROLL_KEY)}>
              <td><strong style={{ color: '#1a4fa0' }}>{s.ROLL_KEY}</strong></td>
              <td>
                <div className="student-row">
                  <div className="avatar">{getInitials(s["STUDENT'S NAME"])}</div>
                  <strong>{s["STUDENT'S NAME"]}</strong>
                </div>
              </td>
              <td>
                <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 3, background: s.stream === 'NEET' ? '#e6f5ed' : '#e8f0fc', color: s.stream === 'NEET' ? '#1a6e3b' : '#1a4fa0', fontWeight: 600 }}>
                  {s.stream || 'JEE'}
                </span>
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
    </div>
  );

  // ── Main render ────────────────────────────────────────────────────────────────

  return (
    <div className="fade-in dashboard-page">
      <div className="page-header">
        <div style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,.15)', flexShrink: 0 }}>
          <Building2 size={24} color="#fff" aria-hidden="true" />
        </div>
        <div>
          <h1>{centreTitle}</h1>
          <p>{data.profiles.length} students</p>
        </div>
        <div className="page-header-toolbar" style={{ marginLeft: 'auto' }}>
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

      <div className="content dashboard-page-body">
        <div style={{ marginBottom: 14, flexShrink: 0 }}>
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

        <div className="dashboard-scroll">
          {activePage === 'overview'  && <OverviewSection />}
          {activePage === 'insights' && (
            <TestInsightsPanel
              insights={testInsights}
              loading={testInsightsLoading}
              error={testInsightsError}
              highlightCenter={auth.centerCode}
              testKey={selectedTestKey}
            />
          )}
          {activePage === 'topbottom' && <RankingsPair />}
          {activePage === 'students'  && <StudentsSection />}
        </div>
      </div>
    </div>
  );
}
