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
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '24px', overflowY: 'auto'
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 760, margin: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--csrl-blue)' }}>📝 Manage Test Scores</div>
            <div style={{ fontSize: 13, color: 'var(--gray-600)', marginTop: 2 }}>
              {student?.["STUDENT'S NAME"]} · {student?.ROLL_KEY}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--gray-400)' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
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
                      <label className="lbl" style={{ fontSize: 11 }}>{testName}</label>
                      <input
                        className="inp"
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

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--gray-100)' }}>
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
