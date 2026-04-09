import { useMemo, useState } from 'react';
import { Loader2, Trophy, BarChart3, TrendingDown, Users, AlertCircle } from 'lucide-react';
import { CENTERS } from '../config/centers';

function centreLabel(code) {
  return CENTERS[code]?.name || code || '—';
}

/**
 * CAT-style analysis from backend (marks-based; see payload.note).
 */
export default function TestInsightsPanel({
  insights,
  loading,
  error,
  highlightCenter,
  testKey,
  testOptions,
  onTestKeyChange,
  showStudentCard,
  hideSubjectAverages = false,
}) {
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 48, color: 'var(--gray-400)' }}>
        <Loader2 size={22} className="spin" />
        <span style={{ fontWeight: 600 }}>Loading test analysis…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ borderColor: 'var(--red)', background: 'var(--red-bg)', color: 'var(--red)' }}>
        <AlertCircle size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />
        {error}
      </div>
    );
  }

  if (!insights || !insights.testKey) {
    return (
      <div className="card" style={{ color: 'var(--gray-400)', textAlign: 'center', padding: 32 }}>
        Select a test with subject-wise columns to view analysis.
      </div>
    );
  }

  const subjects = insights.subjects || [];
  const cut = insights.cutoffs;
  const rankedStudents = insights.rankedStudents || [];

  const [rankMode, setRankMode] = useState('all');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedCenter, setSelectedCenter] = useState('ALL');

  const centerOptions = useMemo(
    () => [...new Set(rankedStudents.map((r) => r.center).filter(Boolean))].sort(),
    [rankedStudents]
  );

  const filteredRanked = useMemo(() => {
    const centerFiltered = selectedCenter === 'ALL'
      ? rankedStudents
      : rankedStudents.filter((r) => r.center === selectedCenter);

    const highToLow = [...centerFiltered].sort((a, b) => (b.marks - a.marks) || a.rank - b.rank);
    const lowToHigh = [...centerFiltered].sort((a, b) => (a.marks - b.marks) || a.rank - b.rank);

    let selected = highToLow;
    if (rankMode === 'top10') selected = highToLow.slice(0, 10);
    if (rankMode === 'bottom10') selected = lowToHigh.slice(0, 10);

    return sortOrder === 'asc'
      ? [...selected].sort((a, b) => (a.marks - b.marks) || a.rank - b.rank)
      : [...selected].sort((a, b) => (b.marks - a.marks) || a.rank - b.rank);
  }, [rankedStudents, selectedCenter, sortOrder, rankMode]);

  const rowHighlight = (code) =>
    highlightCenter && code === highlightCenter
      ? { background: 'rgba(26, 79, 160, .08)', outline: '1px solid rgba(26, 79, 160, .25)' }
      : {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {testOptions?.length > 0 && typeof onTestKeyChange === 'function' && (
        <div className="card" style={{ padding: '12px 16px' }}>
          <label className="label" htmlFor="insight-test-select" style={{ marginBottom: 6 }}>
            Test
          </label>
          <select
            id="insight-test-select"
            className="input select"
            value={testKey || ''}
            onChange={(e) => onTestKeyChange(e.target.value)}
            style={{ maxWidth: 360 }}
          >
            {testOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      )}

      <div
        className="card"
        style={{
          background: 'var(--yellow-bg)',
          border: '1px solid #fde68a',
          fontSize: 13,
          color: '#92400e',
          lineHeight: 1.6,
        }}
      >
        <strong>How this compares to your memo</strong>
        <p style={{ marginTop: 8, marginBottom: 0 }}>
          {insights.note}
        </p>
        {cut?.JEE && cut?.NEET && (
          <p style={{ marginTop: 8, marginBottom: 0 }}>
            Default qualification — <strong>JEE</strong>: total ≥ {cut.JEE.overallMin} / {cut.JEE.maxTotal} (
            {Math.round(cut.overallQualifyRatio * 100)}%); per subject vs max (Physics {cut.JEE.maxBySubject.Physics}, Chemistry{' '}
            {cut.JEE.maxBySubject.Chemistry}, Math {cut.JEE.maxBySubject.Math}) with floor from {Math.round(cut.subjectQualifyRatio * 100)}% of each.
            <br />
            <strong>NEET</strong>: total ≥ {cut.NEET.overallMin} / {cut.NEET.maxTotal}; Biology max {cut.NEET.maxBySubject.Biology}, others{' '}
            {cut.NEET.maxBySubject.Physics} / {cut.NEET.maxBySubject.Chemistry}.
          </p>
        )}
      </div>

      {showStudentCard && insights.studentInsight && (
        <div className="card" style={{ border: '2px solid var(--csrl-blue)', background: 'var(--csrl-blue-light)' }}>
          <div className="section-title" style={{ marginBottom: 10 }}>
            <Users size={16} aria-hidden="true" />
            Your result — {insights.testKey}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, fontSize: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--gray-600)' }}>Rank (by total)</div>
              <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--csrl-blue)' }}>
                {insights.studentInsight.rank != null
                  ? `#${insights.studentInsight.rank} / ${insights.studentInsight.totalStudentsRanked || '—'}`
                  : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--gray-600)' }}>Total marks</div>
              <div style={{ fontWeight: 700 }}>{insights.studentInsight.total ?? '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--gray-600)' }}>Qualified</div>
              <div style={{ fontWeight: 700, color: insights.studentInsight.qualified ? 'var(--green)' : 'var(--red)' }}>
                {insights.studentInsight.appeared ? (insights.studentInsight.qualified ? 'Yes' : 'No') : 'No attempt'}
              </div>
            </div>
          </div>
          {subjects.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {subjects.map((sub) => (
                <span key={sub} className="badge" style={{ background: '#fff', color: 'var(--gray-800)' }}>
                  {sub}: {insights.studentInsight.subjectScores?.[sub] ?? '—'}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="section-title" style={{ marginBottom: 12 }}>
          <Trophy size={16} color="#d97706" aria-hidden="true" />
          Top student (total and score %)
        </div>
        {(insights.overallTopper || insights.bestScorePercentStudent) ? (
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--gray-800)' }}>
              {insights.overallTopper?.name || insights.bestScorePercentStudent?.name}
            </div>
            <div style={{ fontSize: 13, color: 'var(--gray-600)', marginTop: 4 }}>
              {(insights.overallTopper?.roll || insights.bestScorePercentStudent?.roll)} · {centreLabel(insights.overallTopper?.center || insights.bestScorePercentStudent?.center)}
            </div>
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#1a4fa0' }}>
                {insights.overallTopper?.total ?? insights.bestScorePercentStudent?.total ?? '—'}
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-400)', marginLeft: 6 }}>marks</span>
              </div>
              {insights.bestScorePercentStudent && (
                <div style={{ fontSize: 22, fontWeight: 800, color: '#1a6e3b' }}>
                  {insights.bestScorePercentStudent.scorePercent}%
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-400)', marginLeft: 6 }}>
                    ({insights.bestScorePercentStudent.total} / {insights.bestScorePercentStudent.maxTotal ?? '—'})
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ color: 'var(--gray-400)' }}>No scores for this test.</div>
        )}
      </div>

      {!hideSubjectAverages && (
        <div className="card">
        <div className="section-title">
          <BarChart3 size={16} aria-hidden="true" />
          Subject averages (global) — lowest score % first
        </div>
        {insights.weakestSubjectByScorePercent && (
          <p style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 12 }}>
            Weakest by avg marks vs max: <strong style={{ color: 'var(--red)' }}>{insights.weakestSubjectByScorePercent}</strong>
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(insights.globalSubjectStats || []).map((s) => (
            <div key={s.subject}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>{s.subject}</span>
                <span>
                  Avg {s.avgMarks} · {s.scorePercentOfMax}% of max
                </span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${Math.min(100, s.scorePercentOfMax)}%`, background: '#1a4fa0' }}
                />
              </div>
            </div>
          ))}
        </div>
        </div>
      )}

      <div className="card">
        <div className="section-title">Student ranking explorer — {insights.testKey}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <select
            className="input select"
            value={rankMode}
            onChange={(e) => setRankMode(e.target.value)}
            style={{ maxWidth: 200 }}
          >
            <option value="all">All students</option>
            <option value="top10">Top 10 students</option>
            <option value="bottom10">Lowest 10 students</option>
          </select>
          <select
            className="input select"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            style={{ maxWidth: 200 }}
          >
            <option value="desc">Sort: Highest first</option>
            <option value="asc">Sort: Lowest first</option>
          </select>
          <select
            className="input select"
            value={selectedCenter}
            onChange={(e) => setSelectedCenter(e.target.value)}
            style={{ maxWidth: 220 }}
          >
            <option value="ALL">All centres</option>
            {centerOptions.map((c) => (
              <option key={c} value={c}>{centreLabel(c)}</option>
            ))}
          </select>
        </div>
        <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Student</th>
                <th>Centre</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredRanked.map((r) => (
                <tr key={r.roll}>
                  <td><strong>{r.rank}</strong></td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{r.roll}</div>
                  </td>
                  <td>{r.center}</td>
                  <td><strong style={{ color: '#1a4fa0' }}>{r.marks}</strong></td>
                </tr>
              ))}
              {!filteredRanked.length && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 20 }}>
                    No data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!showStudentCard && (
        <>
          <div className="card">
            <div className="section-title">Centre rank — average total & qualification</div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Centre</th>
                    <th>Appeared</th>
                    <th>Qualified</th>
                    <th>Qual %</th>
                    {subjects.map((sub) => (
                      <th key={sub}>Avg {sub}</th>
                    ))}
                    <th>Avg total</th>
                  </tr>
                </thead>
                <tbody>
                  {(insights.centreRows || []).map((row) => (
                    <tr key={row.code} style={rowHighlight(row.code)}>
                      <td>{row.rank}</td>
                      <td>
                        <strong>{row.code}</strong>
                        <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{centreLabel(row.code)}</div>
                      </td>
                      <td>{row.appeared}</td>
                      <td>{row.qualified}</td>
                      <td>{row.qualRate}%</td>
                      {subjects.map((sub) => (
                        <td key={sub}>{row.subjectAvgs?.[sub] ?? '—'}</td>
                      ))}
                      <td><strong>{row.totalAvg}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="section-title">
              <TrendingDown size={16} color="var(--red)" aria-hidden="true" />
              Bottom 5 centres — by avg total
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Centre</th>
                    <th>Avg total</th>
                    <th>Qual %</th>
                  </tr>
                </thead>
                <tbody>
                  {(insights.bottom5Centres || []).map((row) => (
                    <tr key={row.code} style={rowHighlight(row.code)}>
                      <td>
                        <strong>{row.code}</strong> — {centreLabel(row.code)}
                      </td>
                      <td>{row.totalAvg}</td>
                      <td>{row.qualRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid-2">
            <div className="card">
              <div className="section-title" style={{ fontSize: 14 }}>Not qualified (overall) — count by centre</div>
              <p style={{ fontSize: 12, color: 'var(--gray-600)', marginBottom: 10 }}>Students who attempted but did not meet qualification rules.</p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8 }}>
                {Object.entries(insights.notQualifiedOverall || {})
                  .filter(([, n]) => n > 0)
                  .sort((a, b) => b[1] - a[1])
                  .map(([code, n]) => (
                    <li key={code}>
                      {code}: {n}
                    </li>
                  ))}
                {!Object.values(insights.notQualifiedOverall || {}).some((n) => n > 0) && (
                  <li style={{ color: 'var(--gray-400)' }}>None</li>
                )}
              </ul>
            </div>

            <div className="card">
              <div className="section-title" style={{ fontSize: 14 }}>Low qualification rate (≤ 50%)</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8 }}>
                {(insights.qualificationRateByCentre || [])
                  .filter((r) => r.qualRate <= 50)
                  .map((r) => (
                    <li key={r.code}>
                      {r.code}: {r.qualRate}%
                    </li>
                  ))}
                {!(insights.qualificationRateByCentre || []).some((r) => r.qualRate <= 50) && (
                  <li style={{ color: 'var(--gray-400)' }}>No centre at or below 50%</li>
                )}
              </ul>
            </div>
          </div>

          <div className="card">
            <div className="section-title">Below subject cutoff — count by centre</div>
            <p style={{ fontSize: 12, color: 'var(--gray-600)', marginBottom: 12 }}>
              Students with a subject mark below their stream&apos;s cutoff ({Math.round((cut?.subjectQualifyRatio ?? 0.35) * 100)}% of that subject&apos;s max — JEE vs NEET differ).
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {subjects.map((sub) => (
                <div key={sub} style={{ background: 'var(--gray-50)', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--csrl-blue)' }}>{sub}</div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.7 }}>
                    {Object.entries((insights.notQualifiedBySubject || {})[sub] || {})
                      .filter(([, n]) => n > 0)
                      .sort((a, b) => b[1] - a[1])
                      .map(([code, n]) => (
                        <li key={code}>
                          {code}: {n}
                        </li>
                      ))}
                    {!Object.values((insights.notQualifiedBySubject || {})[sub] || {}).some((n) => n > 0) && (
                      <li style={{ color: 'var(--gray-400)' }}>None</li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
