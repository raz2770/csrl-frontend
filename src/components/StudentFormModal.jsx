import React, { useState, useEffect } from 'react';

const TEXT_FIELDS = [
  { key: "STUDENT'S NAME",          label: 'Full Name',              required: true },
  { key: 'ROLL_KEY',                label: 'Roll Number / ID',       required: true },
  { key: 'centerCode',              label: 'Centre Code',            required: true },
  { key: 'GENDER',                  label: 'Gender' },
  { key: 'DATE OF BIRTH',           label: 'Date of Birth' },
  { key: 'CATEGORY',                label: 'Category (GEN/OBC/SC/ST)' },
  { key: 'Mobile No.',              label: 'Mobile Number' },
  { key: "FATHER'S NAME",           label: "Father's Name" },
  { key: "MOTHER'S NAME",           label: "Mother's Name" },
  { key: 'PARMANENT ADDRESS',       label: 'Address' },
  { key: 'DISTRICT',                label: 'District' },
  { key: 'STATE',                   label: 'State' },
  { key: 'PINCODE',                 label: 'Pincode' },
  { key: '10th SCHOOL NAME',        label: '10th School Name' },
  { key: '10th BOARD',              label: '10th Board' },
  { key: '10th Precentage',         label: '10th Percentage' },
  { key: '12th SCHOOL NAME',        label: '12th School Name' },
  { key: '12th BOARD',              label: '12th Board' },
  { key: '12th Precentage',         label: '12th Percentage' },
  { key: 'FUTURE COLLEGE (TARGET)', label: 'Target College / Branch' },
  { key: 'WEAK SUBJECT (MANUAL)',   label: 'Weak Subject (Manual)' },
  { key: 'STUDENT PHOTO URL',       label: 'Photo URL (Google Drive)' },
];

export default function StudentFormModal({ mode, student, onClose, onSubmit, loading }) {
  const [form, setForm] = useState({});

  useEffect(() => {
    if (mode === 'edit' && student) {
      setForm({ stream: 'JEE', ...student });
    } else {
      setForm({ stream: 'JEE' });
    }
  }, [mode, student]);

  const handleChange = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            {mode === 'add' ? '➕ Add New Student' : '✏️ Edit Student Profile'}
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ maxHeight: '68vh', overflowY: 'auto' }}>
            <div className="form-grid">

              {/* Stream selector */}
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="label">
                  Stream<span style={{ color: 'var(--red)' }}> *</span>
                </label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {['JEE', 'NEET'].map((s) => (
                    <label
                      key={s}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                        padding: '8px 18px', borderRadius: 6,
                        background: form.stream === s ? (s === 'JEE' ? '#e8f0fc' : '#e6f5ed') : 'var(--gray-50)',
                        border: `2px solid ${form.stream === s ? (s === 'JEE' ? '#1a4fa0' : '#1a6e3b') : 'var(--gray-200)'}`,
                        fontWeight: form.stream === s ? 700 : 400,
                        color: form.stream === s ? (s === 'JEE' ? '#1a4fa0' : '#1a6e3b') : 'var(--gray-600)',
                        transition: 'all .15s',
                      }}
                    >
                      <input
                        type="radio"
                        name="stream"
                        value={s}
                        checked={form.stream === s}
                        onChange={() => handleChange('stream', s)}
                        style={{ accentColor: s === 'JEE' ? '#1a4fa0' : '#1a6e3b' }}
                      />
                      {s === 'JEE' ? '🔵 JEE (Physics · Chemistry · Math)' : '🟢 NEET (Physics · Chemistry · Biology)'}
                    </label>
                  ))}
                </div>
              </div>

              {/* Standard text fields */}
              {TEXT_FIELDS.map((f) => (
                <div key={f.key} className="form-group">
                  <label className="label">
                    {f.label}
                    {f.required && <span style={{ color: 'var(--red)' }}> *</span>}
                  </label>
                  <input
                    className="input"
                    type="text"
                    required={f.required}
                    value={form[f.key] || ''}
                    disabled={mode === 'edit' && f.key === 'ROLL_KEY'}
                    onChange={(e) => handleChange(f.key, e.target.value)}
                    placeholder={f.label}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="modal-footer">
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
