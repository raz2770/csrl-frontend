import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './components/Login';
import StudentDashboard from './components/StudentDashboard';
import CentreDashboard from './components/CentreDashboard';
import AdminDashboard from './components/AdminDashboard';
import { useState, useEffect } from 'react';

export default function App() {
  const [auth, setAuth] = useState(() => {
    const saved = localStorage.getItem('csrl_auth');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (auth) {
      localStorage.setItem('csrl_auth', JSON.stringify(auth));
    } else {
      localStorage.removeItem('csrl_auth');
    }
  }, [auth]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login setAuth={setAuth} />} />
        
        <Route path="/" element={auth ? <Layout auth={auth} setAuth={setAuth} /> : <Navigate to="/login" />}>
          <Route index element={
            auth?.role === 'STUDENT' ? <StudentDashboard auth={auth} /> :
            auth?.role === 'CENTRE' ? <CentreDashboard auth={auth} /> :
            <AdminDashboard auth={auth} />
          } />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
