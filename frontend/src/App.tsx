import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import { DashboardLayout } from './layouts/DashboardLayout';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { EmployeeDashboard } from './pages/EmployeeDashboard';
import { EmployeesPage } from './pages/EmployeesPage';
import { EmployeeDetailPage } from './pages/EmployeeDetailPage';
import { DepartmentsPage } from './pages/DepartmentsPage';
import { TasksPage } from './pages/TasksPage';
import { TaskDetailPage } from './pages/TaskDetailPage';
import { FilesPage } from './pages/FilesPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { WorkSessionsPage } from './pages/WorkSessionsPage';
import { ReportsPage } from './pages/ReportsPage';
import { TransparencyPage } from './pages/TransparencyPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import type { ReactNode } from 'react';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Yükleniyor...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** Sadece yönetici ve admin erişebilir */
function ManagerRoute({ children }: { children: ReactNode }) {
  const { user, loading, isManager } = useAuth();
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Yükleniyor...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isManager) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/** Sadece admin erişebilir */
function AdminRoute({ children }: { children: ReactNode }) {
  const { user, loading, isSuperAdmin } = useAuth();
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Yükleniyor...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function DashboardRouter() {
  const { isManager } = useAuth();
  return isManager ? <AdminDashboard /> : <EmployeeDashboard />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardRouter />} />
        <Route path="employees" element={<ManagerRoute><EmployeesPage /></ManagerRoute>} />
        <Route path="employees/:id" element={<ManagerRoute><EmployeeDetailPage /></ManagerRoute>} />
        <Route path="departments" element={<ManagerRoute><DepartmentsPage /></ManagerRoute>} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="tasks/:id" element={<TaskDetailPage />} />
        <Route path="files" element={<ManagerRoute><FilesPage /></ManagerRoute>} />
        <Route path="work-sessions" element={<WorkSessionsPage />} />
        <Route path="reports" element={<ManagerRoute><ReportsPage /></ManagerRoute>} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="audit" element={<AdminRoute><AuditLogPage /></AdminRoute>} />
        <Route path="settings" element={<AdminRoute><PlaceholderPage title="Ayarlar" subtitle="Sistem ayarları" /></AdminRoute>} />
        <Route path="transparency" element={<TransparencyPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
