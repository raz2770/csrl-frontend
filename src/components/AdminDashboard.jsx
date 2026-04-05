import React, { useState, useEffect, useMemo } from 'react';
import { fetchGlobalData, getRankingsByTest, calculateAnalytics } from '../api';
import { Search, Trophy, AlertTriangle, Users, MapPin, Loader2, TrendingUp, Award, BarChart3, Presentation, PieChart as PieChartIcon, ArrowLeft } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import StudentProfileView from './StudentProfileView';

const PIE_COLORS = ['#0033A0', '#FFAA00', '#10b981', '#f43f5e', '#8b5cf6', '#0ea5e9'];

export default function AdminDashboard({ auth }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [viewingStudentId, setViewingStudentId] = useState(null);

  const [selectedTestKey, setSelectedTestKey] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterCenter, setFilterCenter] = useState('ALL');

  useEffect(() => {
    fetchGlobalData(auth.token)
      .then(d => {
        setData(d);
        if (d.testColumns && d.testColumns.length > 0) {
          setSelectedTestKey(d.testColumns[d.testColumns.length - 1]);
        }
      })
      .catch(err => setError('Failed to load global data: ' + err.message))
      .finally(() => setLoading(false));
  }, []);

  // Global Analytics Summary
  const analytics = useMemo(() => {
    if (!data) return { totalStudents: 0, avgJee: 'N/A', highestJee: 'N/A' };
    return calculateAnalytics(data.profiles);
  }, [data]);

  // Rankings (Top 30 / Bottom 30)
  const rankings = useMemo(() => {
    if (!data || !selectedTestKey) return { top30: [], bottom30: [] };
    const { rankedScores } = getRankingsByTest(data.profiles, data.tests, selectedTestKey);
    return {
      top30: rankedScores.slice(0, 30),
      bottom30: [...rankedScores].reverse().slice(0, 30).reverse()
    };
  }, [data, selectedTestKey]);

  // Chart 1: Center Comparison Averages
  const centerAverages = useMemo(() => {
    if (!data || !selectedTestKey) return [];
    const centerSums = {};
    const centerCounts = {};
    data.tests.forEach(t => {
      const mark = parseFloat(t[selectedTestKey]);
      if (!isNaN(mark)) {
        const c = t.centerCode || 'Unknown';
        centerSums[c] = (centerSums[c] || 0) + mark;
        centerCounts[c] = (centerCounts[c] || 0) + 1;
      }
    });
    return Object.keys(centerSums).map(c => ({
      name: c,
      Average: parseFloat((centerSums[c] / centerCounts[c]).toFixed(2))
    })).sort((a,b) => b.Average - a.Average);
  }, [data, selectedTestKey]);

  // Chart 2: Global Trend across tests
  const globalTrend = useMemo(() => {
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

  // Chart 3: Category Wise averages
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

  // Filters
  const filteredStudents = useMemo(() => {
    if (!data) return [];
    return data.profiles.filter(p => {
      const matchSearch = p["STUDENT'S NAME"]?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.ROLL_KEY.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = filterCategory === 'ALL' || p.CATEGORY === filterCategory;
      const matchCenter = filterCenter === 'ALL' || p.centerCode === filterCenter;
      return matchSearch && matchCat && matchCenter;
    });
  }, [data, searchTerm, filterCategory, filterCenter]);

  const categories = useMemo(() => {
    const cats = new Set(data?.profiles.map(p => p.CATEGORY).filter(Boolean));
    return ['ALL', ...Array.from(cats)];
  }, [data]);

  const centersList = useMemo(() => {
    const cts = new Set(data?.profiles.map(p => p.centerCode).filter(Boolean));
    return ['ALL', ...Array.from(cts)];
  }, [data]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center flex-col gap-4 text-slate-500">
        <Loader2 className="animate-spin text-[#0033A0]" size={48} />
        <p className="font-medium animate-pulse">Aggregating Global CSRL Database...</p>
      </div>
    );
  }

  if (error) return <div className="text-red-500 p-8 text-center">{error}</div>;

  if (viewingStudentId) {
    const profile = data.profiles.find(p => p.ROLL_KEY === viewingStudentId);
    const studentTests = data.tests.find(t => t.ROLL_KEY === viewingStudentId) || {};
    return (
      <div className="space-y-6 slide-in opacity-0 animate-[fade-in_0.3s_0.1s_forwards]">
        <button onClick={() => setViewingStudentId(null)} className="flex items-center gap-2 text-slate-500 hover:text-[#0033A0] font-bold text-sm transition-colors border border-slate-200 bg-white px-4 py-2 rounded-lg shadow-sm w-fit">
           <ArrowLeft size={16} /> Back to Global Dashboard
        </button>
        <StudentProfileView profile={profile} studentTests={studentTests} testColumns={data.testColumns} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-2">
        <h2 className="text-2xl font-bold text-slate-800">Super Admin Dashboard</h2>
        <div className="bg-slate-100 px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 flex items-center gap-2">
           <MapPin size={18}/> {centersList.length - 1} Centres
        </div>
      </div>

      {/* Global Analytics Overview */}
      <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
              <div className="text-slate-500 font-bold flex items-center gap-2 mb-2">
                  <Users size={20} className="text-[#0033A0]" /> <span>Total Enrolled</span>
              </div>
              <div className="text-3xl font-bold text-[#0033A0]">{analytics.totalStudents}</div>
              <div className="text-xs text-slate-400 mt-2">Across all integrated centres</div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
              <div className="text-slate-500 font-bold flex items-center gap-2 mb-2">
                  <TrendingUp size={20} className="text-[#FFAA00]" /> <span>Average Global JEE %ile</span>
              </div>
              <div className="text-3xl font-bold text-[#FFAA00]">{analytics.avgJee}</div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
              <div className="text-slate-500 font-bold flex items-center gap-2 mb-2">
                  <Award size={20} className="text-green-500" /> <span>Highest Recorded %ile</span>
              </div>
              <div className="text-3xl font-bold text-green-600">{analytics.highestJee}</div>
          </div>
      </div>

      <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center gap-4">
         <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Presentation size={20} className="text-[#0033A0]" /> Visual Analytics
         </h3>
         <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-600">Analyze Test:</label>
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
        
        {/* Centre Bar Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-80">
           <h3 className="text-sm font-bold text-slate-600 uppercase tracking-widest mb-4">Centre Leaderboard (Average)</h3>
           <ResponsiveContainer width="100%" height="100%">
             <BarChart data={centerAverages} margin={{ top: 0, right: 0, left: -20, bottom: 20 }}>
               <CartesianGrid strokeDasharray="3 3" vertical={false} />
               <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748B'}} angle={centerAverages.length > 5 ? -45 : 0} textAnchor={centerAverages.length > 5 ? "end" : "middle"} />
               <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748B'}} />
               <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
               <Bar dataKey="Average" fill="#0033A0" radius={[4, 4, 0, 0]} />
             </BarChart>
           </ResponsiveContainer>
        </div>

        {/* Global Trend Line Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-80">
           <h3 className="text-sm font-bold text-slate-600 uppercase tracking-widest mb-4">Global Network Trend</h3>
           <ResponsiveContainer width="100%" height="100%">
             <LineChart data={globalTrend} margin={{ top: 0, right: 0, left: -20, bottom: 20 }}>
               <CartesianGrid strokeDasharray="3 3" vertical={false} />
               <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748B'}} angle={-45} textAnchor="end" />
               <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748B'}} />
               <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
               <Line type="monotone" dataKey="Average" stroke="#FFAA00" strokeWidth={3} dot={{r: 4, fill: '#FFAA00'}} activeDot={{r: 6}} />
             </LineChart>
           </ResponsiveContainer>
        </div>

        {/* Category Pie Chart & Top Ranks inline */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-80 flex flex-col">
           <h3 className="text-sm font-bold text-slate-600 uppercase tracking-widest mb-4 flex items-center gap-2"><PieChartIcon size={16}/> Category Average Distribution</h3>
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

        {/* Info Metric Space */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-80 flex flex-col justify-center gap-8 text-center bg-gradient-to-br from-blue-50 to-orange-50">
           <div>
             <div className="text-slate-500 font-bold uppercase tracking-widest text-sm mb-2">Total Attempted ({selectedTestKey})</div>
             <div className="text-4xl font-black text-slate-800">{rankings.top30.length + rankings.bottom30.length > 50 ? `${rankings.top30.length + rankings.bottom30.length}+` : rankings.top30.length + rankings.bottom30.length}</div>
           </div>
           <div>
             <div className="text-slate-500 font-bold uppercase tracking-widest text-sm mb-2">Top Performer</div>
             <div className="text-2xl font-bold text-[#0033A0]">{rankings.top30[0]?.name || 'N/A'}</div>
             <div className="text-sm text-slate-600">{rankings.top30[0]?.marks || '0'} Points</div>
           </div>
        </div>

      </div>

      {/* Global Rankings Dashboard */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-[#0033A0] text-white">
           <h3 className="text-lg font-bold flex items-center gap-2">
             <Trophy size={20} className="text-[#FFAA00]" />
             Student Leaderboards
           </h3>
           <span className="bg-white/20 px-3 py-1 text-sm font-semibold rounded-full">{selectedTestKey}</span>
        </div>

        <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          {/* Top 30 */}
          <div className="p-4 bg-white">
            <h4 className="font-bold text-[#0033A0] mb-4 flex items-center gap-2 bg-blue-50 p-2 rounded">Global Top 30 Performers</h4>
            <div className="space-y-2 h-[400px] overflow-y-auto pr-2 custom-scrollbar">
               {rankings.top30.map((s, idx) => (
                 <div key={`${s.roll}-${idx}`} className="flex justify-between items-center text-sm p-3 hover:bg-slate-50 rounded border border-transparent hover:border-slate-100 transition-colors">
                   <div className="flex items-center gap-3">
                     <span className={`w-6 text-center font-bold ${idx<3?'text-[#FFAA00] text-lg':'text-slate-400'}`}>{idx+1}</span>
                     <div>
                       <p className="font-bold text-slate-700">{s.name}</p>
                       <div className="flex items-center gap-2 mt-0.5">
                         <span className="text-xs text-slate-500">{s.roll}</span>
                         <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-medium text-slate-600 border border-slate-200">{s.center}</span>
                       </div>
                     </div>
                   </div>
                   <span className="font-bold bg-green-100 border border-green-200 text-green-700 px-3 py-1 rounded-full shadow-sm text-xs">{s.marks}</span>
                 </div>
               ))}
               {rankings.top30.length===0 && <p className="text-sm text-slate-500 text-center py-4">No data</p>}
            </div>
          </div>

          {/* Bottom 30 */}
          <div className="p-4 bg-white">
            <h4 className="font-bold text-red-600 mb-4 flex items-center gap-2 bg-red-50 p-2 rounded"><AlertTriangle size={16}/> Needs Immediate Attention (Bottom 30)</h4>
             <div className="space-y-2 h-[400px] overflow-y-auto pr-2 custom-scrollbar">
               {rankings.bottom30.map((s, idx) => (
                 <div key={`${s.roll}-${idx}`} className="flex justify-between items-center text-sm p-3 hover:bg-slate-50 rounded border border-transparent hover:border-slate-100 transition-colors">
                   <div className="flex items-center gap-3">
                     <div>
                       <p className="font-bold text-slate-700">{s.name}</p>
                       <div className="flex items-center gap-2 mt-0.5">
                         <span className="text-xs text-slate-500">{s.roll}</span>
                         <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-medium text-slate-600 border border-slate-200">{s.center}</span>
                       </div>
                     </div>
                   </div>
                   <span className="font-bold bg-red-100 border border-red-200 text-red-700 px-3 py-1 rounded-full shadow-sm text-xs">{s.marks}</span>
                 </div>
               ))}
               {rankings.bottom30.length===0 && <p className="text-sm text-slate-500 text-center py-4">No data</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Global Student Directory */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
         <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <h3 className="text-lg font-bold text-slate-800">Global Student Database</h3>
            <div className="flex flex-wrap gap-3 w-full md:w-auto">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Query Name or Roll No"
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#0033A0] focus:ring-1 focus:ring-[#0033A0] transition-colors"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                className="bg-slate-50 border border-slate-200 text-sm rounded-lg px-3 py-2 outline-none focus:border-[#0033A0] transition-colors"
                value={filterCenter}
                onChange={e => setFilterCenter(e.target.value)}
              >
                <option value="ALL">All Centres</option>
                {centersList.filter(c => c !== 'ALL').map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select
                className="bg-slate-50 border border-slate-200 text-sm rounded-lg px-3 py-2 outline-none focus:border-[#0033A0] transition-colors"
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
              >
                <option value="ALL">All Categories</option>
                {categories.filter(c => c !== 'ALL').map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
         </div>
         <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
            <table className="w-full text-left text-sm relative">
              <thead className="bg-[#f8fafc] text-slate-600 sticky top-0 shadow-sm z-10">
                <tr>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Roll No</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Student Name</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Centre</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Category</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((s, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-600">{s.ROLL_KEY}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{s["STUDENT'S NAME"]}</td>
                    <td className="px-6 py-4 font-semibold text-[#0033A0]">{s.centerCode}</td>
                    <td className="px-6 py-4">
                       <span className="bg-slate-100 border border-slate-200 text-slate-600 px-2.5 py-1 rounded text-xs tracking-wide font-medium">
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
                  <tr><td colSpan="4" className="px-6 py-12 text-center text-slate-500">No students found matching your criteria.</td></tr>
                )}
              </tbody>
            </table>
         </div>
      </div>
    </div>
  );
}
