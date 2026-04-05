import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getJeePercentile } from '../services/dataService';

function InfoRow({ label, value }) {
  return (
    <div className="info-row">
      <span className="info-label">{label}</span>
      <span className="info-val">{value || '—'}</span>
    </div>
  );
}

export default function StudentProfileView({ profile, studentTests, testColumns }) {
  const { mappedTestList, weakSubject, chartData } = useMemo(() => {
    const testsMap = {};
    const subjectTotals = {};
    const subjectCounts = {};

    (testColumns || []).forEach(col => {
      const parts = col.split(' ');
      const subject = parts.length > 1 ? parts[0] : 'Score';
      const testName = parts.length > 1 ? parts.slice(1).join(' ') : col;

      if (!testsMap[testName]) testsMap[testName] = { name: testName, marks: {}, total: 0 };

      const rawMark = (studentTests || {})[col];
      if (rawMark !== undefined && rawMark !== null && rawMark !== '' &&
          String(rawMark) !== '0' && String(rawMark).toLowerCase() !== 'absent') {
        const m = parseFloat(rawMark);
        if (!isNaN(m)) {
          testsMap[testName].marks[subject] = m;
          testsMap[testName].total += m;
          subjectTotals[subject] = (subjectTotals[subject] || 0) + m;
          subjectCounts[subject] = (subjectCounts[subject] || 0) + 1;
        }
      } else {
        testsMap[testName].marks[subject] = 'A';
      }
    });

    const mappedTestList = Object.values(testsMap);

    let weakSub = 'N/A', minAvg = Infinity;
    Object.keys(subjectTotals).forEach(sub => {
      const avg = subjectTotals[sub] / subjectCounts[sub];
      if (avg < minAvg && subjectCounts[sub] > 0) { minAvg = avg; weakSub = sub; }
    });

    const chartData = mappedTestList.map(t => ({ name: t.name, ...t.marks, Total: t.total }));
    return { mappedTestList, weakSubject: weakSub, chartData };
  }, [studentTests, testColumns]);

  if (!profile) return <div style={{ padding:'32px', textAlign:'center', color:'var(--gray-400)' }}>Loading profile...</div>;

  const photo = profile['STUDENT PHOTO URL'];
  const jeePercentile = getJeePercentile(profile);
  const catKey = (profile.CATEGORY || 'general').toLowerCase();

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
      {/* Banner */}
      <div className="card" style={{ display:'flex', alignItems:'center', gap:'20px', flexWrap:'wrap' }}>
        {photo
          ? <img src={photo} alt={profile["STUDENT'S NAME"]} referrerPolicy="no-referrer"
              style={{ width:96, height:96, borderRadius:12, objectFit:'cover', border:'2px solid var(--gray-100)', flexShrink:0 }} />
          : <div style={{ width:96, height:96, borderRadius:12, background:'var(--csrl-blue-light)', color:'var(--csrl-blue)',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:36, fontWeight:700, flexShrink:0 }}>
              {(profile["STUDENT'S NAME"]||'?')[0]}
            </div>
        }
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap', marginBottom:'6px' }}>
            <h2 style={{ fontSize:20, fontWeight:800, color:'var(--csrl-blue)' }}>{profile["STUDENT'S NAME"] || 'Unknown'}</h2>
            <span className={`badge badge-${catKey}`}>{profile.CATEGORY || 'General'}</span>
          </div>
          <div style={{ fontSize:13, color:'var(--gray-600)', display:'flex', gap:'16px', flexWrap:'wrap' }}>
            <span>📋 <strong>{profile['ROLL NO.'] || profile.ROLL_KEY}</strong></span>
            <span>📍 {profile.centerCode || '—'}</span>
            <span>📱 {profile['Mobile No.'] || '—'}</span>
          </div>
        </div>
        {jeePercentile && (
          <div style={{ textAlign:'center', background:'var(--green-bg)', borderRadius:10, padding:'16px 24px', flexShrink:0 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--green)', textTransform:'uppercase', letterSpacing:1 }}>JEE Percentile</div>
            <div style={{ fontSize:28, fontWeight:900, color:'var(--green)', marginTop:4 }}>{jeePercentile}</div>
          </div>
        )}
      </div>

      {/* Info Grid */}
      <div className="grid-2">
        <div className="card">
          <div className="section-title">👨‍👩‍👧 Personal & Family</div>
          <InfoRow label="Gender" value={profile.GENDER} />
          <InfoRow label="Date of Birth" value={profile['DATE OF BIRTH']} />
          <InfoRow label="Father's Name" value={profile["FATHER'S NAME"]} />
          <InfoRow label="Mother's Name" value={profile["MOTHER'S NAME"]} />
          <InfoRow label="Mobile" value={profile['Mobile No.']} />
          <div style={{ marginTop:10, fontSize:12, color:'var(--gray-400)', lineHeight:1.5 }}>
            📍 {profile['PARMANENT ADDRESS'] || '—'}, {profile.DISTRICT}, {profile.STATE}{profile.PINCODE ? ` - ${profile.PINCODE}` : ''}
          </div>
        </div>

        <div className="card">
          <div className="section-title">🎓 Education History</div>
          <div style={{ background:'var(--gray-50)', borderRadius:8, padding:'12px', marginBottom:10 }}>
            <div style={{ fontWeight:700, color:'var(--csrl-blue)', fontSize:13, marginBottom:8 }}>10th Standard</div>
            <InfoRow label="School" value={profile['10th SCHOOL NAME']} />
            <InfoRow label="Board" value={profile['10th BOARD']} />
            <InfoRow label="Percentage" value={profile['10th Precentage']} />
          </div>
          <div style={{ background:'var(--gray-50)', borderRadius:8, padding:'12px' }}>
            <div style={{ fontWeight:700, color:'var(--csrl-blue)', fontSize:13, marginBottom:8 }}>12th Standard</div>
            <InfoRow label="School" value={profile['12th SCHOOL NAME']} />
            <InfoRow label="Board" value={profile['12th BOARD']} />
            <InfoRow label="Percentage" value={profile['12th Precentage']} />
          </div>
        </div>
      </div>

      {/* Target & Analysis */}
      <div className="grid-2">
        <div className="card" style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
          <div className="section-title">🎯 Target & Goals</div>
          <div>
            <div className="lbl">Target College / Branch</div>
            <div style={{ fontWeight:700, fontSize:15, color:'var(--gray-800)', marginTop:4 }}>
              {profile['FUTURE COLLEGE (TARGET)'] || 'Not specified'}
            </div>
          </div>
          <div className="divider" style={{ margin:'4px 0' }} />
          <div className="section-title" style={{ marginBottom:6 }}>🧠 Weak Subject Analysis</div>
          <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
            <div style={{ flex:1, background:'var(--red-bg)', borderRadius:8, padding:'12px' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--red)', textTransform:'uppercase', marginBottom:4 }}>Manual Assessment</div>
              <div style={{ fontWeight:700, fontSize:15, color:'var(--red)' }}>
                {profile['WEAK SUBJECT (MANUAL)'] || profile['WEAK SUBJECT'] || 'Not specified'}
              </div>
            </div>
            <div style={{ flex:1, background:'var(--gray-50)', borderRadius:8, padding:'12px', border:'1px solid var(--gray-200)' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-600)', textTransform:'uppercase', marginBottom:4 }}>Auto Detected</div>
              <div style={{ fontWeight:700, fontSize:15, color:'var(--gray-800)' }}>{weakSubject}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="section-title">📈 Performance Trend</div>
          <div style={{ height:220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ left:-20, bottom:20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--gray-100)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill:'var(--gray-400)', fontSize:11 }} angle={-35} textAnchor="end" />
                <YAxis axisLine={false} tickLine={false} tick={{ fill:'var(--gray-400)', fontSize:11 }} width={28} />
                <Tooltip contentStyle={{ borderRadius:8, border:'none', boxShadow:'var(--shadow-lg)', fontSize:12 }} />
                <Legend wrapperStyle={{ fontSize:12 }} />
                <Line type="monotone" dataKey="Total" stroke="var(--csrl-blue)" strokeWidth={2.5} dot={{ r:4 }} activeDot={{ r:6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Full Test Records */}
      <div className="card">
        <div className="section-title">📋 Complete Test Records</div>
        <div style={{ overflowX:'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width:'35%' }}>Test Name</th>
                <th>Subject Breakdown</th>
                <th style={{ textAlign:'right', width:'12%' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {mappedTestList.map((test, i) => (
                <tr key={i}>
                  <td style={{ fontWeight:600 }}>{test.name}</td>
                  <td>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      {Object.entries(test.marks).map(([sub, mark]) => (
                        <span key={sub} style={{
                          display:'inline-flex', alignItems:'center', gap:4,
                          padding:'3px 8px', borderRadius:4, fontSize:12,
                          background: mark === 'A' ? 'var(--red-bg)' : 'var(--csrl-blue-light)',
                          border: `1px solid ${mark === 'A' ? '#fca5a5' : '#bbd0f8'}`
                        }}>
                          <span style={{ color:'var(--gray-600)', fontWeight:500 }}>{sub}:</span>
                          <span style={{ fontWeight:700, color: mark === 'A' ? 'var(--red)' : 'var(--csrl-blue)' }}>{mark}</span>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ textAlign:'right', fontWeight:800, color:'var(--csrl-blue)', fontSize:16 }}>{test.total}</td>
                </tr>
              ))}
              {mappedTestList.length === 0 && (
                <tr><td colSpan={3} style={{ textAlign:'center', color:'var(--gray-400)', padding:'32px' }}>No test records found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
