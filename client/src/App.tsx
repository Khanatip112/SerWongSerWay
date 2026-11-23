import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import Navbar from './components/Navbar.js';
import LoginPage from './pages/LoginPage.js';
import CampaignsPage from './pages/CampaignsPage.js';
import CreateCampaignPage from './pages/CreateCampaignPage.js';
import RespondPage from './pages/RespondPage.js';
import ResultsPage from './pages/ResultsPage.js';

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({
  children,
  allowedRoles,
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>
        Loading session...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/campaigns" replace />;
  }

  return <>{children}</>;
};

const RootRedirect: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>
        Loading...
      </div>
    );
  }

  return <Navigate to={user ? '/campaigns' : '/login'} replace />;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <Navbar />
          <div
          style={{
              textAlign: 'center',
              padding: '8px',
              backgroundColor: '#EAF6EF',
              color: '#006B3C',
              fontSize: '14px',
              fontWeight: 600,
               }}
              >
                Release Demo v2 — Automatically Deployed
              </div>

              <main style={{ flex: 1, backgroundColor: 'var(--color-bg-page)' }}></main>
          <main style={{ flex: 1, backgroundColor: 'var(--color-bg-page)' }}>
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/campaigns"
                element={
                  <ProtectedRoute>
                    <CampaignsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/campaigns/new"
                element={
                  <ProtectedRoute allowedRoles={['CREATOR']}>
                    <CreateCampaignPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/campaigns/:id/respond"
                element={
                  <ProtectedRoute allowedRoles={['RESPONDENT']}>
                    <RespondPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/campaigns/:id/results"
                element={
                  <ProtectedRoute allowedRoles={['CREATOR']}>
                    <ResultsPage />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
