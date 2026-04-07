// ============================================================
// CSRL Data Service
//
// Architecture:
//   - Raw data (profiles, tests) read directly from Firestore SDK
//   - Analytics (rankings, weak subjects, centre leaderboard)
//     computed on the backend and fetched via REST API
//   - Firestore testScores docs use the NESTED format:
//       { ROLL_KEY, centerCode, stream, tests: { "CAT-1(TEST)": { Physics: 45, total: 145 } } }
//     which is flattened here to the standard flat format for rendering.
//
// Streams:
//   JEE  — subjects: Physics, Chemistry, Math
//   NEET — subjects: Physics, Chemistry, Biology
// ============================================================

import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../config/firebase';

// ── Stream / Subject constants ─────────────────────────────────────────────────

export const STREAMS = {
  JEE:  { label: 'JEE',  subjects: ['Physics', 'Chemistry', 'Math'],    maxPerSubject: 60, maxTotal: 180 },
  NEET: { label: 'NEET', subjects: ['Physics', 'Chemistry', 'Biology'],  maxPerSubject: 60, maxTotal: 180 },
};

export function getStreamConfig(stream) {
  return STREAMS[stream] || STREAMS.JEE;
}

const SUBJECT_ALIASES = {
  PHY: 'Physics',
  CHE: 'Chemistry',
  MAT: 'Math',
  BIO: 'Biology',
  BOT: 'Botany',
  ZOO: 'Zoology',
};

// ── Column parsing ─────────────────────────────────────────────────────────────

export function parseTestColumn(col) {
  const raw = String(col || '').trim();

  // New format: CAT-1(TEST)_Physics
  const underscored = raw.match(/^(.+)_([^_]+)$/);
  if (underscored) {
    return {
      testName: underscored[1].trim(),
      subject:  underscored[2].trim(),
      isTotal:  false,
    };
  }

  // Legacy format: PHY Test 1
  const parts = raw.split(/\s+/);
  if (parts.length > 1) {
    const token = (parts[0] || '').toUpperCase();
    if (SUBJECT_ALIASES[token]) {
      return {
        testName: parts.slice(1).join(' '),
        subject:  SUBJECT_ALIASES[token],
        isTotal:  false,
      };
    }
  }

  // Total column: CAT-1(TEST)
  return { testName: raw, subject: 'Total', isTotal: true };
}

// ── Nested → Flat Firestore doc conversion ─────────────────────────────────────

/**
 * Convert a nested Firestore testScores doc → flat in-memory record.
 * Nested:  { ROLL_KEY, centerCode, stream, tests: { "CAT-1": { Physics: 45, total: 145 } } }
 * Flat:    { ROLL_KEY, centerCode, stream, "CAT-1": 145, "CAT-1_Physics": 45 }
 */
function flattenTestDoc(doc) {
  if (!doc) return {};
  if (!doc.tests || typeof doc.tests !== 'object') return doc; // already flat or empty

  const flat = {
    ROLL_KEY:   doc.ROLL_KEY   || '',
    centerCode: doc.centerCode || '',
    stream:     doc.stream     || 'JEE',
  };

  for (const [testName, testData] of Object.entries(doc.tests)) {
    if (!testData || typeof testData !== 'object') continue;
    for (const [key, value] of Object.entries(testData)) {
      if (value === undefined || value === null) continue;
      if (key === 'total') {
        flat[testName] = value;
      } else {
        flat[`${testName}_${key}`] = value;
      }
    }
  }

  return flat;
}

/**
 * Extract all test column names from a nested tests map.
 */
function extractColumnsFromDoc(testsMap) {
  const cols = new Set();
  for (const [testName, testData] of Object.entries(testsMap || {})) {
    if (!testData || typeof testData !== 'object') continue;
    cols.add(testName);
    for (const subject of Object.keys(testData)) {
      if (subject !== 'total') cols.add(`${testName}_${subject}`);
    }
  }
  return Array.from(cols);
}

/** Derive test columns from an array of flat test records. */
function extractTestColumns(testDocs) {
  const EXCLUDED = new Set([
    'ROLL', 'ROLL_KEY', 'ROLL NO.', 'ROLL NO', 'ROLL_NUMBER', 'ROLL NUMBER',
    "STUDENT'S NAME", 'STUDENT NAME', 'NAME', 'CENTER', 'CENTRE', 'CENTERCODE',
    'centerCode', 'stream',
  ]);
  const all = new Set();
  testDocs.forEach((t) => {
    Object.keys(t).forEach((k) => {
      if (!EXCLUDED.has(k) && !EXCLUDED.has(String(k).trim().toUpperCase())) all.add(k);
    });
  });
  return Array.from(all);
}

// ── Backend API helper ─────────────────────────────────────────────────────────

const BACKEND = ''; // Vite proxies /api → localhost:5000

async function apiFetch(path, token) {
  // Get Firebase ID token if no explicit token provided
  let authToken = token;
  if (!authToken) {
    try {
      const auth = getAuth();
      authToken  = auth.currentUser ? await auth.currentUser.getIdToken() : null;
    } catch {
      // Fall through without auth header
    }
  }

  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const res = await fetch(`${BACKEND}${path}`, { headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `API ${path} failed (${res.status})`);
  }
  return res.json();
}

// ── Data-fetching (Firestore SDK) ──────────────────────────────────────────────

/**
 * fetchGlobalData() — admin only.
 * Reads all students + test scores, flattens nested test docs.
 */
export async function fetchGlobalData() {
  const [profilesSnap, testsSnap] = await Promise.all([
    getDocs(collection(db, 'students')),
    getDocs(collection(db, 'testScores')),
  ]);

  const profiles = profilesSnap.docs.map((d) => d.data());
  const rawTests = testsSnap.docs.map((d) => ({ ...d.data(), _docId: d.id }));

  const testColumnsSet = new Set();
  const tests = rawTests.map((raw) => {
    const flat = flattenTestDoc(raw);
    // Collect columns from nested structure if available
    if (raw.tests) {
      extractColumnsFromDoc(raw.tests).forEach((c) => testColumnsSet.add(c));
    } else {
      // Legacy flat doc
      extractTestColumns([flat]).forEach((c) => testColumnsSet.add(c));
    }
    return flat;
  });

  const testColumns = testColumnsSet.size > 0
    ? Array.from(testColumnsSet)
    : extractTestColumns(tests);

  return { profiles, tests, testColumns };
}

/**
 * fetchCenterDataApi(token, centreCode) — centre login.
 */
export async function fetchCenterDataApi(_token, centreCode) {
  if (!centreCode) throw new Error('centreCode is required');

  const [profilesSnap, testsSnap] = await Promise.all([
    getDocs(query(collection(db, 'students'), where('centerCode', '==', centreCode))),
    getDocs(collection(db, 'testScores')),
  ]);

  const profiles  = profilesSnap.docs.map((d) => d.data());
  const rollKeys  = new Set(profiles.map((p) => p.ROLL_KEY));

  const testColumnsSet = new Set();
  const tests = testsSnap.docs
    .map((d) => {
      const raw  = d.data();
      const flat = flattenTestDoc(raw);
      if (raw.tests) {
        extractColumnsFromDoc(raw.tests).forEach((c) => testColumnsSet.add(c));
      } else {
        extractTestColumns([flat]).forEach((c) => testColumnsSet.add(c));
      }
      return flat;
    })
    .filter((t) => rollKeys.has(t.ROLL_KEY));

  const testColumns = testColumnsSet.size > 0
    ? Array.from(testColumnsSet)
    : extractTestColumns(tests);

  return { profiles, tests, testColumns };
}

/**
 * fetchStudentData(token, rollKey) — student login.
 */
export async function fetchStudentData(_token, rollKey) {
  if (!rollKey) throw new Error('rollKey is required');

  const [profileSnap, testSnap] = await Promise.all([
    getDoc(doc(db, 'students',    rollKey)),
    getDoc(doc(db, 'testScores',  rollKey)),
  ]);

  const profile = profileSnap.exists() ? profileSnap.data() : null;
  const rawTest = testSnap.exists()    ? testSnap.data()     : null;
  const flat    = rawTest ? flattenTestDoc(rawTest) : {};

  const testColumnsSet = new Set();
  if (rawTest?.tests) {
    extractColumnsFromDoc(rawTest.tests).forEach((c) => testColumnsSet.add(c));
  } else if (flat) {
    extractTestColumns([flat]).forEach((c) => testColumnsSet.add(c));
  }

  return {
    profiles:    profile  ? [profile] : [],
    tests:       flat     ? [flat]    : [],
    testColumns: Array.from(testColumnsSet),
  };
}

// ── CRUD API (admin, Firestore SDK) ───────────────────────────────────────────

export async function addStudentApi(_token, studentData) {
  const rollKey = studentData.ROLL_KEY;
  if (!rollKey) throw new Error('ROLL_KEY is required');

  const ref  = doc(db, 'students', rollKey);
  const snap = await getDoc(ref);
  if (snap.exists()) throw new Error(`Student ${rollKey} already exists`);

  const data = { stream: 'JEE', ...studentData };
  await setDoc(ref, data);
  return { success: true, student: data };
}

export async function updateStudentApi(_token, rollKey, studentData) {
  const ref = doc(db, 'students', rollKey);
  await updateDoc(ref, { ...studentData, ROLL_KEY: rollKey });
  const updated = (await getDoc(ref)).data();
  return { success: true, student: updated };
}

export async function deleteStudentApi(_token, rollKey) {
  await Promise.all([
    deleteDoc(doc(db, 'students',   rollKey)),
    deleteDoc(doc(db, 'testScores', rollKey)),
  ]);
  return { success: true };
}

/**
 * Upsert test scores — stores in nested format.
 * scores: flat object { "CAT-1(TEST)_Physics": 45, "CAT-1(TEST)": 145, ... }
 *         OR nested  { tests: { "CAT-1(TEST)": { Physics: 45, total: 145 } } }
 */
export async function upsertTestScoresApi(_token, rollKey, scores) {
  const ref  = doc(db, 'testScores', rollKey);
  const snap = await getDoc(ref);

  // Build the nested base document
  let base;
  if (snap.exists()) {
    const existing = snap.data();
    base = existing.tests ? { ...existing } : _legacyFlatToNested(existing);
  } else {
    base = { ROLL_KEY: rollKey, tests: {} };
  }

  // Merge incoming scores into the nested structure
  if (scores && typeof scores.tests === 'object') {
    // Already nested patch
    for (const [testName, testData] of Object.entries(scores.tests)) {
      if (!base.tests[testName]) base.tests[testName] = {};
      Object.assign(base.tests[testName], testData);
    }
  } else {
    // Flat format — convert and merge
    const patch = _legacyFlatToNested({ ROLL_KEY: rollKey, ...scores });
    for (const [testName, testData] of Object.entries(patch.tests)) {
      if (!base.tests[testName]) base.tests[testName] = {};
      Object.assign(base.tests[testName], testData);
    }
  }

  await setDoc(ref, base, { merge: false });
  const flat = flattenTestDoc(base);
  return { success: true, testRecord: flat };
}

/** Internal: convert legacy flat Firestore doc to nested format. */
function _legacyFlatToNested(flatRecord) {
  const { ROLL_KEY, centerCode, stream, ...scoreFields } = flatRecord;
  const result = { ROLL_KEY: ROLL_KEY || '', centerCode: centerCode || '', stream: stream || 'JEE', tests: {} };

  for (const [key, value] of Object.entries(scoreFields)) {
    if (!value && value !== 0) continue;

    const parsed = parseTestColumn(key);
    if (!result.tests[parsed.testName]) result.tests[parsed.testName] = {};
    if (parsed.isTotal) {
      result.tests[parsed.testName].total = value;
    } else {
      result.tests[parsed.testName][parsed.subject] = value;
    }
  }

  return result;
}

// ── Backend Analytics API calls ────────────────────────────────────────────────

export async function fetchOverview(token, centerCode) {
  const qs = centerCode ? `?centerCode=${encodeURIComponent(centerCode)}` : '';
  return apiFetch(`/api/analytics/overview${qs}`, token);
}

export async function fetchRankings(token, { testKey, centerCode, limit = 30, order = 'desc' } = {}) {
  const params = new URLSearchParams({ testKey, limit, order });
  if (centerCode) params.set('centerCode', centerCode);
  return apiFetch(`/api/analytics/rankings?${params}`, token);
}

export async function fetchCentreLeaderboard(token, testKey) {
  return apiFetch(`/api/analytics/centre-leaderboard?testKey=${encodeURIComponent(testKey)}`, token);
}

export async function fetchSubjectAverages(token, centerCode) {
  const qs = centerCode ? `?centerCode=${encodeURIComponent(centerCode)}` : '';
  return apiFetch(`/api/analytics/subject-averages${qs}`, token);
}

export async function fetchStudentChart(token, rollKey, centerCode) {
  const params = new URLSearchParams({ rollKey });
  if (centerCode) params.set('centerCode', centerCode);
  return apiFetch(`/api/analytics/student-chart?${params}`, token);
}

export async function fetchTestColumns(token, centerCode) {
  const qs = centerCode ? `?centerCode=${encodeURIComponent(centerCode)}` : '';
  return apiFetch(`/api/analytics/test-columns${qs}`, token);
}

// ── Utility: Get exam percentile ───────────────────────────────────────────────

export function getJeePercentile(profile) {
  if (!profile) return null;
  const key = Object.keys(profile).find(
    (k) =>
      k.toLowerCase().includes('jee main') && k.toLowerCase().includes('percentile')
  );
  return key ? profile[key] : null;
}

export function getNeetScore(profile) {
  if (!profile) return null;
  const key = Object.keys(profile).find(
    (k) => k.toLowerCase().includes('neet') && k.toLowerCase().includes('score')
  );
  return key ? profile[key] : null;
}

export function getExamResult(profile) {
  const stream = profile?.stream || 'JEE';
  return stream === 'NEET' ? getNeetScore(profile) : getJeePercentile(profile);
}

// ── Local helpers (fallbacks when backend API is unavailable) ─────────────────

/** Build chart data for a single student's flat test record. */
export function buildStudentChartData(studentTests, testColumns) {
  const testsMap = {};

  (testColumns || []).forEach((col) => {
    const { subject, testName, isTotal } = parseTestColumn(col);
    if (!testsMap[testName]) testsMap[testName] = { name: testName };

    const raw = (studentTests || {})[col];
    const hasScore = raw !== undefined && raw !== null && raw !== '' && String(raw).toLowerCase() !== 'absent';
    if (hasScore) {
      const m = parseFloat(raw);
      if (!isNaN(m)) testsMap[testName][subject] = m;
    } else {
      if (!isTotal) testsMap[testName][subject] = null;
    }

    // Derive total from subjects if no explicit total column
    if (!isTotal && testsMap[testName].Total === undefined) {
      const vals = Object.entries(testsMap[testName]).filter(
        ([k, v]) => k !== 'name' && k !== 'Total' && typeof v === 'number'
      );
      testsMap[testName].Total = vals.length ? vals.reduce((s, [, v]) => s + v, 0) : null;
    }
  });

  return Object.values(testsMap).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true })
  );
}

/** Compute weak subject from a flat student test record. */
export function computeWeakSubject(studentTests, testColumns) {
  if (!studentTests || !testColumns?.length) return 'N/A';
  const totals = {};
  const counts = {};

  testColumns.forEach((col) => {
    const { subject, isTotal } = parseTestColumn(col);
    if (isTotal || subject === 'Total') return;
    const raw = studentTests[col];
    if (raw === undefined || raw === null || raw === '' || String(raw).toLowerCase() === 'absent') return;
    const m = parseFloat(raw);
    if (isNaN(m)) return;
    totals[subject] = (totals[subject] || 0) + m;
    counts[subject] = (counts[subject] || 0) + 1;
  });

  if (!Object.keys(totals).length) return 'N/A';
  return Object.entries(totals)
    .map(([sub, total]) => ({ sub, avg: total / (counts[sub] || 1) }))
    .sort((a, b) => a.avg - b.avg)[0].sub;
}

