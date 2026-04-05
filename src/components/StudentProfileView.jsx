import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { UserCircle2, MapPin, Hash, BrainCircuit, Target, BookOpen, User, Calendar, Phone, Award } from 'lucide-react';
import { getJeePercentile } from '../api';

export default function StudentProfileView({ profile, studentTests, testColumns }) {
  const { testList, weakSubject, chartData } = useMemo(() => {
    const testsMap = {};
    const subjectTotals = {};
    const subjectCounts = {};

    testColumns.forEach(col => {
      const parts = col.split(' ');
      let subject = 'Score';
      let testName = col;
      
      if (parts.length > 1) {
        subject = parts[0];
        testName = parts.slice(1).join(' ');
      }
        
      if (!testsMap[testName]) {
        testsMap[testName] = { name: testName, marks: {}, total: 0 };
      }
      
      const rawMark = studentTests[col];
        if (rawMark !== undefined && rawMark !== null && rawMark !== '' && String(rawMark) !== '0' && String(rawMark).toLowerCase() !== 'absent') {
          const m = parseFloat(rawMark);
          if (!isNaN(m)) {
             testsMap[testName].marks[subject] = m;
             testsMap[testName].total += m;
             
             subjectTotals[subject] = (subjectTotals[subject] || 0) + m;
             subjectCounts[subject] = (subjectCounts[subject] || 0) + 1;
          }
        } else {
             testsMap[testName].marks[subject] = 'A';
        }
    });

    const mappedTestList = Object.values(testsMap);
    
    let weakSub = 'N/A';
    let minAvg = Infinity;
    Object.keys(subjectTotals).forEach(sub => {
      const avg = subjectTotals[sub] / subjectCounts[sub];
      if (avg < minAvg && subjectCounts[sub] > 0) {
        minAvg = avg;
        weakSub = sub;
      }
    });

    const mappedChartData = mappedTestList.map(t => ({
      name: t.name,
      ...t.marks,
      Total: t.total
    }));

    return { testList: mappedTestList, weakSubject: weakSub, chartData: mappedChartData };
  }, [studentTests, testColumns]);

  if (!profile) return <div className="p-8 text-center text-slate-500">Loading Profile Data...</div>;

  const photo = profile["STUDENT PHOTO URL"];
  const jeePercentile = getJeePercentile(profile);

  return (
    <div className="space-y-6">
      
      {/* Top Banner Row */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-center gap-6">
        {photo ? (
          <img src={photo} alt={profile["STUDENT'S NAME"]} className="w-32 h-32 rounded-xl object-cover shadow-md border border-slate-200" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-32 h-32 bg-slate-200 rounded-xl flex items-center justify-center text-slate-400">
             <UserCircle2 size={64} />
          </div>
        )}
        <div className="flex-1 text-center md:text-left">
           <h3 className="text-2xl font-bold text-[#0033A0] flex items-center justify-center md:justify-start gap-3">
              {profile["STUDENT'S NAME"] || 'No Name'}
              <span className="bg-[#0033A0] text-xs text-white px-2 py-1 rounded tracking-widest uppercase">{profile.CATEGORY || 'General'}</span>
           </h3>
           <p className="text-slate-500 mt-1 flex items-center justify-center md:justify-start gap-2">
             <Hash size={16}/> Roll No: <strong className="text-slate-700">{profile["ROLL NO."] || profile.ROLL_KEY}</strong> | 
             <MapPin size={16}/> {profile.centerCode || 'Assigned Centre'}
           </p>
           <p className="text-slate-500 mt-1 flex items-center justify-center md:justify-start gap-2">
             <Phone size={16}/> Mobile: {profile["Mobile No."] || 'N/A'}
           </p>
        </div>
        <div className="text-center md:text-right bg-slate-50 p-4 rounded-xl border border-slate-100 min-w-[150px]">
           <div className="text-slate-500 text-sm font-bold flex items-center justify-center md:justify-end gap-1">
               <Award size={16} /> Auto JEE %ile
           </div>
           <div className="text-3xl font-black text-green-600 mt-1">
               {jeePercentile || 'N/A'}
           </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        
        {/* Family & Personal */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
           <h3 className="text-lg font-bold text-slate-800 border-b pb-2 mb-4 flex items-center gap-2"><User size={20} className="text-[#0033A0]" /> Family & Personal Details</h3>
           <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Gender:</span> <span className="font-medium text-slate-800">{profile.GENDER}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">DOB:</span> <span className="font-medium text-slate-800">{profile["DATE OF BIRTH"]}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Father's Name:</span> <span className="font-medium text-slate-800">{profile["FATHER'S NAME"]}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Mother's Name:</span> <span className="font-medium text-slate-800">{profile["MOTHER'S NAME"]}</span></div>
              <div className="pt-2 border-t text-xs text-slate-500 mt-2">
                 <MapPin size={14} className="inline mr-1" />
                 {profile["PARMANENT ADDRESS"] || 'No Address'}, {profile.DISTRICT}, {profile.STATE} - {profile.PINCODE}
              </div>
           </div>
        </div>

        {/* Education History */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
           <h3 className="text-lg font-bold text-slate-800 border-b pb-2 mb-4 flex items-center gap-2"><BookOpen size={20} className="text-[#0033A0]" /> Education History</h3>
           <div className="space-y-4">
              <div className="text-sm bg-slate-50 p-3 rounded-lg border border-slate-100">
                 <div className="font-bold text-[#0033A0] mb-2 border-b border-slate-200 pb-1">10th Details</div>
                 <div className="flex justify-between mt-1"><span className="text-slate-500">School:</span> <span className="font-medium text-right max-w-[200px] truncate" title={profile["10th SCHOOL NAME"]}>{profile["10th SCHOOL NAME"]}</span></div>
                 <div className="flex justify-between mt-1"><span className="text-slate-500">Board:</span> <span className="font-medium">{profile["10th BOARD"]}</span></div>
                 <div className="flex justify-between mt-1"><span className="text-slate-500">Percentage:</span> <span className="font-medium">{profile["10th Precentage"]}</span></div>
              </div>
              <div className="text-sm bg-slate-50 p-3 rounded-lg border border-slate-100">
                 <div className="font-bold text-[#0033A0] mb-2 border-b border-slate-200 pb-1">12th Details</div>
                 <div className="flex justify-between mt-1"><span className="text-slate-500">School:</span> <span className="font-medium text-right max-w-[200px] truncate" title={profile["12th SCHOOL NAME"]}>{profile["12th SCHOOL NAME"]}</span></div>
                 <div className="flex justify-between mt-1"><span className="text-slate-500">Board:</span> <span className="font-medium">{profile["12th BOARD"]}</span></div>
                 <div className="flex justify-between mt-1"><span className="text-slate-500">Percentage:</span> <span className="font-medium">{profile["12th Precentage"]}</span></div>
              </div>
           </div>
        </div>

      </div>

      <div className="grid md:grid-cols-2 gap-6">
          {/* Target & Weak subjects */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-full flex flex-col justify-between">
             <div>
               <h3 className="text-lg font-bold text-slate-800 border-b pb-2 mb-4 flex items-center gap-2"><Target size={20} className="text-green-600" /> Future Targets</h3>
               <div className="mb-6">
                 <div className="text-slate-500 text-sm font-medium">Target College / Branch</div>
                 <div className="text-lg font-bold text-slate-800 mt-1">{profile["FUTURE COLLEGE (TARGET)"] || 'Not Set'}</div>
               </div>
             </div>

             <div>
               <h3 className="text-lg font-bold text-slate-800 border-b pb-2 mb-4 flex items-center gap-2"><BrainCircuit size={20} className="text-red-500" /> Weak Subject Analysis</h3>
               <div className="bg-red-50 p-4 rounded-xl border border-red-100 mb-4">
                 <div className="text-sm font-bold text-red-400 uppercase tracking-widest mb-1">Manual Assessment</div>
                 <div className="text-xl font-bold text-red-700">{profile["WEAK SUBJECT (MANUAL)"] || profile["WEAK SUBJECT"] || 'Not Specified'}</div>
                 {profile["WEAK SUBJECT NOTES"] && <div className="text-sm mt-1 text-red-600">{profile["WEAK SUBJECT NOTES"]}</div>}
               </div>

               <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                 <span className="text-sm font-medium text-slate-600">Auto Detected from Tests:</span>
                 <span className="bg-slate-200 text-slate-800 px-3 py-1 rounded font-bold">{weakSubject}</span>
               </div>
             </div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-72">
             <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Calendar size={20} className="text-[#FFAA00]" /> Performance Trend</h3>
             <div className="h-48">
               <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={chartData}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                   <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                   <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B'}} width={30} />
                   <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                   <Legend />
                   <Line type="monotone" dataKey="Total" stroke="#0033A0" strokeWidth={3} dot={{r: 4, fill: '#0033A0'}} activeDot={{r: 6}} />
                 </LineChart>
               </ResponsiveContainer>
             </div>
          </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
           <h3 className="text-lg font-bold text-slate-800">Complete Test Records</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs w-[30%]">Test Name</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Subject Breakup</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs w-[15%] text-right">Total Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {testList.map((test, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-800 align-middle">{test.name}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2 flex-wrap">
                      {Object.entries(test.marks).map(([sub, mark]) => (
                        <span key={sub} className="bg-white border border-slate-200 px-2 py-1.5 rounded text-xs inline-flex items-center shadow-sm">
                          <span className="text-slate-500 mr-2 font-medium">{sub}:</span>
                          <span className={mark === 'A' ? 'text-red-500 font-bold' : 'font-bold text-[#0033A0]'}>{mark}</span>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-[#0033A0] text-right text-base align-middle">{test.total}</td>
                </tr>
              ))}
              {testList.length === 0 && (
                <tr>
                  <td colSpan="3" className="px-6 py-8 text-center text-slate-500">No test records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
