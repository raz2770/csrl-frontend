import Papa from 'papaparse';

const PROFILE_URL = 'https://docs.google.com/spreadsheets/d/1fErV1E2cB9Czhai2IEc4AozQKSDUqb2137aE9elIFpA/export?format=csv&gid=0';
const TEST_URL = 'https://docs.google.com/spreadsheets/d/1fErV1E2cB9Czhai2IEc4AozQKSDUqb2137aE9elIFpA/export?format=csv&gid=2007592928';

export async function fetchAppData() {
  const [profileData, testData] = await Promise.all([
    fetchCsv(PROFILE_URL),
    fetchCsv(TEST_URL)
  ]);

  // Clean data and create relations
  const profiles = profileData.map(p => {
    const rollNo = cleanText(p['ROLL NO.']);
    let photoUrl = p['STUDENT PHOTO URL'];
    if (photoUrl && photoUrl.includes('drive.google.com')) {
      const idMatch = photoUrl.match(/id=([a-zA-Z0-9_-]+)/) || photoUrl.match(/file\/d\/([a-zA-Z0-9_-]+)/);
      if (idMatch && idMatch[1]) {
        photoUrl = `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w1000`;
      }
    }
    return {
      ...p,
      ROLL_KEY: rollNo,
      'STUDENT PHOTO URL': photoUrl
    };
  }).filter(p => p.ROLL_KEY);

  const tests = testData.map(t => {
    const roll = cleanText(t['ROLL']);
    return {
      ...t,
      ROLL_KEY: roll
    };
  }).filter(t => t.ROLL_KEY);

  // Group test marks by test types: CMT, CAT, RMT, FMT
  const testColumns = Object.keys(tests[0] || {}).filter(k => 
    k.includes('CMT') || k.includes('CAT') || k.includes('RMT') || k.includes('FMT')
  );

  return { profiles, tests, testColumns };
}

function fetchCsv(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: (err) => reject(err)
    });
  });
}

function cleanText(text) {
  if (!text) return '';
  return String(text).trim();
}

// Analytics Helpers
export function calculateAnalytics(profiles, tests, testColumns) {
  const totalStudents = profiles.length;
  
  // Calculate average JEE percentile if available
  const jeeScores = tests
    .map(t => parseFloat(t['JEE Main (2026) Phase 1 percentile']))
    .filter(val => !isNaN(val) && val > 0);
  
  const avgJee = jeeScores.length > 0 
    ? (jeeScores.reduce((a,b) => a + b, 0) / jeeScores.length).toFixed(2) 
    : 'N/A';
    
  const highestJee = jeeScores.length > 0 
    ? Math.max(...jeeScores).toFixed(2)
    : 'N/A';

  return { totalStudents, avgJee, highestJee };
}

export function getRankingsByTest(profiles, tests, testKey) {
  const validScores = tests.map(t => {
    const markStr = t[testKey];
    let isAbsent = false;
    if (!markStr || markStr === '0' || markStr.toLowerCase() === 'absent') {
      isAbsent = true;
    }
    const marks = isAbsent ? null : parseFloat(markStr);
    const profile = profiles.find(p => p.ROLL_KEY === t.ROLL_KEY);
    
    return {
      roll: t.ROLL_KEY,
      name: profile ? profile["STUDENT'S NAME"] : t.NAME,
      category: profile ? profile["CATEGORY"] : '',
      photo: profile ? profile["STUDENT PHOTO URL"] : '',
      marks,
      isAbsent
    };
  });

  const attempted = validScores.filter(s => !s.isAbsent && !isNaN(s.marks));
  
  // Sort high to low with tie-break on roll ascending
  attempted.sort((a, b) => {
    if (b.marks !== a.marks) return b.marks - a.marks;
    return a.roll.localeCompare(b.roll);
  });

  const top10 = attempted.slice(0, 10);
  
  // Bottom 10: Sort low to high
  const bottom10 = [...attempted].sort((a, b) => {
    if (a.marks !== b.marks) return a.marks - b.marks;
    return a.roll.localeCompare(b.roll);
  }).slice(0, 10);

  const absentList = validScores.filter(s => s.isAbsent);

  return { top10, bottom10, absentCount: absentList.length, absentList, attemptedCount: attempted.length };
}
