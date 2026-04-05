// ============================================================
// CSRL Data Service
// All data fetching and computation logic
// ============================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// ─── API Calls ────────────────────────────────────────────────────────────────

export async function loginApi(credentials) {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  });
  if (!res.ok) throw new Error('Invalid credentials');
  return res.json();
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

export async function fetchGlobalData(token) {
  const res = await fetch(`${API_BASE_URL}/data/global`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error('API Request Failed');
  return res.json();
}

export async function fetchCenterDataApi(token) {
  const res = await fetch(`${API_BASE_URL}/data/center`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error('API Request Failed');
  return res.json();
}

export async function fetchStudentData(token) {
  const res = await fetch(`${API_BASE_URL}/data/student`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error('API Request Failed');
  return res.json();
}

// ─── Utility: Get JEE Percentile ─────────────────────────────────────────────

export function getJeePercentile(profile) {
  if (!profile) return null;
  const key = Object.keys(profile).find(
    k => k.toLowerCase().includes('jee main') && k.toLowerCase().includes('percentile')
  );
  return key ? profile[key] : null;
}

// ─── Utility: Compute weak subject from a student's test records ──────────────

export function computeWeakSubject(tests, testColumns) {
  if (!tests || !testColumns || testColumns.length === 0) return 'N/A';
  const totals = {};
  const counts = {};

  testColumns.forEach(col => {
    const parts = col.split(' ');
    const subject = parts.length > 1 ? parts[0] : 'Score';
    const rawMark = tests[col];
    if (rawMark !== undefined && rawMark !== null && rawMark !== '' &&
        String(rawMark) !== '0' && String(rawMark).toLowerCase() !== 'absent') {
      const m = parseFloat(rawMark);
      if (!isNaN(m)) {
        totals[subject] = (totals[subject] || 0) + m;
        counts[subject] = (counts[subject] || 0) + 1;
      }
    }
  });

  if (Object.keys(totals).length === 0) return 'N/A';
  return Object.entries(totals)
    .map(([sub, total]) => ({ sub, avg: total / (counts[sub] || 1) }))
    .sort((a, b) => a.avg - b.avg)[0].sub;
}

// ─── Utility: Rank students by score for a given test key ────────────────────

export function rankStudents(profiles, tests, testKey) {
  const scored = [];

  profiles.forEach(p => {
    const studentTest = tests.find(t => t.ROLL_KEY === p.ROLL_KEY);
    if (!studentTest) return;
    const raw = studentTest[testKey];
    if (raw === undefined || raw === null || raw === '' ||
        String(raw).toLowerCase() === 'absent') return;
    const mark = parseFloat(raw);
    if (!isNaN(mark)) {
      scored.push({
        roll: p.ROLL_KEY,
        name: p["STUDENT'S NAME"] || '',
        marks: mark,
        center: p.centerCode,
        photo: p['STUDENT PHOTO URL'] || null
      });
    }
  });

  scored.sort((a, b) => b.marks !== a.marks ? b.marks - a.marks : a.roll.localeCompare(b.roll));
  return scored.map((s, idx) => ({ ...s, rank: idx + 1 }));
}

// ─── Utility: Same as rankStudents but returns { top10, bottom10, absentCount } ─

export function getRankingsByTest(profiles, tests, testKey) {
  const ranked = rankStudents(profiles, tests, testKey);

  // Count absents
  const absentCount = profiles.filter(p => {
    const st = tests.find(t => t.ROLL_KEY === p.ROLL_KEY);
    if (!st) return false;
    const raw = st[testKey];
    return !raw || String(raw).toLowerCase() === 'absent';
  }).length;

  return {
    rankedScores: ranked,
    top10: ranked.slice(0, 10),
    bottom10: [...ranked].reverse().slice(0, 10),
    absentCount
  };
}

// ─── Utility: Get student by roll number ─────────────────────────────────────

export function getStudentByRoll(profiles, rollNumber) {
  return profiles.find(p =>
    p.ROLL_KEY?.toLowerCase() === String(rollNumber).toLowerCase()
  );
}

// ─── Utility: Get students by centre ─────────────────────────────────────────

export function getStudentsByCentre(profiles, centre) {
  return profiles.filter(p => p.centerCode === centre);
}

// ─── Utility: Centre-level weak subject analysis ─────────────────────────────

export function getCentreWeakSubjectAnalysis(tests, testColumns) {
  const totals = {};
  const counts = {};

  tests.forEach(t => {
    testColumns.forEach(col => {
      const parts = col.split(' ');
      const subject = parts.length > 1 ? parts[0] : col;
      const raw = t[col];
      if (raw && String(raw).toLowerCase() !== 'absent') {
        const m = parseFloat(raw);
        if (!isNaN(m)) {
          totals[subject] = (totals[subject] || 0) + m;
          counts[subject] = (counts[subject] || 0) + 1;
        }
      }
    });
  });

  return Object.keys(totals)
    .map(sub => ({
      subject: sub,
      avg: counts[sub] ? parseFloat((totals[sub] / counts[sub]).toFixed(1)) : 0
    }))
    .sort((a, b) => a.avg - b.avg);
}

// ─── Utility: Search students by name, roll, category ────────────────────────

export function searchStudents(profiles, { name = '', rollNumber = '', category = '' } = {}) {
  return profiles.filter(s => {
    const matchName = !name || (s["STUDENT'S NAME"] || '').toLowerCase().includes(name.toLowerCase());
    const matchRoll = !rollNumber || (s.ROLL_KEY || '').toLowerCase().includes(rollNumber.toLowerCase());
    const matchCat = !category || category === 'ALL' || s.CATEGORY === category;
    return matchName && matchRoll && matchCat;
  });
}

// ─── Utility: Calculate overall analytics ────────────────────────────────────

export function calculateAnalytics(profiles) {
  let highest = 0;
  let sum = 0;
  let count = 0;

  profiles.forEach(p => {
    const jeeStr = getJeePercentile(p);
    if (jeeStr) {
      const jee = parseFloat(jeeStr);
      if (!isNaN(jee)) {
        if (jee > highest) highest = jee;
        sum += jee;
        count++;
      }
    }
  });

  return {
    totalStudents: profiles.length,
    avgJee: count > 0 ? (sum / count).toFixed(2) : 'N/A',
    highestJee: count > 0 ? highest.toFixed(2) : 'N/A'
  };
}

// ─── Utility: Rank all centres by avg test score ──────────────────────────────

export function rankCentres(profiles, tests, testColumns) {
  const centreStats = {};

  profiles.forEach(p => {
    const code = p.centerCode || 'UNKNOWN';
    if (!centreStats[code]) centreStats[code] = { totals: {}, counts: {}, studentCount: 0 };
    centreStats[code].studentCount++;

    const studentTest = tests.find(t => t.ROLL_KEY === p.ROLL_KEY);
    if (!studentTest) return;

    testColumns.forEach(col => {
      const raw = studentTest[col];
      if (raw && String(raw).toLowerCase() !== 'absent') {
        const m = parseFloat(raw);
        if (!isNaN(m)) {
          const parts = col.split(' ');
          const sub = parts.length > 1 ? parts[0] : col;
          centreStats[code].totals[sub] = (centreStats[code].totals[sub] || 0) + m;
          centreStats[code].counts[sub] = (centreStats[code].counts[sub] || 0) + 1;
        }
      }
    });
  });

  return Object.entries(centreStats)
    .map(([code, stats]) => {
      const subjects = Object.keys(stats.totals);
      if (!subjects.length) return { code, avgScore: 0, studentCount: stats.studentCount, weakSubject: 'N/A' };
      const totalAvg = subjects.reduce((sum, s) => sum + stats.totals[s] / (stats.counts[s]||1), 0) / subjects.length;
      const weakSubject = subjects.sort((a,b) => (stats.totals[a]/stats.counts[a]) - (stats.totals[b]/stats.counts[b]))[0];
      return { code, avgScore: parseFloat(totalAvg.toFixed(1)), studentCount: stats.studentCount, weakSubject };
    })
    .sort((a, b) => b.avgScore - a.avgScore)
    .map((c, i) => ({ ...c, rank: i + 1 }));
}

// ─── Utility: Per-subject averages for a set of tests (for trends) ─────────────

export function getSubjectAverages(tests, testColumns) {
  const totals = {};
  const counts = {};

  tests.forEach(t => {
    testColumns.forEach(col => {
      const parts = col.split(' ');
      const sub = parts.length > 1 ? parts[0] : col;
      const raw = t[col];
      if (raw && String(raw).toLowerCase() !== 'absent') {
        const m = parseFloat(raw);
        if (!isNaN(m)) {
          totals[sub] = (totals[sub] || 0) + m;
          counts[sub] = (counts[sub] || 0) + 1;
        }
      }
    });
  });

  return Object.entries(totals).map(([subject, total]) => ({
    subject,
    avg: parseFloat((total / counts[subject]).toFixed(1)),
    count: counts[subject]
  })).sort((a, b) => b.avg - a.avg);
}

// ─── Utility: Student test-by-test multi-subject chart data ───────────────────

export function buildStudentChartData(studentTests, testColumns) {
  const testsMap = {};

  testColumns.forEach(col => {
    const parts = col.split(' ');
    const sub = parts.length > 1 ? parts[0] : 'Score';
    const testName = parts.length > 1 ? parts.slice(1).join(' ') : col;
    if (!testsMap[testName]) testsMap[testName] = { name: testName };
    const raw = studentTests[col];
    if (raw && String(raw).toLowerCase() !== 'absent') {
      const m = parseFloat(raw);
      if (!isNaN(m)) testsMap[testName][sub] = m;
    } else {
      testsMap[testName][sub] = null;
    }
  });

  return Object.values(testsMap);
}

// ─── CRUD API helpers ─────────────────────────────────────────────────────────

export async function addStudentApi(token, studentData) {
  const res = await fetch(`${API_BASE_URL}/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(studentData)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateStudentApi(token, rollKey, studentData) {
  const res = await fetch(`${API_BASE_URL}/students/${encodeURIComponent(rollKey)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(studentData)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteStudentApi(token, rollKey) {
  const res = await fetch(`${API_BASE_URL}/students/${encodeURIComponent(rollKey)}`, {
    method: 'DELETE',
    headers: authHeaders(token)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function upsertTestScoresApi(token, rollKey, scores) {
  const res = await fetch(`${API_BASE_URL}/tests/${encodeURIComponent(rollKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify({ scores })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

