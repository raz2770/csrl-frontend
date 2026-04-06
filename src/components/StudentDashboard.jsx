import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { User, BarChart2, ClipboardList, AlertTriangle, Loader2 } from 'lucide-react';
import { fetchStudentData, buildStudentChartData, computeWeakSubject } from '../services/dataService';
import { useAuth } from '../context/AuthContext';

const TABS = [
  { key: 'profile',     Icon: User,          label: 'Profile'     },
  { key: 'performance', Icon: BarChart2,     label: 'Performance' },
  { key: 'marks',       Icon: ClipboardList, label: 'Records'     },
];

const SUBJECT_COLORS = ['#1a4fa0', '#e86b1f', '#1a8a4a', '#f5a623', '#c0392b'];

function getInitials(name = '') {
  return name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function StudentDashboard() {
  const { activePage, setActivePage } = useOutletContext();
  const { user: auth } = useAuth();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudentData(null, auth.id)
      .then(setData)
      .catch((e) => console.error('StudentDashboard:', e))
      .finally(() => setLoading(false));
  }, [auth.id]);

  const profile     = data?.profiles?.[0];
  const studentTests = data?.tests?.[0] || {};
  const testColumns  = data?.testColumns || [];

  const chartData = useMemo(
    () => buildStudentChartData(studentTests, testColumns),
    [studentTests, testColumns]
  );

  const subjects = useMemo(
    () => [...new Set(chartData.flatMap((row) => Object.keys(row).filter((k) => k !== 'name' && k !== 'Total')))],
    [chartData]
  );

  const weakSubject = useMemo(
    () => computeWeakSubject(studentTests, testColumns),
    [studentTests, testColumns]
  );

  const latestTotal = useMemo(() => {
    if (!chartData.length) return null;
    return chartData[chartData.length - 1]?.Total ?? null;
  }, [chartData]);

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

  const ProfileTab = () => (
    <div className="grid-2">
      <div className="card">
        <div className="section-title">Personal Information</div>
        {[
          ['Name',     profile["STUDENT'S NAME"]],
          ['Roll',     profile.ROLL_KEY],
          ['Gender',   profile.GENDER],
          ['Category', profile.CATEGORY],
          ['DOB',      profile['DATE OF BIRTH']],
          ['Mobile',   profile['Mobile No.']],
          ['Parent',   profile["FATHER'S NAME"]],
          ['School',   profile['10th SCHOOL NAME']],
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
          Weak Subject Analysis
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--red)', marginBottom: 14 }}>{weakSubject}</div>
        {['Physics', 'Chemistry', 'Math'].map((sub) => {
          const avg = chartData.length
            ? Math.round(chartData.reduce((acc, m) => acc + (Number(m[sub]) || 0), 0) / chartData.length)
            : 0;
          const isWeak = sub === weakSubject;
          const fillColor = isWeak ? '#e74c3c' : sub === 'Physics' ? '#1a4fa0' : sub === 'Chemistry' ? '#e86b1f' : '#1a8a4a';
          return (
            <div key={sub} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                <span style={{ fontWeight: isWeak ? 700 : 400, color: isWeak ? 'var(--red)' : 'inherit' }}>
                  {sub}
                  {isWeak && <AlertTriangle size={12} style={{ marginLeft: 5 }} aria-hidden="true" />}
                </span>
                <span style={{ fontWeight: 600 }}>{avg}/60</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${Math.min(100, Math.round((avg / 60) * 100))}%`, background: fillColor }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const PerformanceTab = () => (
    <div className="card">
      <div className="section-title">Subject-wise Trend</div>
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--gray-600)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--gray-400)' }} />
            <Tooltip contentStyle={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 13 }} />
            {subjects.map((sub, i) => (
              <Line
                key={sub}
                type="monotone"
                dataKey={sub}
                stroke={SUBJECT_COLORS[i % SUBJECT_COLORS.length]}
                strokeWidth={2.5}
                dot={{ r: 4 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: 32 }}>No test data available yet.</p>
      )}
    </div>
  );

  const MarksTab = () => (
    <div className="card">
      <div className="section-title">Test Records</div>
      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Test</th><th>Physics</th><th>Chemistry</th><th>Math</th><th>Total</th><th>%</th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((row) => {
              const phy   = row.Physics   ?? row.PHY ?? '—';
              const che   = row.Chemistry ?? row.CHE ?? '—';
              const mat   = row.Math      ?? row.MAT ?? '—';
              const total = row.Total;
              const pct   = total != null && !Number.isNaN(Number(total))
                ? Math.round((Number(total) / 180) * 100)
                : 0;
              return (
                <tr key={row.name}>
                  <td><strong>{row.name}</strong></td>
                  <td>{phy}/60</td>
                  <td>{che}/60</td>
                  <td>{mat}/60</td>
                  <td><strong style={{ color: '#1a4fa0' }}>{total ?? '—'}/180</strong></td>
                  <td><span className={`chip ${pct >= 60 ? 'chip-good' : 'chip-weak'}`}>{pct}%</span></td>
                </tr>
              );
            })}
            {!chartData.length && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--gray-400)' }}>No marks recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
          {getInitials(profile["STUDENT'S NAME"])}
        </div>
        <div>
          <h1>{profile["STUDENT'S NAME"]}</h1>
          <p>Roll: {profile.ROLL_KEY} · {profile.centerCode || ''}</p>
        </div>
        <div style={{ marginLeft: 'auto', background: 'rgba(255,255,255,.12)', padding: '8px 16px', borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{latestTotal ?? '—'}</div>
          <div style={{ fontSize: 11, opacity: 0.8 }}>Latest</div>
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

        {activePage === 'profile'     && <ProfileTab />}
        {activePage === 'performance' && <PerformanceTab />}
        {activePage === 'marks'       && <MarksTab />}
      </div>
    </div>
  );
}
