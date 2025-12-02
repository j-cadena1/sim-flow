import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SimFlowProvider } from './context/SimFlowContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';
import { ModalProvider } from './components/Modal';
import { Sidebar } from './components/Sidebar';
import { RoleSwitcher } from './components/RoleSwitcher';
import { Dashboard } from './components/Dashboard';
import { NewRequest } from './components/NewRequest';
import { RequestList } from './components/RequestList';
import { RequestDetail } from './components/RequestDetail';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5000,
    },
  },
});

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar />
      <div className="flex-1 ml-64">
        <header className="h-16 border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm sticky top-0 z-20 px-8 flex items-center justify-between">
          <h2 className="text-slate-400 text-sm">Engineering Virtualization Portal</h2>
          <RoleSwitcher />
        </header>
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ModalProvider>
            <SimFlowProvider>
              <Router>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/requests" element={<RequestList />} />
                    <Route path="/requests/:id" element={<RequestDetail />} />
                    <Route path="/new" element={<NewRequest />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Layout>
              </Router>
            </SimFlowProvider>
          </ModalProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;