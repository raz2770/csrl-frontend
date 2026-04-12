import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { LineChart, Line, XAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { User, BarChart2, BarChart3, AlertTriangle, Loader2 } from 'lucide-react';
import {
  fetchStudentData,
  fetchStudentChart,
  fetchTestInsights,
  buildStudentChartData,
  computeWeakSubject,
  getStreamConfig,
  getExamResult,
  getMaxMarksForSubject,
  resolveStudentPhotoUrl,
} from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import TestInsightsPanel from './TestInsightsPanel';

const TABS = [
  { key: 'profile',     Icon: User,          label: 'Profile'     },
  { key: 'performance', Icon: BarChart2,      label: 'Performance & Records' },
  { key: 'analysis',    Icon: BarChart3,      label: 'Test analysis' },
];

const SUBJECT_COLORS = ['#1a4fa0', '#e86b1f', '#1a8a4a', '#7c3aed', '#f5a623'];

function getInitials(name = '') {
  return name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function StudentDashboard() {
  const { activePage, setActivePage } = useOutletContext();
  const { user: auth } = useAuth();

  const [data,      setData]      = useState(null);
  const [chart,     setChart]     = useState(null);  // { chartData, weakSubject }
  const [loading,   setLoading]   = useState(true);

  const rankingTestColumns = useMemo(
    () => (data?.testColumns || [])
      .filter((c) => !String(c).includes('_'))
      .sort((a, b) => String(b).localeCompare(String(a), undefined, { numeric: true, sensitivity: 'base' })),
    [data?.testColumns]
  );
  const [analysisTestKey, setAnalysisTestKey] = useState('');
  const [testInsights, setTestInsights] = useState(null);
  const [testInsightsLoading, setTestInsightsLoading] = useState(false);
  const [testInsightsError, setTestInsightsError] = useState('');

  useEffect(() => {
    if (!rankingTestColumns.length) return;
    setAnalysisTestKey((k) => k || rankingTestColumns[0]);
  }, [rankingTestColumns]);

  useEffect(() => {
    if (activePage !== 'analysis' || !analysisTestKey || !auth.id) return undefined;
    let cancelled = false;
    setTestInsightsLoading(true);
    setTestInsightsError('');
    fetchTestInsights(null, analysisTestKey, auth.id)
      .then((d) => {
        if (!cancelled) setTestInsights(d);
      })
      .catch((err) => {
        if (!cancelled) setTestInsightsError(err.message || 'Failed to load analysis');
      })
      .finally(() => {
        if (!cancelled) setTestInsightsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activePage, analysisTestKey, auth.id]);

  useEffect(() => {
    const load = async () => {
      try {
        const [studentData, chartResult] = await Promise.all([
          fetchStudentData(null, auth.id),
          fetchStudentChart(null, auth.id, auth.centerCode).catch(() => null),
        ]);
        setData(studentData);
        setChart(chartResult);
      } catch (e) {
        console.error('StudentDashboard:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [auth.id, auth.centerCode]);

  const profile      = data?.profiles?.[0];
  const studentTests = data?.tests?.[0]  || {};
  const testColumns  = data?.testColumns  || [];

  const stream    = profile?.stream || auth.stream || 'JEE';
  const streamCfg = getStreamConfig(stream);
  const schoolName = profile?.['10th SCHOOL NAME'] || profile?.['12th SCHOOL NAME'] || profile?.['10th SCHOOL'] || profile?.['12th SCHOOL'] || profile?.['SCHOOL NAME'] || profile?.SCHOOL || '';
  const photoUrl = profile?.['STUDENT PHOTO URL'] || '';
  const photoPrimary = resolveStudentPhotoUrl(photoUrl, 'primary');
  const photoFallback = resolveStudentPhotoUrl(photoUrl, 'fallback');

  // Prefer backend chart; fallback to local computation
  const chartData = useMemo(() => {
    const rawRows = chart?.chartData ?? buildStudentChartData(studentTests, testColumns);

    const toNum = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    return (rawRows || []).map((row) => {
      const normalized = { ...row };

      if (stream === 'NEET') {
        const physics = toNum(normalized.Physics);
        const chemistry = toNum(normalized.Chemistry);
        const biology = toNum(normalized.Biology);
        const botany = toNum(normalized.Botany);
        const zoology = toNum(normalized.Zoology);

        const mergedBiology = biology ?? ((botany ?? 0) + (zoology ?? 0) || null);
        normalized.Biology = mergedBiology;
        delete normalized.Botany;
        delete normalized.Zoology;

        const parts = [physics, chemistry, mergedBiology].filter((v) => v !== null);
        const computedTotal = parts.length > 0 ? parts.reduce((s, v) => s + v, 0) : null;
        
        // Handle Absent explicitly
        const isAbsent = ['a', 'A', 'absent', 'Absent'].includes(String(row.Total).trim()) ||
          (['a', 'A', 'absent', 'Absent'].includes(String(row.Physics).trim()) &&
           ['a', 'A', 'absent', 'Absent'].includes(String(row.Chemistry).trim()) &&
           (['a', 'A', 'absent', 'Absent'].includes(String(row.Biology).trim()) || ['a', 'A', 'absent', 'Absent'].includes(String(row.Botany).trim())));
        
        if (isAbsent) {
          normalized.Total = 'Absent';
        } else {
          normalized.Total = computedTotal !== null ? computedTotal : (row.Total ?? null);
        }
      } else {
        const physics = toNum(normalized.Physics);
        const chemistry = toNum(normalized.Chemistry);
        const math = toNum(normalized.Math);
        const parts = [physics, chemistry, math].filter((v) => v !== null);
        const computedTotal = parts.length > 0 ? parts.reduce((s, v) => s + v, 0) : null;
        
        // Handle Absent explicitly
        const isAbsent = ['a', 'A', 'absent', 'Absent'].includes(String(row.Total).trim()) ||
          (['a', 'A', 'absent', 'Absent'].includes(String(row.Physics).trim()) &&
           ['a', 'A', 'absent', 'Absent'].includes(String(row.Chemistry).trim()) &&
           ['a', 'A', 'absent', 'Absent'].includes(String(row.Math).trim()));
        
        if (isAbsent) {
          normalized.Total = 'Absent';
        } else {
          normalized.Total = computedTotal !== null ? computedTotal : (row.Total ?? null);
        }
      }

      return normalized;
    });
  }, [chart, studentTests, testColumns, stream]);

  // Detected from test performance only — never profile manual fields
  const weakSubject = useMemo(
    () => chart?.weakSubject ?? computeWeakSubject(studentTests, testColumns),
    [chart, studentTests, testColumns]
  );

  const subjects = useMemo(
    () => streamCfg.subjects.filter((sub) => chartData.some((row) => row[sub] != null)),
    [chartData, streamCfg.subjects]
  );

  const latestTotal = useMemo(() => {
    if (!chartData.length) return null;
    return chartData[chartData.length - 1]?.Total ?? null;
  }, [chartData]);

  const examResult = getExamResult(profile);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '60vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, color: 'var(--gray-400)' }}>
        <Loader2 size={36} className="spin" />
        <p style={{ fontWeight: 600 }}>Loading your profile…</p>
      </div>
    );
  }

  if (!data || !profile) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--gray-400)', fontSize: 15 }}>
        No profile found for this roll number.
      </div>
    );
  }

  const subjectColor = (sub) => {
    const map = { Physics: '#1a4fa0', Chemistry: '#e86b1f', Math: '#1a8a4a', Biology: '#7c3aed', Botany: '#059669', Zoology: '#0891b2' };
    return map[sub] || '#374151';
  };

  const ProfileTab = () => (
    <div className="grid-2">
      <div className="card">
        <div className="section-title">Personal Information</div>
        {[
          ['Name',     profile["STUDENT'S NAME"]],
          ['Roll',     profile.ROLL_KEY],
          ['Stream',   stream],
          ['Gender',   profile.GENDER],
          ['Category', profile.CATEGORY],
          ['DOB',      profile['DATE OF BIRTH']],
          ['Mobile',   profile['Mobile No.']],
          ['Parent',   profile["FATHER'S NAME"]],
          ['School',   schoolName],
        ].map(([label, value]) => (
          <div className="info-row" key={label}>
            <span className="info-label">{label}</span>
            <span className="info-val">{value || '—'}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={14} color="var(--red)" aria-hidden="true" />
          Weak subject (from your tests)
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--red)', marginBottom: 14 }}>{weakSubject}</div>
        {streamCfg.subjects.map((sub) => {
          const avg = chartData.length
            ? Math.round(chartData.reduce((acc, m) => acc + (Number(m[sub]) || 0), 0) / chartData.length)
            : 0;
          const isWeak    = sub === weakSubject;
          const fillColor = isWeak ? '#e74c3c' : subjectColor(sub);
          const maxMark   = getMaxMarksForSubject(streamCfg, sub);
          return (
            <div key={sub} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                <span style={{ fontWeight: isWeak ? 700 : 400, color: isWeak ? 'var(--red)' : 'inherit' }}>
                  {sub}
                  {isWeak && <AlertTriangle size={12} style={{ marginLeft: 5 }} aria-hidden="true" />}
                </span>
                <span style={{ fontWeight: 600 }}>{avg}/{maxMark}</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${Math.min(100, Math.round((avg / maxMark) * 100))}%`, background: fillColor }}
                />
              </div>
            </div>
          );
        })}

        {examResult && (
          <div style={{ marginTop: 16, padding: '10px 14px', background: stream === 'JEE' ? '#e8f0fc' : '#e6f5ed', borderRadius: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 1 }}>
              {stream === 'JEE' ? 'JEE Main Percentile' : 'NEET Score'}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: stream === 'JEE' ? '#1a4fa0' : '#1a6e3b', marginTop: 2 }}>
              {examResult}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const PerformanceTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card">
        <div className="section-title">Subject-wise Trend</div>
        {chartData.length > 0 ? (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {subjects.map((sub, i) => {
                const latest = chartData[chartData.length - 1]?.[sub];
                const maxSub = getMaxMarksForSubject(streamCfg, sub);
                return (
                  <span
                    key={sub}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: '#f8fafc',
                      border: '1px solid var(--gray-100)',
                      borderRadius: 999,
                      padding: '4px 10px',
                      fontSize: 12,
                      color: 'var(--gray-700)',
                      fontWeight: 600,
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: SUBJECT_COLORS[i % SUBJECT_COLORS.length] }} />
                    {sub}: {latest ?? '—'}/{maxSub}
                  </span>
                );
              })}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: '#fdf4ff',
                  border: '1px solid #f5d0fe',
                  borderRadius: 999,
                  padding: '4px 10px',
                  fontSize: 12,
                  color: '#a21caf',
                  fontWeight: 700,
                }}
              >
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#a21caf' }} />
                Total: {chartData[chartData.length - 1]?.Total ?? '—'}/{streamCfg.maxTotal}
              </span>
            </div>

            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={chartData} margin={{ top: 10, right: 18, left: 45, bottom: 75 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--gray-600)' }} interval={0} angle={-35} textAnchor="end" />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === 'Total') return [value ?? '—', `Total / ${streamCfg.maxTotal}`];
                    return [value ?? '—', `${name} / ${getMaxMarksForSubject(streamCfg, name)}`];
                  }}
                  contentStyle={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                {subjects.map((sub, i) => (
                  <Line
                    key={sub}
                    type="monotone"
                    dataKey={sub}
                    stroke={SUBJECT_COLORS[i % SUBJECT_COLORS.length]}
                    strokeWidth={2.3}
                    dot={{ r: 3.5, strokeWidth: 1, fill: '#fff' }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey="Total"
                  stroke="#a21caf"
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                  activeDot={{ r: 6 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </>
        ) : (
          <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: 32 }}>No test data available yet.</p>
        )}
      </div>
      <MarksTab />
    </div>
  );

  const MarksTab = () => (
    <div className="card">
      <div className="section-title">Test Records</div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Test</th>
              {streamCfg.subjects.map((s) => <th key={s}>{s}</th>)}
              <th>Total</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((row) => {
              const subScores = streamCfg.subjects.map((s) => {
                const val = row[s];
                return val !== null && val !== undefined ? val : '—';
              });
              const total  = row.Total;
              const maxTot = streamCfg.maxTotal;
              const pct    = total != null && !Number.isNaN(Number(total))
                ? Math.round((Number(total) / maxTot) * 100)
                : 0;
              return (
                <tr key={row.name}>
                  <td><strong>{row.name}</strong></td>
                  {subScores.map((v, i) => (
                    <td key={i} style={{ color: v === '—' ? 'var(--gray-300)' : 'inherit' }}>
                      {v !== '—' && v !== 'A' && v !== 'a' && v !== 'Absent' ? `${v}/${getMaxMarksForSubject(streamCfg, streamCfg.subjects[i])}` : v === '—' ? '—' : 'Absent'}
                    </td>
                  ))}
                  <td>
                    <strong style={{ color: total === 'Absent' ? 'var(--red)' : '#1a4fa0' }}>
                      {total === 'Absent' ? 'Absent' : `${total ?? '—'}/${maxTot}`}
                    </strong>
                  </td>
                  <td><span className={`chip ${total === 'Absent' ? 'chip-weak' : pct >= 60 ? 'chip-good' : 'chip-weak'}`}>{total === 'Absent' ? '—' : `${pct}%`}</span></td>
                </tr>
              );
            })}
            {!chartData.length && (
              <tr><td colSpan={streamCfg.subjects.length + 3} style={{ textAlign: 'center', padding: 24, color: 'var(--gray-400)' }}>No marks recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const AnalysisTab = () => (
    <TestInsightsPanel
      insights={testInsights}
      loading={testInsightsLoading}
      error={testInsightsError}
      highlightCenter={profile.centerCode}
      testKey={analysisTestKey}
      testOptions={rankingTestColumns}
      onTestKeyChange={setAnalysisTestKey}
      showStudentCard
      hideSubjectAverages
    />
  );

  return (
    <div className="fade-in dashboard-page">
      <div className="page-header">
        {photoUrl ? (
          <img
            src={photoPrimary}
            alt={profile["STUDENT'S NAME"]}
            referrerPolicy="no-referrer"
            onError={(e) => {
              if (e.currentTarget.dataset.fallbackApplied === '1') {
                e.currentTarget.style.display = 'none';
                return;
              }
              e.currentTarget.dataset.fallbackApplied = '1';
              e.currentTarget.src = photoFallback || photoUrl;
            }}
            style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,.35)', flexShrink: 0 }}
          />
        ) : (
          <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {getInitials(profile["STUDENT'S NAME"])}
          </div>
        )}
        <div>
          <h1>{profile["STUDENT'S NAME"]}</h1>
          <p>
            Roll: {profile.ROLL_KEY} · {profile.centerCode || ''}
            <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 7px', borderRadius: 4, background: 'rgba(255,255,255,.2)', fontWeight: 600 }}>
              {stream}
            </span>
          </p>
        </div>
        <div className="page-header-toolbar" style={{ marginLeft: 'auto', background: 'rgba(255,255,255,.12)', padding: '8px 16px', borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{latestTotal ?? '—'}</div>
          <div style={{ fontSize: 11, opacity: 0.8 }}>Latest / {streamCfg.maxTotal}</div>
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
          {activePage === 'profile'     && <ProfileTab />}
          {activePage === 'performance' && <PerformanceTab />}
          {activePage === 'analysis'    && <AnalysisTab />}
        </div>
      </div>
    </div>
  );
}
