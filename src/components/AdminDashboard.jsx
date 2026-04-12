import { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Users, Building2, FileText, AlertTriangle, Trophy, ArrowLeft,
  ShieldCheck, Plus, Upload, Download, Package, Pencil, Trash2,
  Search, TrendingUp, TrendingDown, LayoutDashboard, BarChart2,
  Lightbulb, Loader2, CheckCircle2,
  Eye, BarChart3,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  fetchGlobalData,
  fetchOverview,
  fetchRankings,
  fetchCentreLeaderboard,
  fetchTestInsights,
  addStudentApi,
  updateStudentApi,
  deleteStudentApi,
  upsertTestScoresApi,
  parseTestColumn,
  getJeePercentile,
  getStreamConfig,
} from '../services/dataService';
import { useToast } from '../context/ToastContext';
import StudentProfileView from './StudentProfileView';
import StudentFormModal from './StudentFormModal';
import TestDataModal from './TestDataModal';
import CentreLeaderboard from './CentreLeaderboard';
import TestInsightsPanel from './TestInsightsPanel';

// ── Constants ─────────────────────────────────────────────────────────────────

const STUDENT_TEMPLATE_COLUMNS = [
  'roll_number', 'name', 'gender', 'category', 'mobile', 'dob',
  'parent_name', 'parent_mobile', 'address', 'district', 'state', 'pincode',
  'school_10', 'board_10', 'percentage_10', 'school_12', 'board_12',
  'percentage_12', 'future_college', 'weak_subject_manual',
  'student_photo_url', 'centre', 'stream',
];

const TABS = [
  { key: 'leaderboard', Icon: Trophy,         label: 'Centre Leaderboard' },
  { key: 'overview',    Icon: LayoutDashboard, label: 'Dashboard'          },
  { key: 'ranking',     Icon: TrendingUp,      label: 'Rankings'           },
  { key: 'insights',    Icon: BarChart3,       label: 'Test analysis'     },
  { key: 'students',    Icon: Users,           label: 'Students'           },
  { key: 'marks',       Icon: FileText,        label: 'Test Marks'         },
  { key: 'import',      Icon: Upload,          label: 'Import / Export'    },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function normalizeCellValue(v) {
  return (v === undefined || v === null) ? '' : String(v).trim();
}

function normalizeRollKey(v) {
  return normalizeCellValue(v).replace(/\.0+$/, '').toUpperCase();
}

function normalizeCenterCode(v) {
  return normalizeCellValue(v).toUpperCase();
}

function getRowField(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }
  return '';
}

function mapExcelStudentToProfile(row) {
  const roll   = normalizeRollKey(getRowField(row, ['roll_number', 'ROLL_NUMBER', 'Roll Number', 'roll', 'ROLL_KEY']));
  const name   = normalizeCellValue(getRowField(row, ['name', 'Name', "STUDENT'S NAME"]));
  const centre = normalizeCenterCode(getRowField(row, ['centre', 'Center', 'center', 'centerCode']));
  const stream = normalizeCellValue(getRowField(row, ['stream', 'Stream', 'STREAM'])).toUpperCase() || 'JEE';

  return {
    ROLL_KEY: roll,
    "STUDENT'S NAME": name,
    centerCode:                centre,
    stream:                    stream === 'NEET' ? 'NEET' : 'JEE',
    GENDER:                    normalizeCellValue(getRowField(row, ['gender', 'Gender', 'GENDER'])),
    CATEGORY:                  normalizeCellValue(getRowField(row, ['category', 'Category', 'CATEGORY'])),
    'Mobile No.':              normalizeCellValue(getRowField(row, ['mobile', 'Mobile', 'Mobile No.', 'mobile_no'])),
    'DATE OF BIRTH':           normalizeCellValue(getRowField(row, ['dob', 'Date of Birth', 'DATE OF BIRTH'])),
    "FATHER'S NAME":           normalizeCellValue(getRowField(row, ['parent_name', "FATHER'S NAME", 'father_name'])),
    "MOTHER'S NAME":           normalizeCellValue(getRowField(row, ['mother_name', "MOTHER'S NAME"])),
    'PARMANENT ADDRESS':       normalizeCellValue(getRowField(row, ['address', 'Address', 'PARMANENT ADDRESS'])),
    DISTRICT:                  normalizeCellValue(getRowField(row, ['district', 'DISTRICT'])),
    STATE:                     normalizeCellValue(getRowField(row, ['state', 'STATE'])),
    PINCODE:                   normalizeCellValue(getRowField(row, ['pincode', 'PINCODE'])),
    '10th SCHOOL NAME':        normalizeCellValue(getRowField(row, ['school_10', '10th SCHOOL NAME'])),
    '10th BOARD':              normalizeCellValue(getRowField(row, ['board_10', '10th BOARD'])),
    '10th Precentage':         normalizeCellValue(getRowField(row, ['percentage_10', '10th Precentage'])),
    '12th SCHOOL NAME':        normalizeCellValue(getRowField(row, ['school_12', '12th SCHOOL NAME'])),
    '12th BOARD':              normalizeCellValue(getRowField(row, ['board_12', '12th BOARD'])),
    '12th Precentage':         normalizeCellValue(getRowField(row, ['percentage_12', '12th Precentage'])),
    'FUTURE COLLEGE (TARGET)': normalizeCellValue(getRowField(row, ['future_college', 'FUTURE COLLEGE (TARGET)'])),
    'WEAK SUBJECT (MANUAL)':   normalizeCellValue(getRowField(row, ['weak_subject_manual', 'WEAK SUBJECT (MANUAL)'])),
    'STUDENT PHOTO URL':       normalizeCellValue(getRowField(row, ['student_photo_url', 'STUDENT PHOTO URL'])),
  };
}

function mapExcelMarkRow(row, testKey) {
  const roll = normalizeRollKey(getRowField(row, ['roll_number', 'ROLL_NUMBER', 'Roll Number', 'roll', 'ROLL_KEY']));
  return {
    roll,
    test:  testKey,
    value: normalizeCellValue(getRowField(row, ['marks', 'score', 'Score', testKey])),
  };
}

/**
 * Build flat marks rows from profiles + tests for the marks table.
 * Dynamically handles JEE (Phy/Che/Mat) and NEET (Phy/Che/Bio).
 */
function buildMarksRows(profiles, tests, testColumns) {
  const rows = [];
  const subjectCols = (testColumns || []).filter((c) => !parseTestColumn(c).isTotal);
  if (!subjectCols.length) return rows;

  profiles.forEach((profile) => {
    const testDoc = tests.find((t) => t.ROLL_KEY === profile.ROLL_KEY);
    if (!testDoc) return;

    const stream    = profile.stream || testDoc.stream || 'JEE';
    const testNames = new Set(subjectCols.map((c) => parseTestColumn(c).testName));

    testNames.forEach((testName) => {
      const subjects = {};
      let hasAnyScore = false;

      subjectCols.forEach((col) => {
        const meta = parseTestColumn(col);
        if (meta.testName !== testName) return;
        const raw = testDoc[col];
        if (raw === undefined || raw === null || raw === '' || String(raw).toLowerCase() === 'absent') return;
        const n = parseFloat(raw);
        if (!isNaN(n)) { subjects[meta.subject] = n; hasAnyScore = true; }
      });

      if (!hasAnyScore) return;

      const total = Object.values(subjects).reduce((s, v) => s + v, 0);
      rows.push({
        roll:     profile.ROLL_KEY,
        name:     profile["STUDENT'S NAME"] || '',
        centre:   profile.centerCode || '',
        stream,
        test:     testName,
        subjects,
        total,
      });
    });
  });

  return rows.sort(
    (a, b) =>
      a.roll.localeCompare(b.roll) ||
      String(a.test).localeCompare(String(b.test), undefined, { numeric: true })
  );
}

function getInitials(name = '') {
  return name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function pctBar(numerator, denominator) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { activePage, setActivePage } = useOutletContext();
  const showToast = useToast();

  const [data,            setData]            = useState(null);
  const [overview,        setOverview]        = useState(null);
  const [topRanked,       setTopRanked]       = useState([]);
  const [bottomRanked,    setBottomRanked]    = useState([]);
  const [centreBoard,     setCentreBoard]     = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState('');

  const [viewingStudentId, setViewingStudentId] = useState(null);
  const [selectedTestKey,  setSelectedTestKey]  = useState('');
  const [manualTestOptions, setManualTestOptions] = useState([]);

  const [searchTerm,     setSearchTerm]     = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterCenter,   setFilterCenter]   = useState('ALL');
  const [filterStream,   setFilterStream]   = useState('ALL');

  const [marksSearch,  setMarksSearch]  = useState('');
  const [marksTestF,   setMarksTestF]   = useState('');
  const [marksCentreF, setMarksCentreF] = useState('');

  const [modalMode,    setModalMode]    = useState(null);
  const [modalStudent, setModalStudent] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  const [importMode,    setImportMode]    = useState(null);
  const [uploadPreview, setUploadPreview] = useState([]);
  const [uploadError,   setUploadError]   = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadTestKey, setUploadTestKey] = useState('');
  const fileRef = useRef(null);

  const [testInsights, setTestInsights] = useState(null);
  const [testInsightsLoading, setTestInsightsLoading] = useState(false);
  const [testInsightsError, setTestInsightsError] = useState('');
  
  // Trigger to refetch backend analytics
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const triggerRefresh = () => setRefreshTrigger((prev) => prev + 1);

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchGlobalData()
      .then((d) => {
        setData(d);
        const rankingCols = (d.testColumns || [])
          .filter((c) => !String(c).includes('_'))
          .sort((a, b) => String(b).localeCompare(String(a), undefined, { numeric: true, sensitivity: 'base' }));
        const candidate   = rankingCols.length ? rankingCols[0] : d.testColumns?.[0];
        if (candidate && !selectedTestKey) setSelectedTestKey(candidate);
      })
      .catch((err) => setError('Failed to load dashboard data: ' + err.message))
      .finally(() => setLoading(false));

    fetchOverview(null).then(setOverview).catch(() => null);
  }, [refreshTrigger]);

  // ── Reload backend analytics when test key changes or data refreshes ──

  useEffect(() => {
    if (!selectedTestKey) return;
    Promise.all([
      fetchRankings(null, { testKey: selectedTestKey, limit: 30, order: 'desc' }).catch(() => ({ ranked: [] })),
      fetchRankings(null, { testKey: selectedTestKey, limit: 30, order: 'asc'  }).catch(() => ({ ranked: [] })),
      fetchCentreLeaderboard(null, selectedTestKey).catch(() => []),
    ]).then(([top, bottom, board]) => {
      setTopRanked(top.ranked    || []);
      setBottomRanked(bottom.ranked || []);
      setCentreBoard(Array.isArray(board) ? board : []);
    });
  }, [selectedTestKey, refreshTrigger]);

  useEffect(() => {
    if (activePage !== 'insights' || !selectedTestKey) return undefined;
    let cancelled = false;
    setTestInsightsLoading(true);
    setTestInsightsError('');
    fetchTestInsights(null, selectedTestKey, null)
      .then((d) => {
        if (!cancelled) setTestInsights(d);
      })
      .catch((err) => {
        if (!cancelled) setTestInsightsError(err.message || 'Failed to load test analysis');
      })
      .finally(() => {
        if (!cancelled) setTestInsightsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activePage, selectedTestKey, refreshTrigger]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const rankingTestColumns = useMemo(
    () => (data?.testColumns || [])
      .filter((c) => !String(c).includes('_'))
      .sort((a, b) => String(b).localeCompare(String(a), undefined, { numeric: true, sensitivity: 'base' })),
    [data]
  );

  const allTestOptions = useMemo(
    () => [...new Set([...manualTestOptions, ...rankingTestColumns])]
      .sort((a, b) => String(b).localeCompare(String(a), undefined, { numeric: true, sensitivity: 'base' })),
    [manualTestOptions, rankingTestColumns]
  );

  const filteredStudents = useMemo(() => {
    if (!data) return [];
    const q = searchTerm.toLowerCase();
    return data.profiles.filter((p) => {
      const matchSearch  = !q || (p["STUDENT'S NAME"] || '').toLowerCase().includes(q) || (p.ROLL_KEY || '').toLowerCase().includes(q);
      const matchCat     = filterCategory === 'ALL' || p.CATEGORY   === filterCategory;
      const matchCenter  = filterCenter   === 'ALL' || p.centerCode === filterCenter;
      const matchStream  = filterStream   === 'ALL' || (p.stream || 'JEE') === filterStream;
      return matchSearch && matchCat && matchCenter && matchStream;
    });
  }, [data, searchTerm, filterCategory, filterCenter, filterStream]);

  const categories  = useMemo(() => ['ALL', ...[...new Set((data?.profiles || []).map((p) => p.CATEGORY).filter(Boolean))]], [data]);
  const centersList = useMemo(() => ['ALL', ...[...new Set((data?.profiles || []).map((p) => p.centerCode).filter(Boolean))]], [data]);

  // All unique subjects across test columns (for dynamic marks table header)
  const allSubjects = useMemo(() => {
    const seen = new Set();
    (data?.testColumns || []).forEach((col) => {
      const { subject, isTotal } = parseTestColumn(col);
      if (!isTotal && subject !== 'Total') seen.add(subject);
    });
    return Array.from(seen);
  }, [data]);

  const flatMarks = useMemo(
    () => buildMarksRows(data?.profiles || [], data?.tests || [], data?.testColumns || []),
    [data]
  );

  const filteredFlatMarks = useMemo(() => {
    const q = marksSearch.toLowerCase();
    return flatMarks.filter((m) => {
      const matchQ = !q || m.roll.toLowerCase().includes(q) || (m.name || '').toLowerCase().includes(q);
      const matchT = !marksTestF   || m.test   === marksTestF;
      const matchC = !marksCentreF || m.centre === marksCentreF;
      return matchQ && matchT && matchC;
    });
  }, [flatMarks, marksSearch, marksTestF, marksCentreF]);

  const uniqueMarkTests = useMemo(() => [...new Set(flatMarks.map((m) => m.test))].sort(), [flatMarks]);

  const handleAddNewTestOption = () => {
    const raw = window.prompt('Enter new test name (example: CAT-9(TEST))');
    const next = String(raw || '').trim();
    if (!next) return;
    const exists = allTestOptions.some((t) => String(t).toLowerCase() === next.toLowerCase());
    if (!exists) {
      setManualTestOptions((prev) => [...prev, next]);
      showToast(`Added test option: ${next}`, 'success');
    }
    setSelectedTestKey(next);
    setUploadTestKey(next);
  };

  const profileByRoll = useMemo(() => {
    const map = new Map();
    (data?.profiles || []).forEach((p) => map.set(p.ROLL_KEY, p));
    return map;
  }, [data]);

  // ── CRUD handlers ──────────────────────────────────────────────────────────

  const handleAddStudent = async (form) => {
    setModalLoading(true);
    try {
      const result = await addStudentApi(null, form);
      setData((d) => ({ ...d, profiles: [...d.profiles, result.student] }));
      triggerRefresh();
      setModalMode(null);
      showToast('Student added successfully.', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const handleEditStudent = async (form) => {
    setModalLoading(true);
    try {
      const result = await updateStudentApi(null, modalStudent.ROLL_KEY, form);
      setData((d) => ({ ...d, profiles: d.profiles.map((p) => p.ROLL_KEY === modalStudent.ROLL_KEY ? result.student : p) }));
      triggerRefresh();
      setModalMode(null);
      showToast('Student updated successfully.', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteStudent = async (rollKey, centerCode) => {
    if (!window.confirm(`Delete student ${rollKey}? This action cannot be undone.`)) return;
    try {
      await deleteStudentApi(null, rollKey, centerCode);
      setData((d) => ({
        ...d,
        profiles: d.profiles.filter((p) => p.ROLL_KEY !== rollKey),
        tests:    d.tests.filter((t)    => t.ROLL_KEY !== rollKey),
      }));
      triggerRefresh();
      showToast(`Student ${rollKey} deleted.`, 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleSaveTestScores = async (scores) => {
    setModalLoading(true);
    try {
      const result = await upsertTestScoresApi(null, modalStudent.ROLL_KEY, scores, modalStudent.centerCode);
      triggerRefresh();
      setModalMode(null);
      showToast('Test scores saved.', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setModalLoading(false);
    }
  };

  // ── Export helpers ─────────────────────────────────────────────────────────

  const downloadStudentTemplate = () => {
    const rows = [
      STUDENT_TEMPLATE_COLUMNS,
      ['GAIL001', 'Aarav Sharma', 'Male', 'General', '9876543210', '2006-03-15', 'Rajesh Sharma', '9876543200',
       'Civil Lines', 'Kanpur', 'UP', '208001', 'DPS', 'CBSE', 92.4, 'KV', 'CBSE', 89.1,
       'IIT Kanpur', 'Chemistry', 'https://example.com/photo.jpg', 'GAIL', 'JEE'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = STUDENT_TEMPLATE_COLUMNS.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students Template');
    XLSX.writeFile(wb, 'CSRL_Students_Template.xlsx');
  };

  const exportStudentsXlsx = () => {
    if (!data?.profiles?.length) { showToast('No students to export.', 'warning'); return; }
    const rows = data.profiles.map((s) => ({
      roll_number:         s.ROLL_KEY || '',
      name:                s["STUDENT'S NAME"] || '',
      stream:              s.stream || 'JEE',
      gender:              s.GENDER || '',
      category:            s.CATEGORY || '',
      mobile:              s['Mobile No.'] || '',
      dob:                 s['DATE OF BIRTH'] || '',
      parent_name:         s["FATHER'S NAME"] || '',
      address:             s['PARMANENT ADDRESS'] || '',
      district:            s.DISTRICT || '',
      state:               s.STATE || '',
      pincode:             s.PINCODE || '',
      school_10:           s['10th SCHOOL NAME'] || '',
      board_10:            s['10th BOARD'] || '',
      percentage_10:       s['10th Precentage'] || '',
      school_12:           s['12th SCHOOL NAME'] || '',
      board_12:            s['12th BOARD'] || '',
      percentage_12:       s['12th Precentage'] || '',
      future_college:      s['FUTURE COLLEGE (TARGET)'] || '',
      weak_subject_manual: s['WEAK SUBJECT (MANUAL)'] || '',
      student_photo_url:   s['STUDENT PHOTO URL'] || '',
      centre:              s.centerCode || '',
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Students');
    XLSX.writeFile(wb, 'CSRL_Students_Export.xlsx');
    showToast('Student data exported.', 'success');
  };

  const exportMarksXlsx = () => {
    if (!selectedTestKey) { showToast('Select a test column first.', 'warning'); return; }
    const rows = (data?.profiles || []).map((p) => {
      const scoreDoc = data.tests.find((t) => t.ROLL_KEY === p.ROLL_KEY) || {};
      return {
        roll_number: p.ROLL_KEY,
        name:        p["STUDENT'S NAME"] || '',
        stream:      p.stream || 'JEE',
        centre:      p.centerCode || '',
        test_key:    selectedTestKey,
        marks:       scoreDoc[selectedTestKey] ?? '',
      };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), `Marks_${selectedTestKey}`);
    XLSX.writeFile(wb, `CSRL_Marks_${selectedTestKey}.xlsx`);
    showToast('Marks exported.', 'success');
  };

  const exportCombinedWorkbook = () => {
    if (!data) return;
    const studentsRows = data.profiles.map((p) => ({
      roll_number:    p.ROLL_KEY,
      name:           p["STUDENT'S NAME"] || '',
      stream:         p.stream || 'JEE',
      centre:         p.centerCode || '',
      category:       p.CATEGORY || '',
      jee_percentile: p['JEE MAIN PERCENTILE'] || '',
    }));
    const marksRows = data.tests.map((t) => {
      const row = { roll_number: t.ROLL_KEY };
      (data.testColumns || []).forEach((col) => { row[col] = t[col] ?? ''; });
      return row;
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(studentsRows), 'Students');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(marksRows),    'Scores');
    XLSX.writeFile(wb, 'CSRL_Full_Data_Export.xlsx');
    showToast('Full workbook exported.', 'success');
  };

  // ── Import modal ────────────────────────────────────────────────────────────

  const resetImportState = () => {
    setUploadPreview([]); setUploadError(''); setUploadLoading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const openImportModal = (mode) => {
    setImportMode(mode);
    setUploadTestKey(selectedTestKey || allTestOptions[0] || '');
    resetImportState();
  };

  const closeImportModal = () => { setImportMode(null); resetImportState(); };

  const handleImportFile = async (file) => {
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setUploadError('Please upload an .xlsx, .xls, or .csv file.');
      return;
    }
    setUploadLoading(true); setUploadError('');
    try {
      const buffer = await file.arrayBuffer();
      const wb     = XLSX.read(buffer, { type: 'array' });
      const ws     = wb.Sheets[wb.SheetNames[0]];
      const rows   = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (!rows.length) { setUploadError('The file contains no data rows.'); setUploadPreview([]); return; }

      if (importMode === 'students') {
        const existingRolls = new Set((data?.profiles || []).map((p) => normalizeRollKey(p.ROLL_KEY)));
        setUploadPreview(rows.map((row, idx) => {
          const mapped = mapExcelStudentToProfile(row);
          if (!mapped.ROLL_KEY)             return { row: idx + 2, status: 'err', reason: 'Missing roll_number' };
          if (!mapped["STUDENT'S NAME"])    return { row: idx + 2, status: 'err', reason: 'Missing name',   roll: mapped.ROLL_KEY };
          if (!mapped.centerCode)           return { row: idx + 2, status: 'err', reason: 'Missing centre', roll: mapped.ROLL_KEY };
          const exists = existingRolls.has(mapped.ROLL_KEY);
          return { row: idx + 2, status: exists ? 'update' : 'new', reason: exists ? 'Will update' : 'Will insert', roll: mapped.ROLL_KEY, name: mapped["STUDENT'S NAME"], centre: mapped.centerCode, payload: mapped };
        }));
      } else {
        const existingRolls = new Set((data?.profiles || []).map((p) => normalizeRollKey(p.ROLL_KEY)));
        const existingMarks = new Set((data?.tests || []).filter((t) => t[uploadTestKey] !== undefined).map((t) => normalizeRollKey(t.ROLL_KEY)));
        setUploadPreview(rows.map((row, idx) => {
          const mapped = mapExcelMarkRow(row, uploadTestKey);
          if (!mapped.roll)                    return { row: idx + 2, status: 'err', reason: 'Missing roll_number' };
          if (!existingRolls.has(mapped.roll)) return { row: idx + 2, status: 'err', reason: 'Roll not found',    roll: mapped.roll };
          if (mapped.value === '')             return { row: idx + 2, status: 'err', reason: 'Missing marks',     roll: mapped.roll };
          const exists = existingMarks.has(mapped.roll);
          return { row: idx + 2, status: exists ? 'update' : 'new', reason: exists ? 'Will update score' : 'Will create score', roll: mapped.roll, marks: mapped.value, payload: mapped };
        }));
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
    if (!valid.length) { showToast('No valid rows to import.', 'warning'); return; }
    setUploadLoading(true);
    try {
      let newCount = 0, updateCount = 0;
      if (importMode === 'students') {
        for (const row of valid) {
          const rowRoll = normalizeRollKey(row.payload.ROLL_KEY);
          const rowCenter = normalizeCenterCode(row.payload.centerCode);
          const exists = data.profiles.find(
            (p) => normalizeRollKey(p.ROLL_KEY) === rowRoll && normalizeCenterCode(p.centerCode) === rowCenter
          );
          if (exists) { await updateStudentApi(null, row.payload.ROLL_KEY, row.payload); updateCount++; }
          else        { await addStudentApi(null, row.payload); newCount++; }
        }
        triggerRefresh();
        showToast(`Students imported: ${newCount} new, ${updateCount} updated.`, 'success');
      } else {
        for (const row of valid) {
          const rowRoll = normalizeRollKey(row.payload.roll);
          const existing = data.tests.find((t) => normalizeRollKey(t.ROLL_KEY) === rowRoll);
          const profile = data.profiles.find((p) => normalizeRollKey(p.ROLL_KEY) === rowRoll);
          const prev       = existing?.[uploadTestKey];
          await upsertTestScoresApi(null, rowRoll, { [uploadTestKey]: row.payload.value }, profile?.centerCode);
          if (prev === undefined || prev === null || prev === '') newCount++;
          else updateCount++;
        }
        triggerRefresh();
        showToast(`Marks imported: ${newCount} new, ${updateCount} updated.`, 'success');
      }
      closeImportModal();
    } catch (e) {
      showToast('Import failed: ' + e.message, 'error');
    } finally {
      setUploadLoading(false);
    }
  };

  // ── Render states ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="fade-in dashboard-page" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, color: 'var(--gray-400)' }}>
          <Loader2 size={36} className="spin" />
          <p style={{ fontWeight: 600 }}>Aggregating all centre data…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fade-in dashboard-page" style={{ justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--red)' }}>
          <AlertTriangle size={20} />{error}
        </div>
      </div>
    );
  }

  if (viewingStudentId) {
    const profile      = data.profiles.find((p) => p.ROLL_KEY === viewingStudentId);
    const studentTests = data.tests.find((t) => t.ROLL_KEY === viewingStudentId) || {};
    return (
      <div className="fade-in dashboard-page">
        <div className="page-header">
          <button type="button" onClick={() => setViewingStudentId(null)} className="btn btn-sm" style={{ background: 'rgba(255,255,255,.15)', color: '#fff', border: 'none', marginRight: 8, gap: 5 }}>
            <ArrowLeft size={14} /> Back
          </button>
          <div>
            <h1>Student Profile</h1>
            <p>{profile?.["STUDENT'S NAME"]} · {viewingStudentId}</p>
          </div>
        </div>
        <div className="content dashboard-page-body">
          <div className="dashboard-scroll">
            <StudentProfileView profile={profile} studentTests={studentTests} testColumns={data.testColumns} />
          </div>
        </div>
      </div>
    );
  }

  // ── Section components ─────────────────────────────────────────────────────

  const OverviewSection = () => {
    const totalStudents  = overview?.totalStudents ?? data.profiles.length;
    const weakSubject    = overview?.weakSubject   ?? 'N/A';
    const jeeCount       = data.profiles.filter((p) => (p.stream || 'JEE') === 'JEE').length;
    const neetCount      = data.profiles.filter((p) => p.stream === 'NEET').length;

    const statCards = [
      { Icon: Users,         value: totalStudents,                      label: 'Total Students',     bg: '#e8f0fc', color: '#1a4fa0' },
      { Icon: Building2,     value: Math.max(0, centersList.length - 1), label: 'Active Centres',    bg: '#fff3e0', color: '#b45309' },
      { Icon: FileText,      value: data?.tests?.length || 0,           label: 'Marks Entries',      bg: '#e6f5ed', color: '#1a6e3b' },
      { Icon: AlertTriangle, value: weakSubject,                        label: 'Global Weak Subject', bg: '#fdecea', color: '#c0392b' },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="grid-4">
          {statCards.map((card) => {
            const CardIcon = card.Icon;
            return (
              <div className="stat-card" key={card.label}>
                <div className="stat-icon" style={{ background: card.bg }}>
                  <CardIcon size={20} color={card.color} aria-hidden="true" />
                </div>
                <div>
                  <div className="stat-val" style={{ color: card.color }}>{card.value}</div>
                  <div className="stat-lbl">{card.label}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid-2">
          <div className="card">
            <div className="section-title">
              <Trophy size={15} style={{ marginRight: 6 }} aria-hidden="true" />
              Top Centres — {selectedTestKey}
            </div>
            <CentreLeaderboard centreStats={centreBoard} selTest={selectedTestKey} />
          </div>
          <div className="card">
            <div className="section-title">Category & Stream Distribution</div>
            {['General', 'OBC', 'SC', 'ST'].map((cat) => {
              const count = data.profiles.filter((s) => s.CATEGORY === cat).length;
              if (!count) return null;
              return (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11 }}>
                  <span className={`badge badge-${cat.toLowerCase()}`} style={{ minWidth: 68, textAlign: 'center' }}>{cat}</span>
                  <div style={{ flex: 1 }}>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${pctBar(count, totalStudents || 1)}%`, background: '#1a4fa0' }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, minWidth: 22, textAlign: 'right' }}>{count}</span>
                </div>
              );
            })}
            <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--gray-100)', display: 'flex', gap: 10 }}>
              <div style={{ flex: 1, background: '#e8f0fc', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#1a4fa0' }}>{jeeCount}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>JEE</div>
              </div>
              <div style={{ flex: 1, background: '#e6f5ed', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#1a6e3b' }}>{neetCount}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>NEET</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const LeaderboardSection = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 800, color: 'var(--gray-800)' }}>
            <Trophy size={18} aria-hidden="true" />Centre Rankings — {selectedTestKey}
          </div>
          <div style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 2 }}>Sorted descending by average score</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--gray-600)' }}>Test:</span>
          <select className="input select" value={selectedTestKey} onChange={(e) => setSelectedTestKey(e.target.value)} style={{ width: 170, fontSize: 13 }}>
            {allTestOptions.map((col) => <option key={col} value={col}>{col}</option>)}
          </select>
          <button type="button" className="btn btn-sm btn-outline" onClick={handleAddNewTestOption}>+ New Test</button>
        </div>
      </div>
      <CentreLeaderboard centreStats={centreBoard} selTest={selectedTestKey} />
    </div>
  );

  const RankingsSection = () => (
    <div className="grid-2">
      <Top30Section />
      <Bottom30Section />
    </div>
  );

  const StudentsSection = () => (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Users size={15} aria-hidden="true" />Students ({filteredStudents.length})
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-purple btn-sm" onClick={() => openImportModal('students')}>
            <Upload size={13} /> Bulk Upload
          </button>
          <button type="button" className="btn btn-success btn-sm" onClick={() => { setModalStudent(null); setModalMode('add'); }}>
            <Plus size={13} /> Add Student
          </button>
        </div>
      </div>
      <div className="search-row">
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', pointerEvents: 'none' }} />
          <input className="input" placeholder="Name or roll…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ maxWidth: 240, paddingLeft: 30 }} />
        </div>
        <select className="input select" value={filterCenter}   onChange={(e) => setFilterCenter(e.target.value)}   style={{ maxWidth: 200 }}>
          <option value="ALL">All Centres</option>
          {centersList.filter((c) => c !== 'ALL').map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input select" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={{ maxWidth: 150 }}>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input select" value={filterStream}   onChange={(e) => setFilterStream(e.target.value)}   style={{ maxWidth: 120 }}>
          <option value="ALL">All Streams</option>
          <option value="JEE">JEE</option>
          <option value="NEET">NEET</option>
        </select>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Roll</th><th>Name</th><th>Centre</th><th>Stream</th><th>Category</th><th>Mobile</th><th>Class 10</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {filteredStudents.map((s) => (
              <tr key={s.ROLL_KEY}>
                <td><strong style={{ color: '#1a4fa0' }}>{s.ROLL_KEY}</strong></td>
                <td>
                  <div className="student-row">
                    <div className="avatar">{getInitials(s["STUDENT'S NAME"])}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{s["STUDENT'S NAME"]}</div>
                      <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{s.GENDER || '—'}</div>
                    </div>
                  </div>
                </td>
                <td><span className="badge" style={{ background: '#e8f0fc', color: '#1a4fa0' }}>{s.centerCode}</span></td>
                <td>
                  <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 3, background: s.stream === 'NEET' ? '#e6f5ed' : '#e8f0fc', color: s.stream === 'NEET' ? '#1a6e3b' : '#1a4fa0', fontWeight: 700 }}>
                    {s.stream || 'JEE'}
                  </span>
                </td>
                <td><span className={`badge badge-${(s.CATEGORY || 'general').toLowerCase()}`}>{s.CATEGORY || 'General'}</span></td>
                <td style={{ fontSize: 13, color: 'var(--gray-600)' }}>{s['Mobile No.'] || '—'}</td>
                <td>{s['10th Precentage'] ? `${s['10th Precentage']}%` : '—'}</td>
                <td>
                  <div className="action-btns">
                    <button type="button" className="btn btn-primary btn-sm" aria-label="View student profile" onClick={() => setViewingStudentId(s.ROLL_KEY)}>
                      <Eye size={13} />
                    </button>
                    <button type="button" className="btn btn-warning btn-sm" aria-label="Edit student" onClick={() => { setModalStudent(s); setModalMode('edit'); }}>
                      <Pencil size={13} />
                    </button>
                    <button type="button" className="btn btn-outline btn-sm" aria-label="Edit test scores" onClick={() => { setModalStudent(s); setModalMode('tests'); }}>
                      <FileText size={13} />
                    </button>
                    <button type="button" className="btn btn-danger btn-sm" aria-label="Delete student" onClick={() => handleDeleteStudent(s.ROLL_KEY, s.centerCode)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!filteredStudents.length && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--gray-400)' }}>No students found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const MarksSection = () => (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileText size={15} aria-hidden="true" />Test Marks ({filteredFlatMarks.length})
        </div>
        <button type="button" className="btn btn-teal btn-sm" onClick={() => openImportModal('marks')}>
          <Upload size={13} /> Bulk Upload
        </button>
      </div>
      <div className="search-row">
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', pointerEvents: 'none' }} />
          <input className="input" placeholder="Roll or name…" value={marksSearch} onChange={(e) => setMarksSearch(e.target.value)} style={{ maxWidth: 220, paddingLeft: 30 }} />
        </div>
        <select className="input select" value={marksTestF}   onChange={(e) => setMarksTestF(e.target.value)}   style={{ maxWidth: 220 }}>
          <option value="">All Tests</option>
          {uniqueMarkTests.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="input select" value={marksCentreF} onChange={(e) => setMarksCentreF(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="">All Centres</option>
          {centersList.filter((c) => c !== 'ALL').map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Roll</th><th>Name</th><th>Centre</th><th>Stream</th><th>Test</th>
              {allSubjects.map((s) => <th key={s}>{s}</th>)}
              <th>Total</th><th>%</th>
            </tr>
          </thead>
          <tbody>
            {filteredFlatMarks.map((m) => {
              const maxTotal = getStreamConfig(m.stream).maxTotal;
              const pct      = m.total ? Math.round((m.total / maxTotal) * 100) : 0;
              return (
                <tr key={`${m.roll}-${m.test}`}>
                  <td><strong style={{ color: '#1a4fa0' }}>{m.roll}</strong></td>
                  <td style={{ fontWeight: 500, fontSize: 13 }}>{m.name || '—'}</td>
                  <td><span className="badge" style={{ background: '#e8f0fc', color: '#1a4fa0', fontSize: 11 }}>{m.centre || '—'}</span></td>
                  <td>
                    <span style={{ fontSize: 11, padding: '2px 5px', borderRadius: 3, background: m.stream === 'NEET' ? '#e6f5ed' : '#e8f0fc', color: m.stream === 'NEET' ? '#1a6e3b' : '#1a4fa0', fontWeight: 700 }}>
                      {m.stream}
                    </span>
                  </td>
                  <td><strong style={{ color: 'var(--csrl-orange)' }}>{m.test}</strong></td>
                  {allSubjects.map((sub) => (
                    <td key={sub} style={{ color: m.subjects[sub] === undefined ? 'var(--gray-200)' : 'inherit' }}>
                      {m.subjects[sub] ?? '—'}
                    </td>
                  ))}
                  <td><strong style={{ color: '#1a4fa0' }}>{m.total}</strong></td>
                  <td><span className={`chip ${pct >= 60 ? 'chip-good' : 'chip-weak'}`}>{pct}%</span></td>
                </tr>
              );
            })}
            {!filteredFlatMarks.length && (
              <tr><td colSpan={allSubjects.length + 7} style={{ textAlign: 'center', padding: 24, color: 'var(--gray-400)' }}>No marks found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const Top30Section = () => (
    <div className="card">
      <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <TrendingUp size={15} aria-hidden="true" />Top 30 — {selectedTestKey}
      </div>
      <div className="table-wrap">
      <table className="table">
        <thead><tr><th>#</th><th>Student</th><th>Centre</th><th>Stream</th><th>Cat</th><th>Score</th></tr></thead>
        <tbody>
          {topRanked.map((m) => {
            const profile   = profileByRoll.get(m.roll);
            const rankColor = m.rank === 1 ? '#d97706' : m.rank === 2 ? '#6b7280' : m.rank === 3 ? '#c2410c' : 'inherit';
            return (
              <tr key={m.roll} style={{ cursor: 'pointer' }} onClick={() => setViewingStudentId(m.roll)}>
                <td><span style={{ fontWeight: 800, color: rankColor }}>{m.rank}</span></td>
                <td>
                  <div className="student-row">
                    <div className="avatar">{getInitials(m.name)}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{m.roll}</div>
                    </div>
                  </div>
                </td>
                <td><span className="badge" style={{ background: '#e8f0fc', color: '#1a4fa0' }}>{m.center}</span></td>
                <td>
                  <span style={{ fontSize: 11, padding: '2px 5px', borderRadius: 3, background: m.stream === 'NEET' ? '#e6f5ed' : '#e8f0fc', color: m.stream === 'NEET' ? '#1a6e3b' : '#1a4fa0', fontWeight: 700 }}>
                    {m.stream || 'JEE'}
                  </span>
                </td>
                <td><span className={`badge badge-${(profile?.CATEGORY || 'general').toLowerCase()}`}>{profile?.CATEGORY || '—'}</span></td>
                <td><strong style={{ fontSize: 15, color: '#1a4fa0' }}>{m.marks}</strong></td>
              </tr>
            );
          })}
          {!topRanked.length && (
            <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--gray-400)' }}>No data for {selectedTestKey}.</td></tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );

  const Bottom30Section = () => (
    <div className="card">
      <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <TrendingDown size={15} aria-hidden="true" />Bottom 30 — {selectedTestKey}
      </div>
      <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Rank</th><th>Student</th><th>Centre</th><th>Score</th></tr></thead>
        <tbody>
          {bottomRanked.map((m) => (
            <tr key={m.roll} style={{ cursor: 'pointer' }} onClick={() => setViewingStudentId(m.roll)}>
              <td style={{ color: 'var(--red)', fontWeight: 700 }}>#{m.rank}</td>
              <td>
                <div className="student-row">
                  <div className="avatar" style={{ background: '#fdecea', color: 'var(--red)' }}>{getInitials(m.name)}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{m.roll}</div>
                  </div>
                </div>
              </td>
              <td>{m.center}</td>
              <td><strong style={{ color: 'var(--red)' }}>{m.marks}</strong></td>
            </tr>
          ))}
          {!bottomRanked.length && (
            <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--gray-400)' }}>No data for {selectedTestKey}.</td></tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );

  const ImportExportSection = () => (
    <div className="grid-2">
      <div className="card" style={{ border: '2px solid #6d28d9' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
          <div style={{ padding: 10, borderRadius: 10, background: '#ede9fe', flexShrink: 0 }}>
            <Users size={22} color="#6d28d9" aria-hidden="true" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Import Student Profiles</div>
            <div style={{ fontSize: 13, color: 'var(--gray-600)', marginTop: 4 }}>Bulk-add or update student profiles from Excel. Supports JEE and NEET streams.</div>
          </div>
        </div>
        <div style={{ background: 'var(--gray-50)', borderRadius: 8, padding: '12px 14px', marginBottom: 14, fontSize: 13 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Required columns:</div>
          <div style={{ color: 'var(--gray-600)', fontFamily: 'monospace', fontSize: 11, lineHeight: 1.8 }}>
            {STUDENT_TEMPLATE_COLUMNS.slice(0, 8).join(' · ')}<br />
            {STUDENT_TEMPLATE_COLUMNS.slice(8).join(' · ')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={downloadStudentTemplate}><Download size={13} /> Download Template</button>
          <button type="button" className="btn btn-purple" onClick={() => openImportModal('students')}><Upload size={13} /> Upload Excel</button>
          <button type="button" className="btn btn-success btn-sm" onClick={exportStudentsXlsx}><Download size={13} /> Export</button>
        </div>
      </div>

      <div className="card" style={{ border: '2px solid #0f766e' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
          <div style={{ padding: 10, borderRadius: 10, background: '#ccfbf1', flexShrink: 0 }}>
            <BarChart2 size={22} color="#0f766e" aria-hidden="true" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Import Test Marks</div>
            <div style={{ fontSize: 13, color: 'var(--gray-600)', marginTop: 4 }}>Upload test-wise marks — select test column, upload, preview and confirm.</div>
          </div>
        </div>
        <div style={{ background: 'var(--gray-50)', borderRadius: 8, padding: '12px 14px', marginBottom: 14, fontSize: 13 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Marks import:</div>
          <div style={{ color: 'var(--gray-600)', fontFamily: 'monospace', fontSize: 11 }}>roll_number · marks/score</div>
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--gray-400)' }}>One column at a time (selected test).</div>
          <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {allTestOptions.slice(0, 8).map((t) => (
              <button key={t} type="button" className="btn btn-ghost btn-sm" onClick={() => { setSelectedTestKey(t); setUploadTestKey(t); }}>{t}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-teal" onClick={() => openImportModal('marks')}><Upload size={13} /> Upload Marks</button>
          <button type="button" className="btn btn-outline btn-sm" onClick={exportMarksXlsx}><Download size={13} /> Export selected test</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={exportCombinedWorkbook}><Package size={13} /> Full workbook</button>
        </div>
      </div>

      <div className="card" style={{ gridColumn: '1 / -1', background: 'var(--yellow-bg)', border: '1px solid #fde68a' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <Lightbulb size={22} color="#92400e" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13, color: '#92400e' }}>
            <strong>Tips for a smooth import:</strong>
            <ul style={{ marginTop: 6, paddingLeft: 18, lineHeight: 1.9 }}>
              <li>Keep the first row as column headers.</li>
              <li>Roll numbers must match exactly for record updates.</li>
              <li>Add a <code>stream</code> column with "JEE" or "NEET" for mixed batches.</li>
              <li>For marks: use one Excel file per test column.</li>
              <li>A preview will appear before any data is written.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <div className="fade-in dashboard-page">
      {/* Modals */}
      {(modalMode === 'add' || modalMode === 'edit') && (
        <StudentFormModal mode={modalMode} student={modalStudent} loading={modalLoading} onClose={() => setModalMode(null)} onSubmit={modalMode === 'add' ? handleAddStudent : handleEditStudent} />
      )}
      {modalMode === 'tests' && (
        <TestDataModal
          student={modalStudent}
          testColumns={data.testColumns}
          existingScores={data.tests.find((t) => t.ROLL_KEY === modalStudent?.ROLL_KEY) || {}}
          loading={modalLoading}
          onClose={() => setModalMode(null)}
          onSubmit={handleSaveTestScores}
        />
      )}

      {importMode && (
        <div className="modal-overlay" onClick={closeImportModal}>
          <div className="modal" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Upload size={16} aria-hidden="true" />
                {importMode === 'students' ? 'Import Student Profiles' : 'Import Test Marks'}
              </div>
              <button type="button" className="modal-close" onClick={closeImportModal} aria-label="Close">×</button>
            </div>
            <div className="modal-body">
              {importMode === 'marks' && (
                <div className="form-group">
                  <label className="label" htmlFor="importTestKey">Test Column</label>
                  <select id="importTestKey" className="input select" value={uploadTestKey} onChange={(e) => setUploadTestKey(e.target.value)}>
                    {allTestOptions.map((col) => <option key={col} value={col}>{col}</option>)}
                  </select>
                </div>
              )}
              <div className="upload-zone" role="button" tabIndex={0} onClick={() => fileRef.current?.click()} onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}>
                <Upload size={32} style={{ margin: '0 auto 10px', color: 'var(--gray-400)' }} aria-hidden="true" />
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Click to upload Excel / CSV</div>
                <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>
                  {importMode === 'students' ? 'Use the template headers for best column mapping.' : 'File must contain roll_number and a marks/score column.'}
                </div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={(e) => handleImportFile(e.target.files?.[0])} />
              </div>
              {importMode === 'students' && (
                <div style={{ marginTop: 10 }}>
                  <button type="button" className="btn btn-outline btn-sm" onClick={downloadStudentTemplate}><Download size={13} /> Download Student Template</button>
                </div>
              )}
              {uploadLoading && <div style={{ marginTop: 12, color: 'var(--csrl-blue)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}><Loader2 size={14} className="spin" /> Processing file…</div>}
              {uploadError  && <div style={{ marginTop: 12, background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 6, padding: '10px 12px', fontSize: 13 }}>{uploadError}</div>}
              {!!uploadPreview.length && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                    <span className="pill-new">New: {uploadPreview.filter((r) => r.status === 'new').length}</span>
                    <span className="pill-update">Update: {uploadPreview.filter((r) => r.status === 'update').length}</span>
                    <span className="pill-err">Errors: {uploadPreview.filter((r) => r.status === 'err').length}</span>
                  </div>
                  <div className="preview-wrap">
                    <table className="preview-table">
                      <thead><tr><th>Row</th><th>Roll</th><th>{importMode === 'students' ? 'Name' : 'Marks'}</th><th>Status</th></tr></thead>
                      <tbody>
                        {uploadPreview.map((row, idx) => (
                          <tr key={idx}>
                            <td>{row.row}</td>
                            <td>{row.roll || '—'}</td>
                            <td>{importMode === 'students' ? (row.name || '—') : (row.marks ?? '—')}</td>
                            <td><span className={row.status === 'new' ? 'pill-new' : row.status === 'update' ? 'pill-update' : 'pill-err'}>{row.reason}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={closeImportModal}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={uploadLoading || !uploadPreview.length} onClick={confirmImport} style={{ gap: 6 }}>
                <CheckCircle2 size={14} /> Confirm Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="page-header">
        <div style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,.15)', flexShrink: 0 }}>
          <ShieldCheck size={24} color="#fff" aria-hidden="true" />
        </div>
        <div>
          <h1>CSRL Admin Dashboard</h1>
          <p>Super Admin · Full Control Panel</p>
        </div>
        <div className="page-header-toolbar" style={{ marginLeft: 'auto' }}>
          <button type="button" className="btn btn-success btn-sm" onClick={() => { setModalStudent(null); setModalMode('add'); }}>
            <Plus size={13} /> Student
          </button>
          <button type="button" className="btn btn-warning btn-sm" onClick={() => openImportModal('marks')}><Upload size={13} /> Marks</button>
          <button type="button" className="btn btn-purple btn-sm" onClick={() => openImportModal('students')}><Users size={13} /> Upload Students</button>
          <button type="button" className="btn btn-outline btn-sm" onClick={handleAddNewTestOption}>+ New Test</button>
          <select
            className="input select"
            value={selectedTestKey}
            onChange={(e) => setSelectedTestKey(e.target.value)}
            style={{ background: 'rgba(255,255,255,.15)', color: '#fff', borderColor: 'rgba(255,255,255,.3)', width: 148, fontSize: 13 }}
          >
            {allTestOptions.map((t) => <option key={t} value={t} style={{ color: '#333' }}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs + scrollable body (lists scroll here, not the whole window) */}
      <div className="content dashboard-page-body">
        <div style={{ marginBottom: 16, flexShrink: 0 }}>
          <div className="tab-bar">
            {TABS.map((tab) => {
              const TabIcon = tab.Icon;
              return (
                <button key={tab.key} type="button" className={`tab${activePage === tab.key ? ' active' : ''}`} onClick={() => setActivePage(tab.key)}>
                  <TabIcon size={13} aria-hidden="true" />{tab.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="dashboard-scroll">
          {activePage === 'leaderboard' && <LeaderboardSection />}
          {activePage === 'overview'    && <OverviewSection />}
          {activePage === 'students'    && <StudentsSection />}
          {activePage === 'marks'       && <MarksSection />}
          {activePage === 'import'      && <ImportExportSection />}
          {activePage === 'ranking'     && <RankingsSection />}
          {activePage === 'insights' && (
            <TestInsightsPanel
              insights={testInsights}
              loading={testInsightsLoading}
              error={testInsightsError}
              testKey={selectedTestKey}
              hideSubjectAverages
            />
          )}
        </div>
      </div>
    </div>
  );
}
