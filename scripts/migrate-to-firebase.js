/**
 * CSRL → Firebase One-Time Migration Script
 * Firebase Project: csrl-store (csrl-store.firebaseapp.com)
 * ==========================================
 * Run this ONCE to seed your Firebase project with:
 *   1. Firestore collections: students/, testScores/, users/, centres/
 *   2. Firebase Auth users for admin, each centre, and each student
 *
 * PREREQUISITES
 * -------------
 * 1. Install dependencies (from this scripts/ folder):
 *      npm install firebase-admin papaparse node-fetch dotenv
 *
 * 2. Download your Firebase Admin SDK service account key:
 *      Firebase Console → Project Settings → Service Accounts →
 *      Generate new private key → save as scripts/serviceAccountKey.json
 *
 * 3. Fill in MIGRATION CONFIG below
 *
 * 4. Run:
 *      node migrate-to-firebase.js
 */

// ── MIGRATION CONFIG ────────────────────────────────────────────────────────
// Edit these values to match your setup

const ADMIN_EMAIL    = "admin@csrl.internal";
const ADMIN_PASSWORD = "password123"; // Change after first login!

const CENTRES = {
  GAIL: {
    name:       "GAIL Utkarsh Super 100",
    email:      "gail@csrl.internal",
    password:   "GailCentre2026!",
    profileUrl: "https://docs.google.com/spreadsheets/d/1fErV1E2cB9Czhai2IEc4AozQKSDUqb2137aE9elIFpA/export?format=csv&gid=0",
    testUrl:    "https://docs.google.com/spreadsheets/d/1eUe6oDfhU7tpNoS3Ha6F8AGbgBfb-YjZGLFWDtOcLaA/export?format=csv&gid=1941021239",
  },
  OIL_INDIA: {
    name:       "Oil India Super 30",
    email:      "oil_india@csrl.internal",
    password:   "OilIndiaCentre2026!",
    profileUrl: "https://docs.google.com/spreadsheets/d/15U2fY_4nyaSL7_-CRvsTmcfDGyWk_NWuAsEgSFZFQWQ/export?format=csv&gid=352406722",
    testUrl:    "https://docs.google.com/spreadsheets/d/1eUe6oDfhU7tpNoS3Ha6F8AGbgBfb-YjZGLFWDtOcLaA/export?format=csv&gid=1185269559",
  },
};

// Default password for ALL students (they cannot change it via the app)
// Pattern: rollKey.toLowerCase()  e.g. "gail001"
const STUDENT_PASSWORD_FN = (rollKey) => String(rollKey).toLowerCase();

// Set true to delete all Firestore collections before import.
const WIPE_FIRESTORE_FIRST = true;

// ── END CONFIG ──────────────────────────────────────────────────────────────

import admin       from "firebase-admin";
import Papa        from "papaparse";
import fetch       from "node-fetch";
import { readFileSync } from "fs";
import process from "node:process";

// Initialise Firebase Admin
const serviceAccount = JSON.parse(readFileSync(new URL("./serviceAccountKey.json", import.meta.url)));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db  = admin.firestore();
const au  = admin.auth();

// Explicitly set Firestore settings (prevents region/database mismatch issues)
db.settings({ ignoreUndefinedProperties: true });

// ── Helpers ──────────────────────────────────────────────────────────────────

async function csvFromUrl(url) {
  const res  = await fetch(url);
  const text = await res.text();
  const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
  return data;
}

async function createAuthUser(email, password) {
  try {
    const u = await au.createUser({ email, password });
    return u.uid;
  } catch (e) {
    if (e.code === "auth/email-already-exists") {
      const u = await au.getUserByEmail(email);
      console.log(`  ↩  Already exists: ${email} (uid: ${u.uid})`);
      return u.uid;
    }
    throw e;
  }
}

async function batchWrite(docEntries) {
  // Firestore batch limit = 500
  const chunks = [];
  for (let i = 0; i < docEntries.length; i += 499)
    chunks.push(docEntries.slice(i, i + 499));

  for (const chunk of chunks) {
    const batch = db.batch();
    chunk.forEach(({ ref, data }) => batch.set(ref, data, { merge: true }));
    await batch.commit();
  }
}

function sanitizeTestRecord(test) {
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
    "centerCode",
    "CENTRE",
    "CENTER",
  ]);

  const cleaned = {};
  Object.entries(test || {}).forEach(([key, value]) => {
    const normalized = String(key).trim().toUpperCase();
    if (EXCLUDED_KEYS.has(normalized)) return;
    if (value === undefined || value === null) return;
    cleaned[key] = value;
  });

  return cleaned;
}

function parseTestColumn(col) {
  const raw = String(col || "").trim();
  if (!raw) return { testName: "", subject: "", isTotal: false };

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
    const SUBJECT_ALIASES = {
      PHY: "Physics",
      CHE: "Chemistry",
      MAT: "Math",
    };
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

function buildNestedTests(test) {
  const cleaned = sanitizeTestRecord(test);
  const tests = {};

  Object.entries(cleaned).forEach(([column, value]) => {
    const { testName, subject, isTotal } = parseTestColumn(column);
    if (!testName) return;

    if (!tests[testName]) tests[testName] = {};
    if (isTotal) {
      tests[testName].Total = value;
    } else {
      tests[testName][subject] = value;
    }
  });

  return tests;
}

async function wipeEntireFirestore() {
  const rootCollections = await db.listCollections();
  if (!rootCollections.length) {
    console.log("  ℹ️  Firestore is already empty.");
    return;
  }

  for (const coll of rootCollections) {
    console.log(`  Deleting collection: ${coll.id}`);
    await db.recursiveDelete(coll);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function migrate() {
  console.log("\n===== CSRL → Firebase Migration =====\n");

  // 0. Verify Firestore is reachable
  console.log("→ Checking Firestore connection…");
  try {
    await db.collection("_ping").limit(1).get();
    console.log("  ✅ Firestore connected!\n");
  } catch (e) {
    if (e.code === 5) {
      console.error("\n❌ Firestore database not found!");
      console.error("\n   You need to CREATE the database first:");
      console.error("   1. Go to: https://console.firebase.google.com/project/csrl-store/firestore");
      console.error("   2. Click \"Create database\"");
      console.error("   3. Choose \"Start in production mode\"");
      console.error("   4. Select region: asia-south1 (Mumbai)");
      console.error("   5. Click Enable, then re-run this script.\n");
    } else {
      console.error("\n❌ Firestore connection failed:", e.message);
    }
    process.exit(1);
  }

  if (WIPE_FIRESTORE_FIRST) {
    console.log("→ Wiping entire Firestore database…");
    await wipeEntireFirestore();
    console.log("  ✅ Firestore wiped\n");
  }

  // 1. Create admin Auth user + Firestore profile
  console.log("→ Creating admin user…");
  const adminUid = await createAuthUser(ADMIN_EMAIL, ADMIN_PASSWORD);
  await db.doc(`users/${adminUid}`).set({ role: "admin", name: "Super Admin" }, { merge: true });
  console.log(`  ✅ Admin: ${ADMIN_EMAIL} (uid: ${adminUid})\n`);

  // 2. Process each centre
  for (const [code, centre] of Object.entries(CENTRES)) {
    console.log(`→ Centre: ${code} — ${centre.name}`);

    // 2a. Centre auth user
    const centreUid = await createAuthUser(centre.email, centre.password);
    await db.doc(`users/${centreUid}`).set(
      { role: "centre", name: centre.name, centreCode: code },
      { merge: true }
    );
    console.log(`  ✅ Centre user: ${centre.email}`);

    // 2b. Centre metadata doc
    await db.doc(`centres/${code}`).set({ name: centre.name, code }, { merge: true });

    // 2c. Fetch profiles from Google Sheets
    console.log(`  Fetching profiles…`);
    const profiles = await csvFromUrl(centre.profileUrl);
    console.log(`  → ${profiles.length} profiles`);

    // 2d. Fetch test scores
    console.log(`  Fetching test scores…`);
    const tests = await csvFromUrl(centre.testUrl);
    console.log(`  → ${tests.length} test records`);

    // 2e. Write student profiles to Firestore + create Auth users
    const profileEntries = [];
    let studentCount = 0;

    for (const profile of profiles) {
      const rawRoll = profile["ROLL NO."] || profile["ROLL_KEY"] || "";
      if (!rawRoll.trim()) continue;
      const ROLL_KEY = rawRoll.trim();
      const email    = `${ROLL_KEY.toLowerCase().replace(/\s+/g, "")}@csrl.internal`;
      const pwd      = STUDENT_PASSWORD_FN(ROLL_KEY);
      const name     = profile["STUDENT'S NAME"] || ROLL_KEY;

      // Create Auth user for student
      let studentUid;
      try {
        studentUid = await createAuthUser(email, pwd);
      } catch (e) {
        console.warn(`  ⚠️  Skipping auth for ${ROLL_KEY}: ${e.message}`);
        continue;
      }

      // Firestore users/ doc
      await db.doc(`users/${studentUid}`).set(
        { role: "student", name, rollKey: ROLL_KEY, centreCode: code },
        { merge: true }
      );

      // Prepare student profile doc
      profileEntries.push({
        ref:  db.doc(`students/${ROLL_KEY}`),
        data: { ...profile, ROLL_KEY, centerCode: code },
      });
      studentCount++;
    }

    await batchWrite(profileEntries);
    console.log(`  ✅ ${studentCount} student profiles written`);

    // 2f. Write test scores to Firestore
    const testEntries = [];
    for (const test of tests) {
      const rawRoll = test["ROLL NO."] || test["ROLL_KEY"] || "";
      if (!rawRoll.trim()) continue;
      const ROLL_KEY = rawRoll.trim();
      const nestedTests = buildNestedTests(test);
      testEntries.push({
        ref:  db.doc(`testScores/${ROLL_KEY}`),
        data: { rollKey: ROLL_KEY, centerCode: code, tests: nestedTests },
      });
    }
    await batchWrite(testEntries);
    console.log(`  ✅ ${testEntries.length} test score records written\n`);
  }

  console.log("===== Migration Complete! =====");
  console.log("\nNext steps:");
  console.log("  1. Set Firestore Security Rules in Firebase Console");
  console.log("  2. Copy .env.example → .env and fill in your Firebase config");
  console.log("  3. Run npm run dev in central-app to test login\n");
  process.exit(0);
}

migrate().catch((e) => {
  console.error("\n❌ Migration failed:", e);
  process.exit(1);
});
