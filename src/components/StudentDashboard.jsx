import React, { useState, useEffect } from 'react';
import StudentProfileView from './StudentProfileView';
import { fetchStudentData } from '../api';
import { Loader2 } from 'lucide-react';

export default function StudentDashboard({ auth }) {
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
     return <div className="p-8 text-center text-slate-500 text-lg">No profile data could be fetched for this roll number.</div>;
  }

  return <StudentProfileView profile={data.profiles[0]} studentTests={data.tests[0] || {}} testColumns={data.testColumns} />;
}
