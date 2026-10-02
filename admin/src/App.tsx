import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAdminStore, useToastStore } from '@/store';
import { AdminLayout } from '@/components/Layout';
import { Auth } from '@/pages/Auth';
import { Dashboard } from '@/pages/Dashboard';
import { Users } from '@/pages/Users';
import { UserDetail } from '@/pages/UserDetail';
import { LiveMonitor } from '@/pages/LiveMonitor';
import { Analytics } from '@/pages/Analytics';
import { AuditLog } from '@/pages/AuditLog';
import { DatabaseExplorer } from '@/pages/DatabaseExplorer';
import { AdminAgent } from '@/pages/AdminAgent';
import { Payments } from '@/pages/Payments';
import { Messages } from '@/pages/Messages';
import { Settings } from '@/pages/Settings';

import { CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';

function ToastContainer() {
  const { toasts, remove } = useToastStore();
  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 space-y-2 max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => remove(t.id)}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold cursor-pointer border pointer-events-auto animate-fade backdrop-blur-md ${
            t.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-700/50 text-emerald-200'
              : t.type === 'error'
              ? 'bg-rose-950/90 border-rose-700/50 text-rose-200'
              : t.type === 'warning'
              ? 'bg-amber-950/90 border-amber-700/50 text-amber-200'
              : 'bg-navy-900/90 border-white/10 text-white'
          }`}
        >
          {t.type === 'success' && <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />}
          {t.type === 'error' && <AlertCircle size={16} className="text-rose-400 shrink-0" />}
          {t.type === 'warning' && <AlertTriangle size={16} className="text-amber-400 shrink-0" />}
          {t.type === 'info' && <Info size={16} className="text-cyan-400 shrink-0" />}
          <span className="flex-1">{t.message}</span>
        </div>
      ))}
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAdminStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  const theme = useAdminStore((s) => s.admin?.theme || 'dark');

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  }, [theme]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Auth mode="login" />} />
        <Route path="/register" element={<Auth mode="register" />} />

        {/* Protected Admin Console Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="users" element={<Users />} />
          <Route path="users/:id" element={<UserDetail />} />
          <Route path="live" element={<LiveMonitor />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="audit" element={<AuditLog />} />
          <Route path="database" element={<DatabaseExplorer />} />
          <Route path="payments" element={<Payments />} />
          <Route path="agent-usage" element={<AdminAgent />} />
          <Route path="messages" element={<Messages />} />
          <Route path="settings" element={<Settings />} />
        </Route>


        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  );
}
