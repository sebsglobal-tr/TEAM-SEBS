import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import { AdminLayout } from './layouts/AdminLayout';
import { ManagerLayout } from './layouts/ManagerLayout';
import { EmployeeLayout } from './layouts/EmployeeLayout';
import { LoginPage } from './pages/LoginPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import type { ReactNode } from 'react';

// ─── Auth Guards ────────────────────────────────────────────────────

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Yükleniyor...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Yükleniyor...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'SUPER_ADMIN') return <Navigate to={user.role === 'MANAGER' ? '/manager/dashboard' : '/employee/dashboard'} replace />;
  return <>{children}</>;
}

function ManagerRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Yükleniyor...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'MANAGER' && user.role !== 'SUPER_ADMIN') return <Navigate to="/employee/dashboard" replace />;
  return <>{children}</>;
}

function EmployeeRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Yükleniyor...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'EMPLOYEE') return <Navigate to={user.role === 'SUPER_ADMIN' ? '/admin/dashboard' : '/manager/dashboard'} replace />;
  return <>{children}</>;
}

// ─── Role Redirect ──────────────────────────────────────────────────

function RoleRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Yükleniyor...</div>;
  if (!user) return <Navigate to="/login" replace />;

  switch (user.role) {
    case 'SUPER_ADMIN': return <Navigate to="/admin/dashboard" replace />;
    case 'MANAGER': return <Navigate to="/manager/dashboard" replace />;
    case 'EMPLOYEE': return <Navigate to="/employee/dashboard" replace />;
    default: return <Navigate to="/login" replace />;
  }
}

// ─── App ────────────────────────────────────────────────────────────

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

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RoleRedirect />} />

      {/* ─── Admin Panel ───────────────────────────────────────── */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="users/:id" element={<AdminUserDetail />} />
        <Route path="managers" element={<AdminManagers />} />
        <Route path="employees" element={<AdminEmployees />} />
        <Route path="assignments" element={<AdminAssignments />} />
        <Route path="tasks" element={<AdminTasks />} />
        <Route path="tasks/bulk-create" element={<AdminBulkCreate />} />
        <Route path="tasks/:id" element={<AdminTaskDetail />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="files" element={<AdminFiles />} />
        <Route path="work-sessions" element={<AdminWorkSessions />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      {/* ─── Manager Panel ─────────────────────────────────────── */}
      <Route
        path="/manager"
        element={
          <ProtectedRoute>
            <ManagerRoute>
              <ManagerLayout />
            </ManagerRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/manager/dashboard" replace />} />
        <Route path="dashboard" element={<ManagerDashboardPage />} />
        <Route path="employees" element={<ManagerEmployees />} />
        <Route path="employees/:id" element={<ManagerEmployeeDetail />} />
        <Route path="reports" element={<ManagerReports />} />
        <Route path="files" element={<ManagerFiles />} />
        <Route path="work-sessions" element={<ManagerWorkSessions />} />
        <Route path="timer" element={<ManagerTimer />} />
        <Route path="profile" element={<ManagerProfile />} />
      </Route>

      {/* ─── Employee Panel ────────────────────────────────────── */}
      <Route
        path="/employee"
        element={
          <ProtectedRoute>
            <EmployeeRoute>
              <EmployeeLayout />
            </EmployeeRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/employee/dashboard" replace />} />
        <Route path="dashboard" element={<EmployeeDashboardPage />} />
        <Route path="tasks" element={<EmployeeTasksPage />} />
        <Route path="tasks/:id" element={<EmployeeTaskDetail />} />
        <Route path="timer" element={<EmployeeTimer />} />
        <Route path="upload-report" element={<EmployeeUploadReport />} />
        <Route path="reports" element={<EmployeeReports />} />
        <Route path="reports/:id" element={<EmployeeReportDetail />} />
        <Route path="files" element={<EmployeeFiles />} />
        <Route path="feedbacks" element={<EmployeeFeedbacks />} />
        <Route path="history" element={<EmployeeHistory />} />
        <Route path="profile" element={<EmployeeProfile />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// ─── Lazy-loaded page imports ──────────────────────────────────────

// Admin Pages
import { AdminDashboard as AdminDashboardPage } from './pages/admin/AdminDashboard';

// Admin sub pages are loaded in separate files
import { AdminUsers } from './pages/admin/AdminUsers';
import { AdminUserDetail } from './pages/admin/AdminUserDetail';
import { AdminManagers } from './pages/admin/AdminManagers';
import { AdminEmployees } from './pages/admin/AdminEmployees';
import { AdminAssignments } from './pages/admin/AdminAssignments';
import { AdminTasks } from './pages/admin/AdminTasks';
import { AdminBulkCreate } from './pages/admin/AdminBulkCreate';
import { AdminTaskDetail } from './pages/admin/AdminTaskDetail';
import { AdminReports } from './pages/admin/AdminReports';
import { AdminFiles } from './pages/admin/AdminFiles';
import { AdminWorkSessions } from './pages/admin/AdminWorkSessions';
import { AdminSettings } from './pages/admin/AdminSettings';

// Manager Pages
import { ManagerDashboard as ManagerDashboardPage } from './pages/manager/ManagerDashboard';
import { ManagerEmployees } from './pages/manager/ManagerEmployees';
import { ManagerEmployeeDetail } from './pages/manager/ManagerEmployeeDetail';
import { ManagerReports } from './pages/manager/ManagerReports';
import { ManagerFiles } from './pages/manager/ManagerFiles';
import { ManagerWorkSessions } from './pages/manager/ManagerWorkSessions';
import { ManagerTimer } from './pages/manager/ManagerTimer';
import { ManagerProfile } from './pages/manager/ManagerProfile';

// Employee Pages
import { EmployeeDashboard as EmployeeDashboardPage } from './pages/employee/EmployeeDashboard';
import { EmployeeTasks as EmployeeTasksPage } from './pages/employee/EmployeeTasks';
import { EmployeeTaskDetail } from './pages/employee/EmployeeTaskDetail';
import { EmployeeTimer } from './pages/employee/EmployeeTimer';
import { EmployeeUploadReport } from './pages/employee/EmployeeUploadReport';
import { EmployeeReports } from './pages/employee/EmployeeReports';
import { EmployeeReportDetail } from './pages/employee/EmployeeReportDetail';
import { EmployeeFiles } from './pages/employee/EmployeeFiles';
import { EmployeeFeedbacks } from './pages/employee/EmployeeFeedbacks';
import { EmployeeHistory } from './pages/employee/EmployeeHistory';
import { EmployeeProfile } from './pages/employee/EmployeeProfile';
