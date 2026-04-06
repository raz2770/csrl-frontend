import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  fetchGlobalData, getRankingsByTest, calculateAnalytics,
  rankCentres, addStudentApi, updateStudentApi, deleteStudentApi, upsertTestScoresApi
} from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';
import StudentProfileView from './StudentProfileView';
import StudentFormModal from './StudentFormModal';
import TestDataModal from './TestDataModal';

const STUDENT_TEMPLATE_COLUMNS = [
  'roll_number',
  'name',
  'gender',
  'category',
  'mobile',
  'dob',
  'parent_name',
  'parent_mobile',
  'address',
  'district',
  'state',
  'pincode',
  'school_10',
  'board_10',
  'percentage_10',
  'school_12',
  'board_12',
  'percentage_12',
  'future_college',
  'weak_subject_manual',
  'student_photo_url',
  'centre',
];

function normalizeCellValue(v) {
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

function toNumberOrEmpty(v) {
  if (v === undefined || v === null || v === '') return '';
  const n = Number(v);
  return Number.isFinite(n) ? n : '';
}

function getRowField(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }
  return '';
}

function mapExcelStudentToProfile(row) {
  const roll = normalizeCellValue(getRowField(row, ['roll_number', 'ROLL_NUMBER', 'Roll Number', 'roll', 'ROLL_KEY'])).toUpperCase();
  const name = normalizeCellValue(getRowField(row, ['name', 'Name', "STUDENT'S NAME"]));
  const centre = normalizeCellValue(getRowField(row, ['centre', 'Center', 'center', 'centerCode'])).toUpperCase();
  const profile = {
    ROLL_KEY: roll,
    "STUDENT'S NAME": name,
    centerCode: centre,
    GENDER: normalizeCellValue(getRowField(row, ['gender', 'Gender', 'GENDER'])),
    CATEGORY: normalizeCellValue(getRowField(row, ['category', 'Category', 'CATEGORY'])),
    'Mobile No.': normalizeCellValue(getRowField(row, ['mobile', 'Mobile', 'Mobile No.', 'mobile_no'])),
    'DATE OF BIRTH': normalizeCellValue(getRowField(row, ['dob', 'Date of Birth', 'DATE OF BIRTH'])),
    "FATHER'S NAME": normalizeCellValue(getRowField(row, ['parent_name', "FATHER'S NAME", 'father_name'])),
    "MOTHER'S NAME": normalizeCellValue(getRowField(row, ['mother_name', "MOTHER'S NAME"])),
    'PARMANENT ADDRESS': normalizeCellValue(getRowField(row, ['address', 'Address', 'PARMANENT ADDRESS'])),
    DISTRICT: normalizeCellValue(getRowField(row, ['district', 'DISTRICT'])),
    STATE: normalizeCellValue(getRowField(row, ['state', 'STATE'])),
    PINCODE: normalizeCellValue(getRowField(row, ['pincode', 'PINCODE'])),
    '10th SCHOOL NAME': normalizeCellValue(getRowField(row, ['school_10', '10th SCHOOL NAME'])),
    '10th BOARD': normalizeCellValue(getRowField(row, ['board_10', '10th BOARD'])),
    '10th Precentage': normalizeCellValue(getRowField(row, ['percentage_10', '10th Precentage'])),
    '12th SCHOOL NAME': normalizeCellValue(getRowField(row, ['school_12', '12th SCHOOL NAME'])),
    '12th BOARD': normalizeCellValue(getRowField(row, ['board_12', '12th BOARD'])),
    '12th Precentage': normalizeCellValue(getRowField(row, ['percentage_12', '12th Precentage'])),
    'FUTURE COLLEGE (TARGET)': normalizeCellValue(getRowField(row, ['future_college', 'FUTURE COLLEGE (TARGET)'])),
    'WEAK SUBJECT (MANUAL)': normalizeCellValue(getRowField(row, ['weak_subject_manual', 'WEAK SUBJECT (MANUAL)'])),
    'STUDENT PHOTO URL': normalizeCellValue(getRowField(row, ['student_photo_url', 'STUDENT PHOTO URL'])),
  };

  return profile;
}

function mapExcelMarkRow(row, selectedTest) {
  const roll = normalizeCellValue(getRowField(row, ['roll_number', 'ROLL_NUMBER', 'Roll Number', 'roll', 'ROLL_KEY'])).toUpperCase();
  return {
    roll,
    test: selectedTest,
    value: normalizeCellValue(getRowField(row, ['marks', 'score', 'Score', selectedTest])),
  };
}

export default function AdminDashboard() {
  const { activePage } = useOutletContext();
  const { user: auth } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Navigation sub-state
  const [viewingStudentId, setViewingStudentId] = useState(null);
  const [selectedTestKey, setSelectedTestKey] = useState('');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterCenter, setFilterCenter] = useState('ALL');

  // Modals
  const [modalMode, setModalMode] = useState(null); // 'add' | 'edit' | 'tests' | null
  const [modalStudent, setModalStudent] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [toast, setToast] = useState('');

  // Import / export state
  const [importMode, setImportMode] = useState(null); // 'students' | 'marks' | null
  const [uploadPreview, setUploadPreview] = useState([]);
  const [uploadError, setUploadError] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadTestKey, setUploadTestKey] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    fetchGlobalData(null)
      .then(d => {
        setData(d);
        const rankingCols = (d.testColumns || []).filter((c) => !String(c).includes('_'));
        const candidate = rankingCols.length ? rankingCols[rankingCols.length - 1] : d.testColumns?.[0];
        if (candidate) setSelectedTestKey(candidate);
      })
      .catch(err => setError('Failed to load: ' + err.message))
      .finally(() => setLoading(false));
  }, []);

  const rankingTestColumns = useMemo(
    () => (data?.testColumns || []).filter((c) => !String(c).includes('_')),
    [data]
  );

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const downloadStudentTemplate = () => {
    const rows = [
      STUDENT_TEMPLATE_COLUMNS,
      ['GAIL001', 'Aarav Sharma', 'Male', 'General', '9876543210', '2006-03-15', 'Rajesh Sharma', '9876543200', 'Civil Lines', 'Kanpur', 'UP', '208001', 'DPS', 'CBSE', 92.4, 'KV', 'CBSE', 89.1, 'IIT Kanpur', 'Chemistry', 'https://example.com/photo.jpg', 'GAIL'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = STUDENT_TEMPLATE_COLUMNS.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students Template');
    XLSX.writeFile(wb, 'CSRL_Students_Template.xlsx');
  };

  const exportStudentsXlsx = () => {
    if (!data?.profiles?.length) {
      showToast('❌ No students to export.');
      return;
    }

    const rows = data.profiles.map((s) => ({
      roll_number: s.ROLL_KEY || '',
      name: s["STUDENT'S NAME"] || '',
      gender: s.GENDER || '',
      category: s.CATEGORY || '',
      mobile: s['Mobile No.'] || '',
      dob: s['DATE OF BIRTH'] || '',
      parent_name: s["FATHER'S NAME"] || '',
      address: s['PARMANENT ADDRESS'] || '',
      district: s.DISTRICT || '',
      state: s.STATE || '',
      pincode: s.PINCODE || '',
      school_10: s['10th SCHOOL NAME'] || '',
      board_10: s['10th BOARD'] || '',
      percentage_10: s['10th Precentage'] || '',
      school_12: s['12th SCHOOL NAME'] || '',
      board_12: s['12th BOARD'] || '',
      percentage_12: s['12th Precentage'] || '',
      future_college: s['FUTURE COLLEGE (TARGET)'] || '',
      weak_subject_manual: s['WEAK SUBJECT (MANUAL)'] || '',
      student_photo_url: s['STUDENT PHOTO URL'] || '',
      centre: s.centerCode || '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, 'CSRL_Students_Export.xlsx');
    showToast('✅ Student data exported.');
  };

  const exportMarksXlsx = () => {
    if (!selectedTestKey) {
      showToast('❌ Select a test first.');
      return;
    }
    const rows = data?.profiles?.map((p) => {
      const scoreDoc = data.tests.find((t) => t.ROLL_KEY === p.ROLL_KEY) || {};
      return {
        roll_number: p.ROLL_KEY,
        name: p["STUDENT'S NAME"] || '',
        centre: p.centerCode || '',
        test_key: selectedTestKey,
        marks: scoreDoc[selectedTestKey] ?? '',
      };
    }) || [];

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Marks_${selectedTestKey}`);
    XLSX.writeFile(wb, `CSRL_Marks_${selectedTestKey}.xlsx`);
    showToast('✅ Marks exported.');
  };

  const exportCombinedWorkbook = () => {
    if (!data) return;

    const studentsRows = data.profiles.map((p) => ({
      roll_number: p.ROLL_KEY,
      name: p["STUDENT'S NAME"] || '',
      centre: p.centerCode || '',
      category: p.CATEGORY || '',
      jee_percentile: p['JEE MAIN PERCENTILE'] || '',
    }));

    const marksRows = data.tests.map((t) => {
      const row = { roll_number: t.ROLL_KEY };
      (data.testColumns || []).forEach((col) => {
        row[col] = t[col] ?? '';
      });
      return row;
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(studentsRows), 'Students');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(marksRows), 'Scores');
    XLSX.writeFile(wb, 'CSRL_Full_Data_Export.xlsx');
    showToast('✅ Full workbook exported.');
  };

  const resetImportState = () => {
    setUploadPreview([]);
    setUploadError('');
    setUploadLoading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const openImportModal = (mode) => {
    setImportMode(mode);
    setUploadTestKey(selectedTestKey || data?.testColumns?.[0] || '');
    resetImportState();
  };

  const closeImportModal = () => {
    setImportMode(null);
    resetImportState();
  };

  const handleImportFile = async (file) => {
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setUploadError('Please upload .xlsx, .xls or .csv file.');
      return;
    }

    setUploadLoading(true);
    setUploadError('');

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (!rows.length) {
        setUploadError('File has no data rows.');
        setUploadPreview([]);
        return;
      }

      if (importMode === 'students') {
        const existingRolls = new Set((data?.profiles || []).map((p) => p.ROLL_KEY?.toUpperCase()));
        const preview = rows.map((row, idx) => {
          const mapped = mapExcelStudentToProfile(row);
          if (!mapped.ROLL_KEY) return { row: idx + 2, status: 'err', reason: 'Missing roll_number' };
          if (!mapped["STUDENT'S NAME"]) return { row: idx + 2, status: 'err', reason: 'Missing name', roll: mapped.ROLL_KEY };
          if (!mapped.centerCode) return { row: idx + 2, status: 'err', reason: 'Missing centre', roll: mapped.ROLL_KEY, name: mapped["STUDENT'S NAME"] };

          return {
            row: idx + 2,
            status: existingRolls.has(mapped.ROLL_KEY) ? 'update' : 'new',
            reason: existingRolls.has(mapped.ROLL_KEY) ? 'Will update' : 'Will insert',
            roll: mapped.ROLL_KEY,
            name: mapped["STUDENT'S NAME"],
            centre: mapped.centerCode,
            payload: mapped,
          };
        });
        setUploadPreview(preview);
      } else {
        const existingRolls = new Set((data?.profiles || []).map((p) => p.ROLL_KEY?.toUpperCase()));
        const existingMarks = new Set(
          (data?.tests || [])
            .filter((t) => t[uploadTestKey] !== undefined)
            .map((t) => t.ROLL_KEY?.toUpperCase())
        );

        const preview = rows.map((row, idx) => {
          const mapped = mapExcelMarkRow(row, uploadTestKey);
          if (!mapped.roll) return { row: idx + 2, status: 'err', reason: 'Missing roll_number' };
          if (!existingRolls.has(mapped.roll)) return { row: idx + 2, status: 'err', reason: 'Student roll not found', roll: mapped.roll };
          if (mapped.value === '') return { row: idx + 2, status: 'err', reason: 'Missing marks', roll: mapped.roll };

          return {
            row: idx + 2,
            status: existingMarks.has(mapped.roll) ? 'update' : 'new',
            reason: existingMarks.has(mapped.roll) ? 'Will update score' : 'Will create score',
            roll: mapped.roll,
            marks: mapped.value,
            payload: mapped,
          };
        });
        setUploadPreview(preview);
      }
    } catch (e) {
      setUploadError('Failed to parse file: ' + e.message);
      setUploadPreview([]);
    } finally {
      setUploadLoading(false);
    }
  };

  const confirmImport = async () => {
    const valid = uploadPreview.filter((p) => p.status === 'new' || p.status === 'update');
    if (!valid.length) {
      showToast('❌ No valid rows to import.');
      return;
    }

    setUploadLoading(true);
    try {
      if (importMode === 'students') {
        let newCount = 0;
        let updateCount = 0;

        for (const row of valid) {
          const exists = data.profiles.find((p) => p.ROLL_KEY === row.payload.ROLL_KEY);
          if (exists) {
            await updateStudentApi(null, row.payload.ROLL_KEY, row.payload);
            updateCount += 1;
          } else {
            await addStudentApi(null, row.payload);
            newCount += 1;
          }
        }

        const refreshed = await fetchGlobalData(null);
        setData(refreshed);
        showToast(`✅ Students imported: ${newCount} new, ${updateCount} updated.`);
      } else {
        let newCount = 0;
        let updateCount = 0;

        for (const row of valid) {
          const existing = data.tests.find((t) => t.ROLL_KEY === row.payload.roll);
          const prev = existing?.[uploadTestKey];
          await upsertTestScoresApi(null, row.payload.roll, { [uploadTestKey]: row.payload.value });
          if (prev === undefined || prev === null || prev === '') newCount += 1;
          else updateCount += 1;
        }

        const refreshed = await fetchGlobalData(null);
        setData(refreshed);
        showToast(`✅ Marks imported: ${newCount} new, ${updateCount} updated.`);
      }

      closeImportModal();
    } catch (e) {
      showToast('❌ Import failed: ' + e.message);
    } finally {
      setUploadLoading(false);
    }
  };

  const analytics = useMemo(() => data ? calculateAnalytics(data.profiles) : { totalStudents: 0, avgJee: 'N/A', highestJee: 'N/A' }, [data]);
  const rankings = useMemo(() => {
    if (!data || !selectedTestKey) return { top10: [], bottom10: [], rankedScores: [] };
    const r = getRankingsByTest(data.profiles, data.tests, selectedTestKey);
    return { ...r, top10: r.rankedScores.slice(0, 30), bottom10: [...r.rankedScores].reverse().slice(0, 30) };
  }, [data, selectedTestKey]);
  const centreRankings = useMemo(() => data ? rankCentres(data.profiles, data.tests, data.testColumns) : [], [data]);

  const filteredStudents = useMemo(() => {
    if (!data) return [];
    return data.profiles.filter(p => {
      const matchSearch = (p["STUDENT'S NAME"]||'').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.ROLL_KEY||'').toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = filterCategory === 'ALL' || p.CATEGORY === filterCategory;
      const matchCenter = filterCenter === 'ALL' || p.centerCode === filterCenter;
      return matchSearch && matchCat && matchCenter;
    });
  }, [data, searchTerm, filterCategory, filterCenter]);

  const categories = useMemo(() => ['ALL', ...[...new Set(data?.profiles.map(p=>p.CATEGORY).filter(Boolean))]], [data]);
  const centersList = useMemo(() => ['ALL', ...[...new Set(data?.profiles.map(p=>p.centerCode).filter(Boolean))]], [data]);

  // ── CRUD handlers ──────────────────────────────────────────────────────────
  const handleAddStudent = async (form) => {
    setModalLoading(true);
    try {
      const result = await addStudentApi(null, form);
      setData(d => ({ ...d, profiles: [...d.profiles, result.student] }));
      setModalMode(null);
      showToast('✅ Student added successfully!');
    } catch (e) { showToast('❌ ' + e.message); }
    finally { setModalLoading(false); }
  };

  const handleEditStudent = async (form) => {
    setModalLoading(true);
    try {
      const result = await updateStudentApi(null, modalStudent.ROLL_KEY, form);
      setData(d => ({ ...d, profiles: d.profiles.map(p => p.ROLL_KEY === modalStudent.ROLL_KEY ? result.student : p) }));
      setModalMode(null);
      showToast('✅ Student updated!');
    } catch (e) { showToast('❌ ' + e.message); }
    finally { setModalLoading(false); }
  };

  const handleDeleteStudent = async (rollKey) => {
    if (!window.confirm(`Delete student ${rollKey}? This cannot be undone.`)) return;
    try {
      await deleteStudentApi(null, rollKey);
      setData(d => ({ ...d, profiles: d.profiles.filter(p => p.ROLL_KEY !== rollKey), tests: d.tests.filter(t => t.ROLL_KEY !== rollKey) }));
      showToast('🗑️ Student deleted.');
    } catch (e) { showToast('❌ ' + e.message); }
  };

  const handleSaveTestScores = async (scores) => {
    setModalLoading(true);
    try {
      const result = await upsertTestScoresApi(null, modalStudent.ROLL_KEY, scores);
      setData(d => ({
        ...d,
        tests: d.tests.map(t => t.ROLL_KEY === modalStudent.ROLL_KEY ? result.testRecord : t)
          .concat(d.tests.find(t => t.ROLL_KEY === modalStudent.ROLL_KEY) ? [] : [result.testRecord])
      }));
      setModalMode(null);
      showToast('✅ Test scores saved!');
    } catch (e) { showToast('❌ ' + e.message); }
    finally { setModalLoading(false); }
  };

  const rankClass = (i) => i === 0 ? 'rank-gold' : i === 1 ? 'rank-silver' : i === 2 ? 'rank-bronze' : '';

  if (loading) return (
    <div style={{ display:'flex', height:'60vh', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'14px', color:'var(--gray-400)' }}>
      <div style={{ fontSize:40 }}>⏳</div><p style={{ fontWeight:600 }}>Aggregating all centre data...</p>
    </div>
  );
  if (error) return <div style={{ color:'var(--red)', padding:32, textAlign:'center' }}>{error}</div>;

  if (viewingStudentId) {
    const profile = data.profiles.find(p => p.ROLL_KEY === viewingStudentId);
    const studentTests = data.tests.find(t => t.ROLL_KEY === viewingStudentId) || {};
    return (
      <div className="fade-in">
        <div className="page-header">
          <button onClick={() => setViewingStudentId(null)} className="btn btn-sm" style={{ background:'rgba(255,255,255,.15)', color:'#fff', border:'none', marginRight:8 }}>← Back</button>
          <div><h1>Student Profile</h1><p>{profile?.["STUDENT'S NAME"]} · {viewingStudentId}</p></div>
        </div>
        <div className="content">
          <StudentProfileView profile={profile} studentTests={studentTests} testColumns={data.testColumns} />
        </div>
      </div>
    );
  }

  const pageTitle = {
    dashboard: 'Overview',
    'centre-rankings': 'Centre Rankings',
    students: 'Student Database',
    rankings: 'Test Rankings',
    'import-export': 'Import / Export',
  };

  // ── Sections ───────────────────────────────────────────────────────────────

  const DashboardSection = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div className="grid-4">
        <div className="stat-card"><div className="stat-icon" style={{ background:'var(--csrl-blue-light)' }}>👥</div><div><div className="stat-val" style={{ color:'var(--csrl-blue)' }}>{analytics.totalStudents}</div><div className="stat-lbl">Total Students</div></div></div>
        <div className="stat-card"><div className="stat-icon" style={{ background:'#fff3e0' }}>🏢</div><div><div className="stat-val" style={{ color:'var(--csrl-orange)' }}>{centersList.length - 1}</div><div className="stat-lbl">Active Centres</div></div></div>
        <div className="stat-card"><div className="stat-icon" style={{ background:'var(--green-bg)' }}>📈</div><div><div className="stat-val" style={{ color:'var(--green)' }}>{analytics.avgJee}</div><div className="stat-lbl">Avg JEE %ile</div></div></div>
        <div className="stat-card"><div className="stat-icon" style={{ background:'#fff3e0' }}>🏅</div><div><div className="stat-val" style={{ color:'var(--csrl-gold)' }}>{analytics.highestJee}</div><div className="stat-lbl">Highest JEE %ile</div></div></div>
      </div>
      {/* Mini Centre Rankings preview */}
      <div className="card">
        <div className="section-title">🏆 Centre Performance Leaderboard</div>
        <table className="table">
          <thead><tr><th>#</th><th>Centre</th><th>Students</th><th>Avg Score</th><th>Weak Subject</th></tr></thead>
          <tbody>
            {centreRankings.slice(0, 5).map((c, i) => (
              <tr key={c.code}>
                <td className={rankClass(i)}>{c.rank}</td>
                <td style={{ fontWeight:700, color:'var(--csrl-blue)' }}>{c.code}</td>
                <td>{c.studentCount}</td>
                <td><span className="chip chip-good">{c.avgScore}</span></td>
                <td><span className="chip chip-weak">{c.weakSubject}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const CentreRankingsSection = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className="grid-3">
        <div className="stat-card"><div className="stat-icon" style={{ background:'#fff3e0' }}>🥇</div><div><div className="stat-val" style={{ color:'var(--csrl-gold)' }}>{centreRankings[0]?.code || '—'}</div><div className="stat-lbl">Top Centre</div></div></div>
        <div className="stat-card"><div className="stat-icon" style={{ background:'var(--csrl-blue-light)' }}>🏢</div><div><div className="stat-val" style={{ color:'var(--csrl-blue)' }}>{centreRankings.length}</div><div className="stat-lbl">Total Centres</div></div></div>
        <div className="stat-card"><div className="stat-icon" style={{ background:'var(--green-bg)' }}>📊</div><div><div className="stat-val" style={{ color:'var(--green)', fontSize:18 }}>{centreRankings[0]?.avgScore || '—'}</div><div className="stat-lbl">Highest Avg Score</div></div></div>
      </div>
      <div className="card">
        <div className="section-title">🏆 All Centre Rankings — by Average Test Score</div>
        <div style={{ overflowX:'auto' }}>
          <table className="table">
            <thead>
              <tr><th>#</th><th>Centre Code</th><th>Students</th><th>Avg Score</th><th>Weak Subject</th><th>Performance</th></tr>
            </thead>
            <tbody>
              {centreRankings.map((c, i) => {
                const maxAvg = centreRankings[0]?.avgScore || 1;
                const pct = Math.round((c.avgScore / maxAvg) * 100);
                return (
                  <tr key={c.code}>
                    <td className={rankClass(i)} style={{ fontWeight:800 }}>{c.rank}</td>
                    <td style={{ fontWeight:700, color:'var(--csrl-blue)', fontSize:15 }}>{c.code}</td>
                    <td>{c.studentCount}</td>
                    <td><span className={`chip ${c.rank <= 3 ? 'chip-good' : ''}`} style={c.rank > 3 ? { background:'var(--csrl-blue-light)', color:'var(--csrl-blue)' } : {}}>{c.avgScore}</span></td>
                    <td><span className="chip chip-weak">{c.weakSubject}</span></td>
                    <td style={{ width:120 }}>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width:`${pct}%`, background: c.rank <= 5 ? 'var(--green)' : c.rank <= 15 ? 'var(--csrl-gold)' : 'var(--csrl-orange)' }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {centreRankings.length === 0 && <tr><td colSpan={6} style={{ textAlign:'center', color:'var(--gray-400)', padding:32 }}>No data available</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const StudentsSection = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <input type="text" className="input" style={{ width:200 }} placeholder="Search name or roll..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          <select className="input select" style={{ width:130 }} value={filterCenter} onChange={e => setFilterCenter(e.target.value)}>
            <option value="ALL">All Centres</option>
            {centersList.filter(c=>c!=='ALL').map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <select className="input select" style={{ width:130 }} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            {categories.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button onClick={() => { setModalStudent(null); setModalMode('add'); }} className="btn btn-primary">
          ➕ Add Student
          </button>
          <button onClick={() => openImportModal('students')} className="btn btn-purple">📤 Import XLS</button>
          <button onClick={exportStudentsXlsx} className="btn btn-outline">📥 Export XLS</button>
        </div>
      </div>
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <div style={{ overflowX:'auto', maxHeight:600, overflowY:'auto' }}>
          <table className="table">
            <thead><tr><th>Roll No</th><th>Name</th><th>Centre</th><th>Category</th><th>Actions</th></tr></thead>
            <tbody>
              {filteredStudents.map((s, i) => (
                <tr key={i}>
                  <td style={{ fontWeight:700, color:'var(--csrl-blue)', fontFamily:'monospace' }}>{s.ROLL_KEY}</td>
                  <td style={{ fontWeight:600 }}>{s["STUDENT'S NAME"]}</td>
                  <td><span className="chip" style={{ background:'var(--csrl-blue-light)', color:'var(--csrl-blue)' }}>{s.centerCode}</span></td>
                  <td><span className={`badge badge-${(s.CATEGORY||'general').toLowerCase()}`}>{s.CATEGORY||'General'}</span></td>
                  <td>
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={() => setViewingStudentId(s.ROLL_KEY)} className="btn btn-primary btn-sm">View</button>
                      <button onClick={() => { setModalStudent(s); setModalMode('edit'); }} className="btn btn-outline btn-sm">Edit</button>
                      <button onClick={() => { setModalStudent(s); setModalMode('tests'); }} className="btn btn-sm" style={{ background:'#fff3e0', color:'#b45309', border:'1px solid #fed7aa' }}>Tests</button>
                      <button onClick={() => handleDeleteStudent(s.ROLL_KEY)} className="btn btn-danger btn-sm">Del</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredStudents.length === 0 && <tr><td colSpan={5} style={{ textAlign:'center', color:'var(--gray-400)', padding:32 }}>No records found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const RankingsSection = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className="card" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div className="section-title" style={{ margin:0 }}>📊 Select Test</div>
        <select className="input select" style={{ width:'auto', minWidth:220 }} value={selectedTestKey} onChange={e => setSelectedTestKey(e.target.value)}>
          {rankingTestColumns.map(col => <option key={col} value={col}>{col}</option>)}
        </select>
      </div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <button onClick={() => openImportModal('marks')} className="btn btn-teal">📤 Import Marks XLS</button>
        <button onClick={exportMarksXlsx} className="btn btn-outline">📥 Export Selected Test</button>
        <button onClick={exportCombinedWorkbook} className="btn btn-ghost">📦 Export Full Workbook</button>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="section-title">🏆 Top 30 Performers</div>
          <div style={{ maxHeight:460, overflowY:'auto' }}>
            <table className="table">
              <thead><tr><th>#</th><th>Student</th><th>Centre</th><th>Score</th></tr></thead>
              <tbody>
                {rankings.top10.map((s, i) => (
                  <tr key={i} style={{ cursor:'pointer' }} onClick={() => setViewingStudentId(s.roll)}>
                    <td className={rankClass(i)}>{i+1}</td>
                    <td><div style={{ fontWeight:600, fontSize:13 }}>{s.name}</div><div style={{ fontSize:11, color:'var(--gray-400)', fontFamily:'monospace' }}>{s.roll}</div></td>
                    <td><span className="chip" style={{ background:'var(--csrl-blue-light)', color:'var(--csrl-blue)' }}>{s.center}</span></td>
                    <td><span className="chip chip-good">{s.marks}</span></td>
                  </tr>
                ))}
                {rankings.top10.length === 0 && <tr><td colSpan={4} style={{ textAlign:'center', color:'var(--gray-400)', padding:20 }}>No data</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="section-title">⚠️ Bottom 30 — Needs Attention</div>
          <div style={{ maxHeight:460, overflowY:'auto' }}>
            <table className="table">
              <thead><tr><th>#</th><th>Student</th><th>Centre</th><th>Score</th></tr></thead>
              <tbody>
                {rankings.bottom10.map((s, i) => (
                  <tr key={i} style={{ cursor:'pointer' }} onClick={() => setViewingStudentId(s.roll)}>
                    <td style={{ color:'var(--gray-400)' }}>{i+1}</td>
                    <td><div style={{ fontWeight:600, fontSize:13 }}>{s.name}</div><div style={{ fontSize:11, color:'var(--gray-400)', fontFamily:'monospace' }}>{s.roll}</div></td>
                    <td><span className="chip" style={{ background:'var(--csrl-blue-light)', color:'var(--csrl-blue)' }}>{s.center}</span></td>
                    <td><span className="chip chip-weak">{s.marks}</span></td>
                  </tr>
                ))}
                {rankings.bottom10.length === 0 && <tr><td colSpan={4} style={{ textAlign:'center', color:'var(--gray-400)', padding:20 }}>No data</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const ImportExportSection = () => (
    <div className="grid-2">
      <div className="card" style={{ border:'2px solid #6d28d9' }}>
        <div className="section-title">👥 Student Profiles</div>
        <p style={{ color:'var(--gray-600)', fontSize:13, marginBottom:12 }}>
          Bulk import and export student profile records using Excel. Existing roll numbers are updated, new roll numbers are inserted.
        </p>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <button className="btn btn-outline" onClick={downloadStudentTemplate}>⬇️ Download Template</button>
          <button className="btn btn-purple" onClick={() => openImportModal('students')}>📤 Import Students</button>
          <button className="btn btn-success" onClick={exportStudentsXlsx}>📥 Export Students</button>
        </div>
      </div>

      <div className="card" style={{ border:'2px solid #0f766e' }}>
        <div className="section-title">📝 Test Scores</div>
        <p style={{ color:'var(--gray-600)', fontSize:13, marginBottom:12 }}>
          Import marks for one test column at a time, or export selected test and full workbook snapshots.
        </p>
        <div className="form-group" style={{ marginBottom:10 }}>
          <label className="label">Test Column</label>
          <select
            className="input select"
            value={selectedTestKey}
            onChange={(e) => {
              setSelectedTestKey(e.target.value);
              setUploadTestKey(e.target.value);
            }}
          >
            {rankingTestColumns.map((col) => <option key={col} value={col}>{col}</option>)}
          </select>
        </div>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <button className="btn btn-teal" onClick={() => openImportModal('marks')}>📤 Import Marks</button>
          <button className="btn btn-outline" onClick={exportMarksXlsx}>📥 Export Selected Test</button>
          <button className="btn btn-ghost" onClick={exportCombinedWorkbook}>📦 Export Full Workbook</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fade-in">
      {/* Toast */}
      {toast && (
        <div style={{
          position:'fixed', top:16, right:16, zIndex:2000,
          background: toast.startsWith('❌') ? 'var(--red)' : '#1a8a4a',
          color:'#fff', padding:'12px 20px', borderRadius:'var(--radius)', boxShadow:'var(--shadow-lg)',
          fontSize:14, fontWeight:600
        }}>{toast}</div>
      )}

      {/* Modals */}
      {(modalMode === 'add' || modalMode === 'edit') && (
        <StudentFormModal
          mode={modalMode}
          student={modalStudent}
          loading={modalLoading}
          onClose={() => setModalMode(null)}
          onSubmit={modalMode === 'add' ? handleAddStudent : handleEditStudent}
        />
      )}
      {modalMode === 'tests' && (
        <TestDataModal
          student={modalStudent}
          testColumns={data.testColumns}
          existingScores={data.tests.find(t => t.ROLL_KEY === modalStudent?.ROLL_KEY) || {}}
          loading={modalLoading}
          onClose={() => setModalMode(null)}
          onSubmit={handleSaveTestScores}
        />
      )}

      {importMode && (
        <div className="modal-overlay" onClick={closeImportModal}>
          <div className="modal" style={{ maxWidth:760 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                {importMode === 'students' ? '📤 Import Student Profiles' : '📤 Import Test Marks'}
              </div>
              <button className="modal-close" onClick={closeImportModal}>×</button>
            </div>
            <div className="modal-body">
              {importMode === 'marks' && (
                <div className="form-group">
                  <label className="label">Test Column</label>
                  <select className="input select" value={uploadTestKey} onChange={(e) => setUploadTestKey(e.target.value)}>
                    {rankingTestColumns.map((col) => <option key={col} value={col}>{col}</option>)}
                  </select>
                </div>
              )}

              <div className="upload-zone" onClick={() => fileRef.current?.click()}>
                <div style={{ fontSize:36, marginBottom:10 }}>📁</div>
                <div style={{ fontWeight:700, marginBottom:6 }}>Upload Excel/CSV file</div>
                <div style={{ fontSize:13, color:'var(--gray-400)' }}>
                  {importMode === 'students'
                    ? 'Use template headers for best mapping.'
                    : 'File must have roll_number and marks/score column.'}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  style={{ display:'none' }}
                  onChange={(e) => handleImportFile(e.target.files?.[0])}
                />
              </div>

              {importMode === 'students' && (
                <div style={{ marginTop:10 }}>
                  <button className="btn btn-outline btn-sm" onClick={downloadStudentTemplate}>⬇️ Download Student Template</button>
                </div>
              )}

              {uploadLoading && (
                <div style={{ marginTop:12, color:'var(--csrl-blue)', fontWeight:600 }}>⏳ Processing file...</div>
              )}
              {uploadError && (
                <div style={{ marginTop:12, background:'var(--red-bg)', color:'var(--red)', borderRadius:6, padding:'10px 12px', fontSize:13 }}>
                  {uploadError}
                </div>
              )}

              {!!uploadPreview.length && (
                <div style={{ marginTop:14 }}>
                  <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:10 }}>
                    <span className="pill-new">New: {uploadPreview.filter((p) => p.status === 'new').length}</span>
                    <span className="pill-update">Update: {uploadPreview.filter((p) => p.status === 'update').length}</span>
                    <span className="pill-err">Errors: {uploadPreview.filter((p) => p.status === 'err').length}</span>
                  </div>
                  <div className="preview-wrap">
                    <table className="preview-table">
                      <thead>
                        <tr>
                          <th>Row</th>
                          <th>Roll</th>
                          <th>{importMode === 'students' ? 'Name' : 'Marks'}</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uploadPreview.map((row, idx) => (
                          <tr key={idx}>
                            <td>{row.row}</td>
                            <td>{row.roll || '—'}</td>
                            <td>{importMode === 'students' ? (row.name || '—') : (row.marks ?? '—')}</td>
                            <td>
                              <span className={row.status === 'new' ? 'pill-new' : row.status === 'update' ? 'pill-update' : 'pill-err'}>
                                {row.reason}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={closeImportModal}>Cancel</button>
              <button className="btn btn-primary" disabled={uploadLoading || uploadPreview.length === 0} onClick={confirmImport}>
                ✅ Confirm Import
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <h1>🛡️ Super Admin — {pageTitle[activePage] || 'Overview'}</h1>
        <p style={{ marginTop:4, opacity:.75, fontSize:13 }}>Global Network · {centreRankings.length} Centres · {analytics.totalStudents} Students</p>
      </div>
      <div className="content">
        {activePage === 'centre-rankings' ? <CentreRankingsSection /> :
         activePage === 'students' ? <StudentsSection /> :
         activePage === 'import-export' ? <ImportExportSection /> :
         activePage === 'rankings' ? <RankingsSection /> :
         <DashboardSection />}
      </div>
    </div>
  );
}
