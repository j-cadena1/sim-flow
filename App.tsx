import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { SimFlowProvider } from './contexts/SimFlowContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';
import { ModalProvider } from './components/Modal';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { NewRequest } from './components/NewRequest';
import { RequestList } from './components/RequestList';
import { RequestDetail } from './components/RequestDetail';
import { Projects } from './components/Projects';
import { Settings } from './components/Settings';
import Analytics from './components/Analytics';
import Login from './components/Login';
import { createQueryClient } from './lib/api/queryConfig';

// Create React Query client with optimized caching configuration
const queryClient = createQueryClient();

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-slate-950">
      <Sidebar />
      <div className="flex-1 lg:ml-64 w-full">
        <header className="h-16 border-b border-gray-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm sticky top-0 z-20 px-4 lg:px-8 flex items-center">
          <h2 className="text-gray-600 dark:text-slate-400 text-sm ml-12 lg:ml-0">Engineering Virtualization Portal</h2>
        </header>
        <main className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

const AuthenticatedApp: React.FC = () => {
  const { user, isLoading, login, error } = useAuth();

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!user) {
    return <Login onLogin={login} error={error || undefined} isLoading={isLoading} />;
  }

  // Show main app if authenticated
  return (
    <SimFlowProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/requests" element={<RequestList />} />
            <Route path="/requests/:id" element={<RequestDetail />} />
            <Route path="/new" element={<NewRequest />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </Router>
    </SimFlowProvider>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ToastProvider>
              <ModalProvider>
                <AuthenticatedApp />
              </ModalProvider>
            </ToastProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;