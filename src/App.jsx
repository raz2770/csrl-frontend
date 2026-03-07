import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { fetchAppData, calculateAnalytics } from './api';

// Components
import Login from './screens/Login';
import AdminDashboard from './screens/AdminDashboard';
import StudentList from './screens/StudentList';
import StudentProfile from './screens/StudentProfile';
import Navbar from './components/Navbar';

function App() {
  const [data, setData] = useState({ profiles: [], tests: [], testColumns: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Auth state: role can be 'admin', 'student', or null
  const [auth, setAuth] = useState({ role: null, rollNo: null });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchAppData();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Auto-refresh every 5 minutes
    const intervalId = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, []);

  if (loading && data.profiles.length === 0) {
    return <div className="app-container"><div className="spinner"></div></div>;
  }

  if (error) {
    return <div className="app-container"><div className="card text-center"><h2 className="text-danger">Error Loading Data</h2><p>{error}</p><button className="btn" onClick={loadData}>Retry</button></div></div>;
  }

  const { profiles, tests, testColumns } = data;
  const analytics = calculateAnalytics(profiles, tests, testColumns);

  return (
    <BrowserRouter>
      <div className="app-container">
        {auth.role && <Navbar auth={auth} setAuth={setAuth} onRefresh={loadData} />}

        <main className="main-content">
          <Routes>
            <Route
              path="/login"
              element={!auth.role ? <Login onLogin={setAuth} profiles={profiles} /> : <Navigate to={auth.role === 'admin' ? '/admin' : `/profile/${auth.rollNo}`} />}
            />

            {/* Admin Routes */}
            <Route
              path="/admin"
              element={auth.role === 'admin' ? <AdminDashboard profiles={profiles} tests={tests} testColumns={testColumns} analytics={analytics} /> : <Navigate to="/login" />}
            />
            <Route
              path="/students"
              element={auth.role === 'admin' ? <StudentList profiles={profiles} /> : <Navigate to="/login" />}
            />

            {/* Student/Profile Route */}
            <Route
              path="/profile/:id"
              element={auth.role ? <StudentProfile profiles={profiles} tests={tests} testColumns={testColumns} auth={auth} /> : <Navigate to="/login" />}
            />

            <Route path="*" element={<Navigate to="/login" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
