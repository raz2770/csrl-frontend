/**
 * Replace testScores collection from Google Sheets test URLs.
 *
 * This script DELETES existing testScores docs, then imports fresh rows
 * from configured centre test sheets.
 *
 * Run:
 *   node scripts/replace-testscores-from-sheets.js
 */

import admin from "firebase-admin";
import Papa from "papaparse";
import fetch from "node-fetch";
import { readFileSync } from "fs";
import process from "node:process";

const CENTRES = {
  GAIL: {
    profileUrl: "https://docs.google.com/spreadsheets/d/1fErV1E2cB9Czhai2IEc4AozQKSDUqb2137aE9elIFpA/export?format=csv&gid=0",
    testUrl: "https://docs.google.com/spreadsheets/d/1eUe6oDfhU7tpNoS3Ha6F8AGbgBfb-YjZGLFWDtOcLaA/export?format=csv&gid=1941021239",
  },
  OIL_INDIA: {
    profileUrl: "https://docs.google.com/spreadsheets/d/15U2fY_4nyaSL7_-CRvsTmcfDGyWk_NWuAsEgSFZFQWQ/export?format=csv&gid=352406722",
    testUrl: "https://docs.google.com/spreadsheets/d/1eUe6oDfhU7tpNoS3Ha6F8AGbgBfb-YjZGLFWDtOcLaA/export?format=csv&gid=1185269559",
  },
};

const serviceAccount = JSON.parse(
  readFileSync(new URL("./serviceAccountKey.json", import.meta.url))
);

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

function chunk(arr, size = 450) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function csvFromUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch CSV (${res.status})`);
  const text = await res.text();
  const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
  return data;
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
    if (value === undefined || value === null || value === "") return;
    cleaned[key] = value;
  });

  return cleaned;
}

function extractRoll(row) {
  const raw = row["ROLL"] || row["ROLL NO."] || row["ROLL NO"] || row["ROLL_KEY"] || row["ROLL_NUMBER"] || "";
  return String(raw).trim();
}

function extractPhotoUrl(row) {
  const candidateKeys = [
    "STUDENT PHOTO URL",
    "PHOTO URL",
    "PHOTO",
    "IMAGE URL",
    "IMAGE",
    "PHOTO_LINK",
    "PHOTO LINK",
    "IMG",
  ];

  for (const key of candidateKeys) {
    const val = row[key];
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      return normalizePhotoUrl(String(val).trim());
    }
  }

  // Fallback: try fuzzy key matching.
  for (const [k, v] of Object.entries(row || {})) {
    if (!v) continue;
    const norm = String(k).toLowerCase();
    if ((norm.includes("photo") || norm.includes("image") || norm.includes("img")) && norm.includes("url")) {
      return normalizePhotoUrl(String(v).trim());
    }
  }

  return "";
}

function extractGoogleDriveId(url) {
  const text = String(url || "");

  // 1) https://drive.google.com/file/d/<id>/view
  const m1 = text.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];

  // 2) https://drive.google.com/uc?export=view&id=<id>
  const m2 = text.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];

  // 3) bare id pasted accidentally
  if (/^[a-zA-Z0-9_-]{20,}$/.test(text)) return text;

  return "";
}

function normalizePhotoUrl(url) {
  const driveId = extractGoogleDriveId(url);
  if (!driveId) return url;

  // Thumbnail endpoint is generally more stable for embedding in web apps.
  return `https://drive.google.com/thumbnail?id=${driveId}&sz=w1000`;
}

async function deleteAllTestScores() {
  const snap = await db.collection("testScores").get();
  if (snap.empty) return 0;

  const refs = snap.docs.map((d) => d.ref);
  for (const refChunk of chunk(refs)) {
    const batch = db.batch();
    refChunk.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }

  return refs.length;
}

async function writeTestScores(entries) {
  for (const entryChunk of chunk(entries)) {
    const batch = db.batch();
    entryChunk.forEach(({ rollKey, data }) => {
      batch.set(db.doc(`testScores/${rollKey}`), data, { merge: false });
    });
    await batch.commit();
  }
}

async function upsertStudentPhotos(entries) {
  for (const entryChunk of chunk(entries)) {
    const batch = db.batch();
    entryChunk.forEach(({ rollKey, photoUrl }) => {
      batch.set(
        db.doc(`students/${rollKey}`),
        { "STUDENT PHOTO URL": photoUrl },
        { merge: true }
      );
    });
    await batch.commit();
  }
}

async function main() {
  console.log("\n===== Replace Firestore testScores from Sheets =====");

  const deletedCount = await deleteAllTestScores();
  console.log(`Deleted old testScores docs: ${deletedCount}`);

  const mergedByRoll = new Map();

  for (const [centreCode, centre] of Object.entries(CENTRES)) {
    console.log(`Fetching tests for ${centreCode}...`);
    const rows = await csvFromUrl(centre.testUrl);
    console.log(`  Rows fetched: ${rows.length}`);

    for (const row of rows) {
      const rollKey = extractRoll(row);
      if (!rollKey) continue;

      const cleaned = sanitizeTestRecord(row);
      const existing = mergedByRoll.get(rollKey) || {};
      mergedByRoll.set(rollKey, { ...existing, ...cleaned });
    }
  }

  const entries = Array.from(mergedByRoll.entries()).map(([rollKey, data]) => ({ rollKey, data }));
  await writeTestScores(entries);

  console.log(`Written fresh testScores docs: ${entries.length}`);

  // Sync student photo URLs from profile sheets.
  const photosByRoll = new Map();
  for (const [centreCode, centre] of Object.entries(CENTRES)) {
    console.log(`Fetching profiles for ${centreCode} (images)...`);
    const rows = await csvFromUrl(centre.profileUrl);
    console.log(`  Profile rows fetched: ${rows.length}`);

    for (const row of rows) {
      const rollKey = extractRoll(row);
      if (!rollKey) continue;
      const photoUrl = extractPhotoUrl(row);
      if (!photoUrl) continue;
      photosByRoll.set(rollKey, photoUrl);
    }
  }

  const photoEntries = Array.from(photosByRoll.entries()).map(([rollKey, photoUrl]) => ({ rollKey, photoUrl }));
  await upsertStudentPhotos(photoEntries);
  console.log(`Updated student photos: ${photoEntries.length}`);

  console.log("Done. Old test data omitted and replaced.");
}

main().catch((err) => {
  console.error("\nReplace failed:", err);
  process.exit(1);
});
