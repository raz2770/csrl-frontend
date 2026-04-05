import React, { useState, useEffect } from 'react';

const FIELDS = [
  { key: "STUDENT'S NAME", label: 'Full Name', required: true },
  { key: 'ROLL_KEY', label: 'Roll Number / ID', required: true },
  { key: 'centerCode', label: 'Centre Code', required: true },
  { key: 'GENDER', label: 'Gender' },
  { key: 'DATE OF BIRTH', label: 'Date of Birth' },
  { key: 'CATEGORY', label: 'Category (GEN/OBC/SC/ST)' },
  { key: 'Mobile No.', label: 'Mobile Number' },
  { key: "FATHER'S NAME", label: "Father's Name" },
  { key: "MOTHER'S NAME", label: "Mother's Name" },
  { key: 'PARMANENT ADDRESS', label: 'Address' },
  { key: 'DISTRICT', label: 'District' },
  { key: 'STATE', label: 'State' },
  { key: 'PINCODE', label: 'Pincode' },
  { key: '10th SCHOOL NAME', label: '10th School Name' },
  { key: '10th BOARD', label: '10th Board' },
  { key: '10th Precentage', label: '10th Percentage' },
  { key: '12th SCHOOL NAME', label: '12th School Name' },
  { key: '12th BOARD', label: '12th Board' },
  { key: '12th Precentage', label: '12th Percentage' },
  { key: 'FUTURE COLLEGE (TARGET)', label: 'Target College / Branch' },
  { key: 'WEAK SUBJECT (MANUAL)', label: 'Weak Subject (Manual)' },
  { key: 'STUDENT PHOTO URL', label: 'Photo URL (Google Drive)' },
];

export default function StudentFormModal({ mode, student, onClose, onSubmit, loading }) {
  const [form, setForm] = useState({});

  useEffect(() => {
    if (mode === 'edit' && student) {
      setForm({ ...student });
    } else {
      setForm({});
    }
  }, [mode, student]);

  const handleChange = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '24px', overflowY: 'auto'
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 700, margin: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--csrl-blue)' }}>
            {mode === 'add' ? '➕ Add New Student' : '✏️ Edit Student Profile'}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--gray-400)' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid-2" style={{ gap: 12 }}>
            {FIELDS.map(f => (
              <div key={f.key}>
                <label className="lbl">{f.label}{f.required && <span style={{ color: 'var(--red)' }}> *</span>}</label>
                <input
                  className="inp"
                  type="text"
                  required={f.required}
                  value={form[f.key] || ''}
                  disabled={mode === 'edit' && f.key === 'ROLL_KEY'}
                  onChange={e => handleChange(f.key, e.target.value)}
                  placeholder={f.label}
                />
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--gray-100)' }}>
            <button type="button" onClick={onClose} className="btn btn-outline">Cancel</button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? '⏳ Saving...' : mode === 'add' ? '✅ Add Student' : '💾 Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
