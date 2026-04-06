// ============================================================
// CSRL Data Service — Firebase / Firestore version
//
// All fetch() calls replaced with Firestore SDK queries.
// All pure-JS utility / computation functions are UNCHANGED.
//
// Firestore collections:
//   students/   { ROLL_KEY, STUDENT'S NAME, centerCode, CATEGORY, ... }
//   testScores/ { "PHY Test 1": 85, "CHE Test 1": 72, ... } (doc id == roll key)
//   users/      { role, name, centreCode?, rollKey? }
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
} from "firebase/firestore";
import { db } from "../config/firebase";

const SUBJECT_ALIASES = {
  PHY: "Physics",
  CHE: "Chemistry",
  MAT: "Math",
};

export function parseTestColumn(col) {
  const raw = String(col || "").trim();

  // New format: CAT-1(TEST)_Physics
  const underscored = raw.match(/^(.*)_([^_]+)$/);
  if (underscored) {
    return {
      testName: underscored[1].trim(),
      subject: underscored[2].trim(),
      isTotal: false,
    };
  }

  // Legacy format: PHY Test 1
  const parts = raw.split(/\s+/);
  if (parts.length > 1) {
    const token = (parts[0] || "").toUpperCase();
    if (SUBJECT_ALIASES[token]) {
      return {
        testName: parts.slice(1).join(" "),
        subject: SUBJECT_ALIASES[token],
        isTotal: false,
      };
    }
  }

  // Test total column: CAT-1(TEST)
  return {
    testName: raw,
    subject: "Total",
    isTotal: true,
  };
}

function hasUsableScore(rawMark) {
  return (
    rawMark !== undefined &&
    rawMark !== null &&
    rawMark !== "" &&
    String(rawMark).toLowerCase() !== "absent"
  );
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

/** Derive the ordered list of test-column names from all test documents */
function extractTestColumns(testDocs) {
  const EXCLUDED_KEYS = new Set([
    "ROLL",
    "ROLL_KEY",
    "ROLL NO.",
    "ROLL NO",
    "ROLL_NUMBER",
    "ROLL NUMBER",
    "STUDENT'S NAME",
    "STUDENT NAME",
    "NAME",
    "CENTER",
    "CENTRE",
    "CENTERCODE",
  ]);

  const allKeys = new Set();
  testDocs.forEach((t) => {
    Object.keys(t).forEach((k) => {
      const normalized = String(k).trim().toUpperCase();
      if (!EXCLUDED_KEYS.has(normalized)) allKeys.add(k);
    });
  });
  return Array.from(allKeys);
}

// ─── Data-fetching API (replaces fetch() backend calls) ──────────────────────

/**
 * fetchGlobalData()
 * Called by AdminDashboard. Returns { profiles, tests, testColumns }.
 * Previously: GET /api/data/global
 */
export async function fetchGlobalData(_token) {
  void _token;
  const [profilesSnap, testsSnap] = await Promise.all([
    getDocs(collection(db, "students")),
    getDocs(collection(db, "testScores")),
  ]);

  const profiles = profilesSnap.docs.map((d) => d.data());
  const tests    = testsSnap.docs.map((d) => ({ ROLL_KEY: d.id, ...d.data() }));

  return { profiles, tests, testColumns: extractTestColumns(tests) };
}

/**
 * fetchCenterDataApi(token, centreCode?)
 * Called by CentreDashboard. Returns { profiles, tests, testColumns }.
 * Previously: GET /api/data/center
 *
 * centreCode is now passed explicitly from the auth user object.
 */
export async function fetchCenterDataApi(_token, centreCode) {
  if (!centreCode) throw new Error("centreCode is required");

  const [profilesSnap, testsSnap] = await Promise.all([
    getDocs(query(collection(db, "students"), where("centerCode", "==", centreCode))),
    getDocs(collection(db, "testScores")),
  ]);

  const profiles = profilesSnap.docs.map((d) => d.data());
  const rollKeys = new Set(profiles.map((p) => p.ROLL_KEY));

  // Only include test records that belong to this centre's students
  const tests = testsSnap.docs
    .map((d) => ({ ROLL_KEY: d.id, ...d.data() }))
    .filter((t) => rollKeys.has(t.ROLL_KEY));

  return { profiles, tests, testColumns: extractTestColumns(tests) };
}

/**
 * fetchStudentData(token, rollKey?)
 * Called by StudentDashboard. Returns { profiles, tests, testColumns }.
 * Previously: GET /api/data/student
 */
export async function fetchStudentData(_token, rollKey) {
  if (!rollKey) throw new Error("rollKey is required");

  const [profileSnap, testSnap] = await Promise.all([
    getDoc(doc(db, "students",   rollKey)),
    getDoc(doc(db, "testScores", rollKey)),
  ]);

  const profile  = profileSnap.exists()  ? profileSnap.data()  : null;
  const testData = testSnap.exists()     ? { ROLL_KEY: rollKey, ...testSnap.data() } : {};

  const profiles = profile  ? [profile]  : [];
  const tests    = testData ? [testData] : [];

  return { profiles, tests, testColumns: extractTestColumns(tests) };
}

// ─── CRUD API helpers (admin only, previously POST/PUT/DELETE /api/students) ─

export async function addStudentApi(_token, studentData) {
  const rollKey = studentData.ROLL_KEY;
  if (!rollKey) throw new Error("ROLL_KEY is required");

  const ref  = doc(db, "students", rollKey);
  const snap = await getDoc(ref);
  if (snap.exists()) throw new Error(`Student ${rollKey} already exists`);

  await setDoc(ref, studentData);
  return { success: true, student: studentData };
}

export async function updateStudentApi(_token, rollKey, studentData) {
  const ref = doc(db, "students", rollKey);
  await updateDoc(ref, { ...studentData, ROLL_KEY: rollKey });
  const updated = (await getDoc(ref)).data();
  return { success: true, student: updated };
}

export async function deleteStudentApi(_token, rollKey) {
  await Promise.all([
    deleteDoc(doc(db, "students",   rollKey)),
    deleteDoc(doc(db, "testScores", rollKey)),
  ]);
  return { success: true };
}

export async function upsertTestScoresApi(_token, rollKey, scores) {
  const ref = doc(db, "testScores", rollKey);
  await setDoc(ref, { ...scores }, { merge: true });
  const updated = { ROLL_KEY: rollKey, ...(await getDoc(ref)).data() };
  return { success: true, testRecord: updated };
}

// ─── Utility: Get JEE Percentile ─────────────────────────────────────────────

export function getJeePercentile(profile) {
  if (!profile) return null;
  const key = Object.keys(profile).find(
    (k) =>
      k.toLowerCase().includes("jee main") &&
      k.toLowerCase().includes("percentile")
  );
  return key ? profile[key] : null;
}

// ─── Utility: Compute weak subject from a student's test records ──────────────

export function computeWeakSubject(tests, testColumns) {
  if (!tests || !testColumns || testColumns.length === 0) return "N/A";
  const totals = {};
  const counts = {};

  testColumns.forEach((col) => {
    const { subject, isTotal } = parseTestColumn(col);
    if (isTotal) return;

    const rawMark = tests[col];
    if (hasUsableScore(rawMark)) {
      const m = parseFloat(rawMark);
      if (!isNaN(m)) {
        totals[subject] = (totals[subject] || 0) + m;
        counts[subject] = (counts[subject] || 0) + 1;
      }
    }
  });

  if (Object.keys(totals).length === 0) return "N/A";
  return Object.entries(totals)
    .map(([sub, total]) => ({ sub, avg: total / (counts[sub] || 1) }))
    .sort((a, b) => a.avg - b.avg)[0].sub;
}

// ─── Utility: Rank students by score for a given test key ────────────────────

export function rankStudents(profiles, tests, testKey) {
  const scored = [];

  profiles.forEach((p) => {
    const studentTest = tests.find((t) => t.ROLL_KEY === p.ROLL_KEY);
    if (!studentTest) return;
    const raw = studentTest[testKey];
    if (
      raw === undefined ||
      raw === null ||
      raw === "" ||
      String(raw).toLowerCase() === "absent"
    )
      return;
    const mark = parseFloat(raw);
    if (!isNaN(mark)) {
      scored.push({
        roll:   p.ROLL_KEY,
        name:   p["STUDENT'S NAME"] || "",
        marks:  mark,
        center: p.centerCode,
        photo:  p["STUDENT PHOTO URL"] || null,
      });
    }
  });

  scored.sort((a, b) =>
    b.marks !== a.marks ? b.marks - a.marks : a.roll.localeCompare(b.roll)
  );
  return scored.map((s, idx) => ({ ...s, rank: idx + 1 }));
}

// ─── Utility: Same as rankStudents but returns { top10, bottom10, absentCount } ─

export function getRankingsByTest(profiles, tests, testKey) {
  const ranked = rankStudents(profiles, tests, testKey);

  const absentCount = profiles.filter((p) => {
    const st  = tests.find((t) => t.ROLL_KEY === p.ROLL_KEY);
    if (!st) return false;
    const raw = st[testKey];
    return !raw || String(raw).toLowerCase() === "absent";
  }).length;

  return {
    rankedScores: ranked,
    top10:        ranked.slice(0, 10),
    bottom10:     [...ranked].reverse().slice(0, 10),
    absentCount,
  };
}

// ─── Utility: Get student by roll number ─────────────────────────────────────

export function getStudentByRoll(profiles, rollNumber) {
  return profiles.find(
    (p) => p.ROLL_KEY?.toLowerCase() === String(rollNumber).toLowerCase()
  );
}

// ─── Utility: Get students by centre ─────────────────────────────────────────

export function getStudentsByCentre(profiles, centre) {
  return profiles.filter((p) => p.centerCode === centre);
}

// ─── Utility: Centre-level weak subject analysis ─────────────────────────────

export function getCentreWeakSubjectAnalysis(tests, testColumns) {
  const totals = {};
  const counts = {};

  tests.forEach((t) => {
    testColumns.forEach((col) => {
      const { subject, isTotal } = parseTestColumn(col);
      if (isTotal) return;

      const raw     = t[col];
      if (hasUsableScore(raw)) {
        const m = parseFloat(raw);
        if (!isNaN(m)) {
          totals[subject] = (totals[subject] || 0) + m;
          counts[subject] = (counts[subject] || 0) + 1;
        }
      }
    });
  });

  return Object.keys(totals)
    .map((sub) => ({
      subject: sub,
      avg:     counts[sub]
        ? parseFloat((totals[sub] / counts[sub]).toFixed(1))
        : 0,
    }))
    .sort((a, b) => a.avg - b.avg);
}

// ─── Utility: Search students by name, roll, category ────────────────────────

export function searchStudents(
  profiles,
  { name = "", rollNumber = "", category = "" } = {}
) {
  return profiles.filter((s) => {
    const matchName = !name || (s["STUDENT'S NAME"] || "")
      .toLowerCase()
      .includes(name.toLowerCase());
    const matchRoll = !rollNumber ||
      (s.ROLL_KEY || "").toLowerCase().includes(rollNumber.toLowerCase());
    const matchCat  =
      !category || category === "ALL" || s.CATEGORY === category;
    return matchName && matchRoll && matchCat;
  });
}

// ─── Utility: Calculate overall analytics ────────────────────────────────────

export function calculateAnalytics(profiles) {
  let highest = 0;
  let sum     = 0;
  let count   = 0;

  profiles.forEach((p) => {
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
    avgJee:        count > 0 ? (sum / count).toFixed(2) : "N/A",
    highestJee:    count > 0 ? highest.toFixed(2)       : "N/A",
  };
}

// ─── Utility: Rank all centres by avg test score ──────────────────────────────

export function rankCentres(profiles, tests, testColumns) {
  const centreStats = {};

  profiles.forEach((p) => {
    const code = p.centerCode || "UNKNOWN";
    if (!centreStats[code])
      centreStats[code] = { totals: {}, counts: {}, studentCount: 0 };
    centreStats[code].studentCount++;

    const studentTest = tests.find((t) => t.ROLL_KEY === p.ROLL_KEY);
    if (!studentTest) return;

    testColumns.forEach((col) => {
      const { subject, isTotal } = parseTestColumn(col);
      if (isTotal) return;

      const raw = studentTest[col];
      if (hasUsableScore(raw)) {
        const m = parseFloat(raw);
        if (!isNaN(m)) {
          centreStats[code].totals[subject] =
            (centreStats[code].totals[subject] || 0) + m;
          centreStats[code].counts[subject] =
            (centreStats[code].counts[subject] || 0) + 1;
        }
      }
    });
  });

  return Object.entries(centreStats)
    .map(([code, stats]) => {
      const subjects = Object.keys(stats.totals);
      if (!subjects.length)
        return {
          code,
          avgScore:     0,
          studentCount: stats.studentCount,
          weakSubject:  "N/A",
        };
      const totalAvg =
        subjects.reduce(
          (sum, s) => sum + stats.totals[s] / (stats.counts[s] || 1),
          0
        ) / subjects.length;
      const weakSubject = subjects.sort(
        (a, b) =>
          stats.totals[a] / stats.counts[a] -
          stats.totals[b] / stats.counts[b]
      )[0];
      return {
        code,
        avgScore:     parseFloat(totalAvg.toFixed(1)),
        studentCount: stats.studentCount,
        weakSubject,
      };
    })
    .sort((a, b) => b.avgScore - a.avgScore)
    .map((c, i) => ({ ...c, rank: i + 1 }));
}

/**
 * Rank centres by average score for a single test column (e.g. one subject column or total).
 * Matches prototype "Centre Leaderboard" behaviour for the selected test key.
 */
export function rankCentresByTestKey(profiles, tests, testKey, testColumns) {
  if (!testKey || !profiles?.length) return [];

  const centreAgg = {};
  profiles.forEach((p) => {
    const code = p.centerCode || "UNKNOWN";
    const st = tests.find((t) => t.ROLL_KEY === p.ROLL_KEY);
    if (!st) return;
    const raw = st[testKey];
    if (!hasUsableScore(raw)) return;
    const mark = parseFloat(raw);
    if (isNaN(mark)) return;
    if (!centreAgg[code]) {
      centreAgg[code] = { sum: 0, count: 0, max: -Infinity };
    }
    centreAgg[code].sum += mark;
    centreAgg[code].count += 1;
    centreAgg[code].max = Math.max(centreAgg[code].max, mark);
  });

  const studentCountBy = {};
  profiles.forEach((p) => {
    const c = p.centerCode || "UNKNOWN";
    studentCountBy[c] = (studentCountBy[c] || 0) + 1;
  });

  return Object.entries(centreAgg)
    .map(([code, s]) => {
      const tested = s.count;
      const avg = tested ? Math.round(s.sum / tested) : 0;
      const top = s.max === -Infinity ? 0 : s.max;
      const studentCount = studentCountBy[code] || 0;
      const rollsInCentre = new Set(
        profiles
          .filter((p) => (p.centerCode || "UNKNOWN") === code)
          .map((p) => p.ROLL_KEY)
      );
      const testsSubset = tests.filter((t) => rollsInCentre.has(t.ROLL_KEY));
      let weakSubject = "N/A";
      if (testColumns?.length) {
        const analysis = getCentreWeakSubjectAnalysis(testsSubset, testColumns);
        if (analysis.length) weakSubject = analysis[0].subject;
      }
      return {
        code,
        avg,
        top,
        tested,
        studentCount,
        weakSubject,
      };
    })
    .filter((c) => c.tested > 0)
    .sort((a, b) => b.avg - a.avg)
    .map((c, i) => ({ ...c, rank: i + 1 }));
}

// ─── Utility: Per-subject averages for a set of tests (for trends) ─────────────

export function getSubjectAverages(tests, testColumns) {
  const totals = {};
  const counts = {};

  tests.forEach((t) => {
    testColumns.forEach((col) => {
      const { subject, isTotal } = parseTestColumn(col);
      if (isTotal) return;

      const raw   = t[col];
      if (hasUsableScore(raw)) {
        const m = parseFloat(raw);
        if (!isNaN(m)) {
          totals[subject] = (totals[subject] || 0) + m;
          counts[subject] = (counts[subject] || 0) + 1;
        }
      }
    });
  });

  return Object.entries(totals)
    .map(([subject, total]) => ({
      subject,
      avg:   parseFloat((total / counts[subject]).toFixed(1)),
      count: counts[subject],
    }))
    .sort((a, b) => b.avg - a.avg);
}

// ─── Utility: Student test-by-test multi-subject chart data ───────────────────

export function buildStudentChartData(studentTests, testColumns) {
  const testsMap = {};

  testColumns.forEach((col) => {
    const { subject, testName, isTotal } = parseTestColumn(col);
    if (!testsMap[testName]) testsMap[testName] = { name: testName };

    const raw = studentTests[col];
    if (hasUsableScore(raw)) {
      const m = parseFloat(raw);
      if (!isNaN(m)) testsMap[testName][subject] = m;
    } else {
      testsMap[testName][subject] = null;
    }

    // If only subject-wise columns exist, derive total for the chart.
    if (!isTotal && testsMap[testName].Total === undefined) {
      const current = testsMap[testName];
      const total = Object.entries(current)
        .filter(([k, v]) => k !== "name" && k !== "Total" && typeof v === "number")
        .reduce((sum, [, v]) => sum + v, 0);
      current.Total = total || null;
    }
  });

  return Object.values(testsMap).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}
