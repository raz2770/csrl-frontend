// ============================================================
// CSRL Data Service
//
// Architecture:
//   ALL data flows through the backend REST API.
//   No direct Firestore / Firebase SDK access from the frontend.
//
// Auth:
//   JWT is stored in localStorage (csrl_token) by AuthContext.
//   Every API call reads it automatically — no need to pass tokens
//   explicitly from components.
//
// Endpoints used:
//   GET  /api/data/global              — admin: all profiles + tests
//   GET  /api/data/center              — centre: own profiles + tests
//   GET  /api/data/student             — student: own profile + tests
//   POST /api/students                 — add student
//   PUT  /api/students/:roll           — update student
//   DELETE /api/students/:roll         — delete student
//   POST /api/tests/:roll              — upsert test scores
//   GET  /api/analytics/overview       — KPI summary
//   GET  /api/analytics/rankings       — ranked student list
//   GET  /api/analytics/centre-leaderboard — centre rankings
//   GET  /api/analytics/subject-averages   — per-subject averages
//   GET  /api/analytics/test-insights       — CAT-style analysis for one test (marks-based)
//   GET  /api/analytics/student-chart      — chart data for one student
//   GET  /api/analytics/test-columns       — known test column names
// ============================================================

// ── Stream / Subject constants ─────────────────────────────────────────────────

/** Exam-style maxima: JEE 360 (120+120+120), NEET 720 (180+180+360). */
export const STREAMS = {
  JEE: {
    label: 'JEE',
    subjects: ['Physics', 'Chemistry', 'Math'],
    maxTotal: 360,
    maxBySubject: { Physics: 120, Chemistry: 120, Math: 120 },
  },
  NEET: {
    label: 'NEET',
    subjects: ['Physics', 'Chemistry', 'Biology'],
    maxTotal: 720,
    maxBySubject: { Physics: 180, Chemistry: 180, Biology: 360 },
  },
};

export function getStreamConfig(stream) {
  return STREAMS[stream] || STREAMS.JEE;
}

/** Max marks for one subject in a stream (for progress bars and tables). */
export function getMaxMarksForSubject(streamCfg, subject) {
  const by = streamCfg?.maxBySubject;
  if (by && subject && by[subject] != null) return by[subject];
  return 120;
}

const SUBJECT_ALIASES = {
  PHY: 'Physics', PHYSICS: 'Physics',
  CHE: 'Chemistry', CHEM: 'Chemistry', CHEMISTRY: 'Chemistry', CHEMITRY: 'Chemistry',
  MAT: 'Math', MATH: 'Math', MATHS: 'Math', MATHEMATICS: 'Math',
  BIO: 'Biology', BIOLOGY: 'Biology',
  BOT: 'Botany', BOTANY: 'Botany',
  ZOO: 'Zoology', ZOOLOGY: 'Zoology',
};

function normalizeSubject(sub) {
  const token = String(sub || '').trim().toUpperCase();
  if (SUBJECT_ALIASES[token]) return SUBJECT_ALIASES[token];
  if (!sub) return 'Total';
  return sub.charAt(0).toUpperCase() + sub.slice(1).toLowerCase();
}

// ── Image URL helpers ─────────────────────────────────────────────────────────

export function extractGoogleDriveFileId(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';

  const fromFilePath = raw.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fromFilePath?.[1]) return fromFilePath[1];

  const fromQuery = raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (fromQuery?.[1]) return fromQuery[1];

  return '';
}

export function resolveStudentPhotoUrl(url, variant = 'primary') {
  const raw = String(url || '').trim();
  if (!raw) return '';

  const id = extractGoogleDriveFileId(raw);
  if (!id) return raw;

  if (variant === 'fallback') {
    return `https://lh3.googleusercontent.com/d/${id}=s1000`;
  }

  return `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
}

// ── Column parsing ─────────────────────────────────────────────────────────────

export function parseTestColumn(col) {
  const raw = String(col || '').trim();

  // New format: CAT-1(TEST)_Physics
  const underscored = raw.match(/^(.+)_([^_]+)$/);
  if (underscored) {
    return { testName: underscored[1].trim(), subject: normalizeSubject(underscored[2]), isTotal: false };
  }

  // Legacy format: PHY Test 1
  const parts = raw.split(/\s+/);
  if (parts.length > 1) {
    const token = (parts[0] || '').toUpperCase();
    if (SUBJECT_ALIASES[token]) {
      return { testName: parts.slice(1).join(' '), subject: SUBJECT_ALIASES[token], isTotal: false };
    }
  }

  // Total column: CAT-1(TEST)
  return { testName: raw, subject: 'Total', isTotal: true };
}

// ── Backend API helper ─────────────────────────────────────────────────────────

const TOKEN_KEY = 'csrl_token';

function resolveApiBase() {
  const envBase = String(import.meta.env.VITE_API_BASE_URL || '').trim();
  if (envBase) return envBase.replace(/\/$/, '');

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host.endsWith('.vercel.app')) {
      return 'https://csrl-backend.onrender.com/api';
    }
  }

  return '/api';
}

const API_BASE = resolveApiBase();

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Central fetch wrapper.
 * Reads the JWT from localStorage automatically — no token argument needed.
 * opts.method defaults to 'GET'; pass opts.body for POST/PUT.
 */
async function apiFetch(path, opts = {}) {
  const { method = 'GET', body } = opts;
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let url;
  if (path.startsWith('http')) {
    url = path;
  } else {
    let normalizedPath = path.startsWith('/') ? path : `/${path}`;
    if (API_BASE.endsWith('/api') && normalizedPath.startsWith('/api/')) {
      normalizedPath = normalizedPath.slice(4);
    }
    url = `${API_BASE}${normalizedPath}`;
  }

  // Bypass browser caching for GET requests to prevent stale UI during CRUD operations
  if (method.toUpperCase() === 'GET') {
    url += url.includes('?') ? `&_t=${Date.now()}` : `?_t=${Date.now()}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `API error (${res.status})`);
  }
  return res.json();
}

// ── Data-fetching (all via backend cache) ──────────────────────────────────────

/**
 * Admin: fetch all profiles + test scores (flat) + testColumns.
 * Backend returns data from its Firestore-backed in-memory cache.
 */
export async function fetchGlobalData() {
  return apiFetch('/api/data/global');
}

/**
 * Centre: fetch own profiles + tests (JWT encodes centreCode).
 * The _token / centreCode args are accepted for backward compat but ignored.
 */
export async function fetchCenterDataApi(_token, _centreCode) {
  void _token;
  void _centreCode;
  return apiFetch('/api/data/center');
}

/**
 * Student: fetch own profile + tests (JWT encodes rollKey).
 * The _token / _rollKey args are accepted for backward compat but ignored.
 */
export async function fetchStudentData(_token, _rollKey) {
  void _token;
  void _rollKey;
  return apiFetch('/api/data/student');
}

// ── CRUD (admin only, via backend) ────────────────────────────────────────────

export async function addStudentApi(_token, studentData) {
  return apiFetch('/api/students', { method: 'POST', body: studentData });
}

export async function updateStudentApi(_token, rollKey, studentData) {
  const qs = studentData.centerCode
    ? `?centerCode=${encodeURIComponent(studentData.centerCode)}`
    : '';
  return apiFetch(`/api/students/${encodeURIComponent(rollKey)}${qs}`, {
    method: 'PUT',
    body:   studentData,
  });
}

export async function deleteStudentApi(_token, rollKey, centerCode) {
  const qs = centerCode ? `?centerCode=${encodeURIComponent(centerCode)}` : '';
  return apiFetch(`/api/students/${encodeURIComponent(rollKey)}${qs}`, { method: 'DELETE' });
}

/**
 * Upsert test scores for a student.
 * scores — flat object: { "CAT-1(TEST)_Physics": 45, "CAT-1(TEST)": 145, … }
 *          OR nested:   { tests: { "CAT-1(TEST)": { Physics: 45, total: 145 } } }
 * Backend accepts both formats.
 */
export async function upsertTestScoresApi(_token, rollKey, scores, centerCode) {
  const qs = centerCode ? `?centerCode=${encodeURIComponent(centerCode)}` : '';
  return apiFetch(`/api/tests/${encodeURIComponent(rollKey)}${qs}`, {
    method: 'POST',
    body:   { scores },
  });
}

// ── Backend Analytics API calls ────────────────────────────────────────────────

export async function fetchOverview(_token, centerCode) {
  const qs = centerCode ? `?centerCode=${encodeURIComponent(centerCode)}` : '';
  return apiFetch(`/api/analytics/overview${qs}`);
}

export async function fetchRankings(_token, { testKey, centerCode, limit = 30, order = 'desc' } = {}) {
  const params = new URLSearchParams({ testKey, limit, order });
  if (centerCode) params.set('centerCode', centerCode);
  return apiFetch(`/api/analytics/rankings?${params}`);
}

export async function fetchCentreLeaderboard(_token, testKey) {
  return apiFetch(`/api/analytics/centre-leaderboard?testKey=${encodeURIComponent(testKey)}`);
}

export async function fetchSubjectAverages(_token, centerCode, testKey) {
  const params = new URLSearchParams();
  if (centerCode) params.set('centerCode', centerCode);
  if (testKey) params.set('testKey', testKey);
  const qs = params.toString() ? `?${params}` : '';
  return apiFetch(`/api/analytics/subject-averages${qs}`);
}

/** CAT-style test analysis (marks-based). Optional rollKey highlights one student in the payload. */
export async function fetchTestInsights(_token, testKey, rollKey) {
  const params = new URLSearchParams({ testKey });
  if (rollKey) params.set('rollKey', rollKey);
  return apiFetch(`/api/analytics/test-insights?${params}`);
}

export async function fetchStudentChart(_token, rollKey, centerCode) {
  const params = new URLSearchParams({ rollKey });
  if (centerCode) params.set('centerCode', centerCode);
  return apiFetch(`/api/analytics/student-chart?${params}`);
}

export async function fetchTestColumns(_token, centerCode) {
  const qs = centerCode ? `?centerCode=${encodeURIComponent(centerCode)}` : '';
  return apiFetch(`/api/analytics/test-columns${qs}`);
}

// ── Utility: Get exam result ───────────────────────────────────────────────────

export function getJeePercentile(profile) {
  if (!profile) return null;
  const key = Object.keys(profile).find(
    (k) => k.toLowerCase().includes('jee main') && k.toLowerCase().includes('percentile')
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
  return (profile?.stream || 'JEE') === 'NEET' ? getNeetScore(profile) : getJeePercentile(profile);
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

  });

  Object.values(testsMap).forEach((testRow) => {
    if (testRow.Total !== undefined && testRow.Total !== null) return;
    const vals = Object.entries(testRow).filter(
      ([k, v]) => k !== 'name' && k !== 'Total' && typeof v === 'number'
    );
    testRow.Total = vals.length ? vals.reduce((s, [, v]) => s + v, 0) : null;
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
