import React, { useState, useMemo } from 'react';
import { parseTestColumn, getStreamConfig } from '../services/dataService';

/**
 * TestDataModal — enter / edit test scores for a student.
 *
 * Groups inputs by TEST NAME (rows) × SUBJECT (columns).
 * Supports both JEE (Physics / Chemistry / Math) and NEET (Physics / Chemistry / Biology).
 * Derives the subject list from existing testColumns OR from the student's stream.
 */
export default function TestDataModal({ student, testColumns, existingScores, onClose, onSubmit, loading }) {
  const stream = student?.stream || 'JEE';
  const streamCfg = getStreamConfig(stream);

  // ── Group columns by test name ─────────────────────────────────────────────
  const grouped = useMemo(() => {
    const map = {};  // testName → { total: colKey | null, subjects: { subject: colKey } }

    (testColumns || []).forEach((col) => {
      const { testName, subject, isTotal } = parseTestColumn(col);
      if (!map[testName]) map[testName] = { testName, totalCol: null, subjectCols: {} };
      if (isTotal) {
        map[testName].totalCol = col;
      } else {
        map[testName].subjectCols[subject] = col;
      }
    });

    // Sort test names naturally (CAT-1, CAT-2, CMT-1, ...)
    return Object.values(map).sort((a, b) =>
      a.testName.localeCompare(b.testName, undefined, { numeric: true })
    );
  }, [testColumns]);

  // Collect all subjects that appear across all tests (+ stream defaults)
  const allSubjects = useMemo(() => {
    const seen = new Set(streamCfg.subjects);
    grouped.forEach(({ subjectCols }) => Object.keys(subjectCols).forEach((s) => seen.add(s)));
    return Array.from(seen);
  }, [grouped, streamCfg]);

  // ── Score state ────────────────────────────────────────────────────────────
  const [scores, setScores] = useState(() => {
    const init = {};
    (testColumns || []).forEach((col) => {
      init[col] = existingScores?.[col] ?? '';
    });
    return init;
  });

  const set = (col, value) => setScores((s) => ({ ...s, [col]: value }));

  // Auto-compute total when subject scores change
  const getAutoTotal = (testGroup) => {
    const vals = Object.values(testGroup.subjectCols)
      .map((col) => parseFloat(scores[col]))
      .filter((n) => !isNaN(n));
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : '';
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Auto-fill total columns if not manually set
    const final = { ...scores };
    grouped.forEach((g) => {
      if (g.totalCol && (final[g.totalCol] === '' || final[g.totalCol] === undefined)) {
        const auto = getAutoTotal(g);
        if (auto !== '') final[g.totalCol] = auto;
      }
    });
    // Strip empty values
    const filtered = {};
    Object.entries(final).forEach(([k, v]) => { if (v !== '' && v !== undefined) filtered[k] = v; });
    onSubmit(filtered);
  };

  const subjectColor = (sub) => {
    const map = { Physics: '#1a4fa0', Chemistry: '#e86b1f', Math: '#1a8a4a', Biology: '#7c3aed', Botany: '#059669', Zoology: '#0891b2' };
    return map[sub] || '#374151';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 820 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">📝 Manage Test Scores</div>
            <div style={{ fontSize: 13, color: 'var(--gray-600)', marginTop: 2 }}>
              {student?.["STUDENT'S NAME"]} · {student?.ROLL_KEY}
              <span style={{
                marginLeft: 8, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                background: stream === 'JEE' ? '#e8f0fc' : '#e6f5ed',
                color: stream === 'JEE' ? '#1a4fa0' : '#1a6e3b',
              }}>
                {stream}
              </span>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ overflowX: 'auto' }}>
            {grouped.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--gray-400)' }}>
                No test columns configured. Add test data via Google Sheets first.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--gray-50)' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--gray-600)', borderBottom: '2px solid var(--gray-200)', minWidth: 130 }}>
                      Test
                    </th>
                    {allSubjects.map((sub) => (
                      <th key={sub} style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: subjectColor(sub), borderBottom: '2px solid var(--gray-200)', minWidth: 90 }}>
                        {sub}
                      </th>
                    ))}
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: 'var(--csrl-blue)', borderBottom: '2px solid var(--gray-200)', minWidth: 80 }}>
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {grouped.map((g) => {
                    const autoTotal = getAutoTotal(g);
                    return (
                      <tr key={g.testName} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--csrl-orange)' }}>
                          {g.testName}
                        </td>
                        {allSubjects.map((sub) => {
                          const col = g.subjectCols[sub];
                          return (
                            <td key={sub} style={{ padding: '6px 8px', textAlign: 'center' }}>
                              {col ? (
                                <input
                                  className="input"
                                  type="text"
                                  placeholder="—"
                                  value={scores[col] ?? ''}
                                  onChange={(e) => set(col, e.target.value)}
                                  style={{ width: 80, textAlign: 'center', fontSize: 13 }}
                                />
                              ) : (
                                <span style={{ color: 'var(--gray-300)', fontSize: 18 }}>—</span>
                              )}
                            </td>
                          );
                        })}
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                          {g.totalCol ? (
                            <input
                              className="input"
                              type="text"
                              placeholder={autoTotal !== '' ? String(autoTotal) : '—'}
                              value={scores[g.totalCol] ?? ''}
                              onChange={(e) => set(g.totalCol, e.target.value)}
                              style={{ width: 80, textAlign: 'center', fontWeight: 700, color: 'var(--csrl-blue)', fontSize: 13 }}
                            />
                          ) : (
                            <span style={{ fontWeight: 700, color: 'var(--gray-400)', fontSize: 14 }}>
                              {autoTotal !== '' ? autoTotal : '—'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--gray-400)' }}>
              Enter a score or "Absent". Totals are auto-calculated from subject scores if not manually entered.
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-outline">Cancel</button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? '⏳ Saving...' : '💾 Save Test Scores'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
