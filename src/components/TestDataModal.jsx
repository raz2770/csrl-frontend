import React, { useState } from 'react';

export default function TestDataModal({ student, testColumns, existingScores, onClose, onSubmit, loading }) {
  const [scores, setScores] = useState(() => {
    const init = {};
    (testColumns || []).forEach(col => {
      init[col] = existingScores?.[col] || '';
    });
    return init;
  });

  // Group columns by subject
  const grouped = {};
  (testColumns || []).forEach(col => {
    const parts = col.split(' ');
    const sub = parts.length > 1 ? parts[0] : 'Other';
    if (!grouped[sub]) grouped[sub] = [];
    grouped[sub].push(col);
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Filter out empty vals
    const filtered = {};
    Object.entries(scores).forEach(([k, v]) => { if (v !== '') filtered[k] = v; });
    onSubmit(filtered);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">📝 Manage Test Scores</div>
            <div style={{ fontSize: 13, color: 'var(--gray-600)', marginTop: 2, marginLeft: 2 }}>
              {student?.["STUDENT'S NAME"]} · {student?.ROLL_KEY}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
          {Object.entries(grouped).map(([subject, cols]) => (
            <div key={subject} style={{ marginBottom: 18 }}>
              <div style={{
                fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
                color: 'var(--csrl-blue)', marginBottom: 8, paddingBottom: 4,
                borderBottom: '2px solid var(--csrl-blue-light)'
              }}>
                {subject}
              </div>
              <div className="grid-3" style={{ gap: 10 }}>
                {cols.map(col => {
                  const testName = col.split(' ').slice(1).join(' ') || col;
                  return (
                    <div key={col}>
                      <label className="label" style={{ fontSize: 11 }}>{testName}</label>
                      <input
                        className="input"
                        type="text"
                        placeholder="Score or 'Absent'"
                        value={scores[col]}
                        onChange={e => setScores(s => ({ ...s, [col]: e.target.value }))}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
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
