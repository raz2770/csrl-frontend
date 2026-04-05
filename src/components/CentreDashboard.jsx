import React, { useState, useEffect, useMemo } from 'react';
import { fetchCenterDataApi, getRankingsByTest, calculateAnalytics } from '../api';
import { Search, Trophy, AlertTriangle, Users, BookX, Loader2, TrendingUp, Award, Presentation, PieChart as PieChartIcon, ArrowLeft } from 'lucide-react';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import StudentProfileView from './StudentProfileView';

const PIE_COLORS = ['#0033A0', '#FFAA00', '#10b981', '#f43f5e', '#8b5cf6', '#0ea5e9'];

export default function CentreDashboard({ auth }) {
  const centerCode = auth.id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [viewingStudentId, setViewingStudentId] = useState(null);

  const [selectedTestKey, setSelectedTestKey] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');

  useEffect(() => {
    fetchCenterDataApi(auth.token)
      .then(d => {
        setData(d);
        if (d.testColumns.length > 0) {
          setSelectedTestKey(d.testColumns[d.testColumns.length - 1]);
        }
      })
      .catch(err => setError('Failed to load center data: ' + err.message))
      .finally(() => setLoading(false));
  }, [auth.token]);

  // General Analytics
  const analytics = useMemo(() => {
    if (!data) return { totalStudents: 0, avgJee: 'N/A', highestJee: 'N/A' };
    return calculateAnalytics(data.profiles);
  }, [data]);

  // Weak Subject calc
  const centerWeakSubject = useMemo(() => {
    if (!data) return 'N/A';
    const subjectTotals = {};
    const subjectCounts = {};
    
    data.testColumns.forEach(col => {
      const subject = col.split(' ')[0];
      data.tests.forEach(t => {
        const mark = parseFloat(t[col]);
        if (!isNaN(mark)) {
          subjectTotals[subject] = (subjectTotals[subject] || 0) + mark;
          subjectCounts[subject] = (subjectCounts[subject] || 0) + 1;
        }
      });
    });

    let weakSub = 'N/A';
    let minAvg = Infinity;
    Object.keys(subjectTotals).forEach(sub => {
      const avg = subjectTotals[sub] / subjectCounts[sub];
      if (avg < minAvg && subjectCounts[sub] > 0) {
        minAvg = avg;
        weakSub = sub;
      }
    });
    return weakSub;
  }, [data]);

  // Line Chart: Centre Test Trend (Average of all students per test)
  const centerTrend = useMemo(() => {
    if (!data) return [];
    return data.testColumns.map(testName => {
      let sum = 0;
      let count = 0;
      data.tests.forEach(t => {
        const mark = parseFloat(t[testName]);
        if (!isNaN(mark)) { sum += mark; count++; }
      });
      return {
        name: testName.split('-')[0] || testName, // simplify name
        Average: count > 0 ? parseFloat((sum / count).toFixed(2)) : 0
      };
    });
  }, [data]);

  // Pie Chart: Category Wise averages for selected test
  const categoryAverages = useMemo(() => {
    if (!data || !selectedTestKey) return [];
    const sums = {};
    const counts = {};
    data.tests.forEach(t => {
      const mark = parseFloat(t[selectedTestKey]);
      if (!isNaN(mark)) {
        const profile = data.profiles.find(p => p.ROLL_KEY === t.ROLL_KEY);
        const cat = profile?.CATEGORY || 'General';
        sums[cat] = (sums[cat] || 0) + mark;
        counts[cat] = (counts[cat] || 0) + 1;
      }
    });
    return Object.keys(sums).map(cat => ({
      name: cat,
      value: parseFloat((sums[cat] / counts[cat]).toFixed(2))
    }));
  }, [data, selectedTestKey]);

  // Rankings
  const rankings = useMemo(() => {
    if (!data || !selectedTestKey) return { top10: [], bottom10: [] };
    const { rankedScores } = getRankingsByTest(data.profiles, data.tests, selectedTestKey);
    return {
      top10: rankedScores.slice(0, 10),
      bottom10: [...rankedScores].reverse().slice(0, 10).reverse() // bottom 10 sorted lowest first
    };
  }, [data, selectedTestKey]);

  // Student list search
  const filteredStudents = useMemo(() => {
    if (!data) return [];
    return data.profiles.filter(p => {
      const matchSearch = p["STUDENT'S NAME"]?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.ROLL_KEY.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = filterCategory === 'ALL' || p.CATEGORY === filterCategory;
      return matchSearch && matchCat;
    });
  }, [data, searchTerm, filterCategory]);

  const categories = useMemo(() => {
    const cats = new Set(data?.profiles.map(p => p.CATEGORY).filter(Boolean));
    return ['ALL', ...Array.from(cats)];
  }, [data]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center flex-col gap-4 text-slate-500">
        <Loader2 className="animate-spin text-[#0033A0]" size={48} />
        <p className="font-medium animate-pulse">Loading {auth.name} database...</p>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 p-8 text-center">{error}</div>;
  }

  if (viewingStudentId) {
    const profile = data.profiles.find(p => p.ROLL_KEY === viewingStudentId);
    const studentTests = data.tests.find(t => t.ROLL_KEY === viewingStudentId) || {};
    return (
      <div className="space-y-6 slide-in opacity-0 animate-[fade-in_0.3s_0.1s_forwards]">
        <button onClick={() => setViewingStudentId(null)} className="flex items-center gap-2 text-slate-500 hover:text-[#0033A0] font-bold text-sm transition-colors border border-slate-200 bg-white px-4 py-2 rounded-lg shadow-sm w-fit">
           <ArrowLeft size={16} /> Back to Centre Dashboard
        </button>
        <StudentProfileView profile={profile} studentTests={studentTests} testColumns={data.testColumns} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-2">
        <h2 className="text-2xl font-bold text-slate-800">{auth.name} Operations Dashboard</h2>
        <div className="bg-slate-100 px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 flex items-center gap-2">
           <Users size={18} /> {data.profiles.length} Students
        </div>
      </div>
      
      {/* Centre Analytics Overview */}
      <div className="grid md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center gap-2">
              <div className="text-slate-500 font-bold flex items-center gap-2">
                  <Users size={18} className="text-[#0033A0]" /> <span>Total Enrolled</span>
              </div>
              <div className="text-3xl font-bold text-[#0033A0]">{analytics.totalStudents}</div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center gap-2">
              <div className="text-slate-500 font-bold flex items-center gap-2">
                  <TrendingUp size={18} className="text-[#FFAA00]" /> <span>Centre Avg JEE</span>
              </div>
              <div className="text-3xl font-bold text-[#FFAA00]">{analytics.avgJee}</div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center gap-2">
              <div className="text-slate-500 font-bold flex items-center gap-2">
                  <Award size={18} className="text-green-500" /> <span>Centre Top JEE</span>
              </div>
              <div className="text-3xl font-bold text-green-600">{analytics.highestJee}</div>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-orange-50 p-6 rounded-2xl shadow-sm border border-red-100 flex flex-col justify-center gap-2">
              <div className="text-red-500 font-bold flex items-center gap-2">
                  <BookX size={18} /> <span>Weakest Subject</span>
              </div>
              <div className="text-2xl font-bold text-red-600">{centerWeakSubject}</div>
              <div className="text-xs text-red-400">Lowest average across all tests</div>
          </div>
      </div>

      <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
         <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Presentation size={20} className="text-[#0033A0]" /> Centre Analysis Module
         </h3>
         <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-600">Select Test Filter:</label>
            <select 
              className="bg-slate-50 border border-slate-300 text-slate-700 rounded-lg px-3 py-1.5 outline-none font-medium text-sm focus:ring-2 focus:ring-[#0033A0]"
              value={selectedTestKey}
              onChange={(e) => setSelectedTestKey(e.target.value)}
            >
              {data.testColumns.map(col => <option key={col} value={col}>{col}</option>)}
            </select>
         </div>
      </div>

      {/* Advanced Charts Section */}
      <div className="grid md:grid-cols-2 gap-6">
        
        {/* Centre Trend Line Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-80">
           <h3 className="text-sm font-bold text-slate-600 uppercase tracking-widest mb-4 flex items-center gap-2">
             <TrendingUp size={16}/> Class Performance Trend
           </h3>
           <ResponsiveContainer width="100%" height="100%">
             <LineChart data={centerTrend} margin={{ top: 0, right: 0, left: -20, bottom: 20 }}>
               <CartesianGrid strokeDasharray="3 3" vertical={false} />
               <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748B'}} angle={-45} textAnchor="end" />
               <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748B'}} />
               <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
               <Line type="monotone" dataKey="Average" stroke="#0033A0" strokeWidth={3} dot={{r: 4, fill: '#0033A0'}} activeDot={{r: 6}} />
             </LineChart>
           </ResponsiveContainer>
        </div>

        {/* Category Pie Chart & Top Ranks inline */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-80 flex flex-col">
           <h3 className="text-sm font-bold text-slate-600 uppercase tracking-widest mb-4 flex items-center gap-2"><PieChartIcon size={16}/> Test Averages by Category</h3>
           <div className="flex-1 flex items-center justify-center -mt-6">
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie data={categoryAverages} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label={({name, value}) => `${name}: ${value}`}>
                   {categoryAverages.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                   ))}
                 </Pie>
                 <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                 <Legend verticalAlign="bottom" height={20} />
               </PieChart>
             </ResponsiveContainer>
           </div>
        </div>
      </div>

      {/* Test Rankings */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-[#0033A0] text-white">
           <h3 className="text-lg font-bold flex items-center gap-2">
             <Trophy size={20} className="text-[#FFAA00]" />
             Centre Subject Honours List
           </h3>
           <span className="bg-white/20 px-3 py-1 text-sm font-semibold rounded-full">{selectedTestKey}</span>
        </div>

        <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          {/* Top 10 */}
          <div className="p-4 bg-white">
            <h4 className="font-bold text-[#0033A0] mb-4 flex items-center gap-2 bg-blue-50 p-2 rounded">Honours List (Top 10)</h4>
            <div className="space-y-2">
               {rankings.top10.map((s, idx) => (
                 <div key={s.roll} className="flex justify-between items-center text-sm p-2 hover:bg-slate-50 rounded transition-colors">
                   <div className="flex items-center gap-3">
                     <span className={`w-5 text-center font-bold ${idx < 3 ? 'text-[#FFAA00]' : 'text-slate-400'}`}>{idx+1}</span>
                     <div>
                       <p className="font-bold text-slate-700">{s.name}</p>
                       <p className="text-xs text-slate-400">{s.roll}</p>
                     </div>
                   </div>
                   <span className="font-bold bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs shadow-sm border border-green-200">{s.marks}</span>
                 </div>
               ))}
               {rankings.top10.length === 0 && <p className="text-sm text-slate-500 py-4 text-center">No test data available.</p>}
            </div>
          </div>

          {/* Bottom 10 */}
          <div className="p-4 bg-white">
            <h4 className="font-bold text-red-600 mb-4 flex items-center gap-2 bg-red-50 p-2 rounded"><AlertTriangle size={16}/> Academic Watch (Bottom 10)</h4>
             <div className="space-y-2">
               {rankings.bottom10.map((s, idx) => (
                 <div key={s.roll} className="flex justify-between items-center text-sm p-2 hover:bg-slate-50 rounded transition-colors">
                   <div className="flex items-center gap-3">
                     <span className="w-5 text-center font-bold text-slate-300">-</span>
                     <div>
                       <p className="font-bold text-slate-700">{s.name}</p>
                       <p className="text-xs text-slate-400">{s.roll}</p>
                     </div>
                   </div>
                   <span className="font-bold bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs shadow-sm border border-red-200">{s.marks}</span>
                 </div>
               ))}
               {rankings.bottom10.length === 0 && <p className="text-sm text-slate-500 py-4 text-center">No test data available.</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Student List & Search */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
         <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50">
            <h3 className="text-lg font-bold text-slate-800">Student Directory / CRM</h3>
            <div className="flex gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search by name or roll no..."
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#0033A0] focus:ring-1 focus:ring-[#0033A0] transition-colors"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                className="bg-white border border-slate-200 text-sm rounded-lg px-3 py-2 outline-none focus:border-[#0033A0] transition-colors"
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
         </div>
         <div className="overflow-x-auto custom-scrollbar max-h-[500px]">
            <table className="w-full text-left text-sm relative">
              <thead className="bg-[#f8fafc] text-slate-600 sticky top-0 shadow-sm z-10">
                <tr>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Roll No</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Student Name</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Category</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((s, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-600">{s.ROLL_KEY}</td>
                    <td className="px-6 py-4 font-medium text-slate-800 flex items-center gap-3">
                      {s['STUDENT PHOTO URL'] ? 
                        <img src={s['STUDENT PHOTO URL']} className="w-8 h-8 rounded-full bg-slate-200 object-cover border border-slate-200 shadow-sm" alt="Pic" referrerPolicy="no-referrer" /> : 
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 border border-slate-200 shadow-sm"><Users size={14}/></div>
                      }
                      {s["STUDENT'S NAME"]}
                    </td>
                    <td className="px-6 py-4">
                       <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded text-xs tracking-wide font-medium border border-slate-200">
                         {s.CATEGORY || 'GENERAL'}
                       </span>
                    </td>
                    <td className="px-6 py-4">
                      <button onClick={() => setViewingStudentId(s.ROLL_KEY)} className="bg-[#0033A0] hover:bg-[#002277] text-white px-3 py-1.5 rounded text-xs font-bold shadow-sm transition-colors cursor-pointer">
                         View Details
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredStudents.length === 0 && (
                  <tr><td colSpan="3" className="px-6 py-12 text-center text-slate-500">No students found matching your criteria.</td></tr>
                )}
              </tbody>
            </table>
         </div>
      </div>

    </div>
  );
}
