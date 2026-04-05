import React, { useState, useEffect } from 'react';
import StudentProfileView from './StudentProfileView';
import { fetchStudentData } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function StudentDashboard() {
  const { user: auth } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudentData(auth.token)
      .then(d => setData(d))
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, [auth.token]);

  if (loading) return (
     <div className="flex h-64 items-center justify-center flex-col gap-4 text-slate-500">
        <Loader2 className="animate-spin text-[#0033A0]" size={48} />
        <p className="font-medium animate-pulse">Safely fetching student records layer...</p>
     </div>
  );

  if (!data || !data.profiles || data.profiles.length === 0) {
    return <div style={{ padding:'32px', textAlign:'center', color:'var(--gray-400)', fontSize:15 }}>No profile data found for this roll number.</div>;
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1>👤 My Profile</h1>
          <p>{data.profiles[0]?.["STUDENT'S NAME"]} · {auth.id}</p>
        </div>
      </div>
      <div className="content">
        <StudentProfileView profile={data.profiles[0]} studentTests={data.tests[0] || {}} testColumns={data.testColumns} />
      </div>
    </div>
  );
}
