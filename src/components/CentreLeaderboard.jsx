import { BarChart2 } from 'lucide-react';
import { CENTERS } from '../config/centers';

function centreLabel(code) {
  return CENTERS[code]?.name || code;
}

const RANK_STYLES = [
  { bg: '#fef9c3', color: '#d97706', border: '#d97706' }, // 1st — gold
  { bg: '#f3f4f6', color: '#6b7280', border: '#9ca3af' }, // 2nd — silver
  { bg: '#fff7ed', color: '#c2410c', border: '#c2410c' }, // 3rd — bronze
];

function getRankStyle(index) {
  return RANK_STYLES[index] ?? { bg: '#e8f0fc', color: '#1a4fa0', border: 'var(--csrl-blue)' };
}

function RankBadge({ index }) {
  const { bg, color } = getRankStyle(index);
  return (
    <div className="rank-badge" style={{ background: bg, color }} aria-label={`Rank ${index + 1}`}>
      {index + 1}
    </div>
  );
}

const Empty = ({ message }) => (
  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--gray-400)' }}>
    <BarChart2 size={36} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
    <div style={{ fontWeight: 600 }}>{message}</div>
  </div>
);

const pct = (a, x) => (x > 0 ? Math.round((a / x) * 100) : 0);

/**
 * CentreLeaderboard
 *
 * Props:
 *   centreStats  — array from backend /api/analytics/centre-leaderboard
 *                  [{ rank, code, avg, top, tested, studentCount, weakSubject }]
 *   selTest      — selected test key (for display only)
 */
export default function CentreLeaderboard({ centreStats = [], selTest }) {
  if (!selTest) return <Empty message="Select a test to view rankings" />;
  if (!centreStats.length) return <Empty message={`No test data for ${selTest}`} />;

  const maxAvg = centreStats[0]?.avg || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {centreStats.map((centre, index) => {
        const { color, border } = getRankStyle(index);
        return (
          <div key={centre.code} className="centre-rank-card" style={{ borderLeftColor: border }}>
            <RankBadge index={index} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{centreLabel(centre.code)}</span>
                <span style={{ fontSize: 12, background: 'var(--csrl-blue-light)', color: 'var(--csrl-blue)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                  {centre.code}
                </span>
                <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                  {centre.tested}/{centre.studentCount} tested
                </span>
                <span style={{ fontSize: 12, background: 'var(--red-bg)', color: 'var(--red)', padding: '2px 7px', borderRadius: 4, fontWeight: 600, marginLeft: 'auto' }}>
                  Weak: {centre.weakSubject}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div className="progress-bar" style={{ height: 10 }}>
                    <div className="progress-fill" style={{ width: `${pct(centre.avg, maxAvg)}%`, background: color }} />
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, minWidth: 90, textAlign: 'right', color: 'var(--gray-800)' }}>
                  Avg: <span style={{ fontSize: 16, color }}>{centre.avg}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--gray-400)', minWidth: 60, textAlign: 'right' }}>
                  Top: {centre.top}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
