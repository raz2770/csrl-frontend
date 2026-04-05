const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export async function loginApi(credentials) {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  });
  if (!res.ok) throw new Error('Invalid credentials');
  return res.json();
}

function getHeaders(token) {
  return { 'Authorization': `Bearer ${token}` };
}

export async function fetchGlobalData(token) {
  const res = await fetch(`${API_BASE_URL}/data/global`, { headers: getHeaders(token) });
  if (!res.ok) throw new Error('API Request Failed');
  return res.json();
}

export async function fetchCenterDataApi(token) {
  const res = await fetch(`${API_BASE_URL}/data/center`, { headers: getHeaders(token) });
  if (!res.ok) throw new Error('API Request Failed');
  return res.json();
}

export async function fetchStudentData(token) {
  const res = await fetch(`${API_BASE_URL}/data/student`, { headers: getHeaders(token) });
  if (!res.ok) throw new Error('API Request Failed');
  return res.json();
}

export function getRankingsByTest(profiles, tests, testKey) {
  const testScores = [];
  profiles.forEach(p => {
    const studentTest = tests.find(t => t.ROLL_KEY === p.ROLL_KEY);
    if (!studentTest) return;
    const markStr = studentTest[testKey];
    if (markStr && markStr.toLowerCase() !== 'absent' && markStr !== '') {
      const mark = parseFloat(markStr);
      if (!isNaN(mark)) {
        testScores.push({ 
          roll: p.ROLL_KEY, 
          name: p["STUDENT'S NAME"], 
          marks: mark,
          center: p.centerCode 
        });
      }
    }
  });
  testScores.sort((a, b) => b.marks - a.marks);
  return { rankedScores: testScores };
}

export function getJeePercentile(obj) {
  if (!obj) return null;
  const key = Object.keys(obj).find(k => k.toLowerCase().includes('jee main') && k.toLowerCase().includes('percentile'));
  return key ? obj[key] : null;
}

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
