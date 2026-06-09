import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Timer,
  Upload,
  FileText,
  FolderOpen,
  MessageSquare,
  UserCircle,
  LogOut,
  Menu,
  X,
  Bell,
  CheckSquare,
  Clock,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { notificationsService } from '../services/notifications.service';
import './layout.css';

const employeeNav = [
  { to: '/employee/dashboard', icon: LayoutDashboard, label: 'Ana Sayfa' },
  { to: '/employee/tasks', icon: CheckSquare, label: 'Görevlerim' },
  { to: '/employee/timer', icon: Timer, label: 'Çalışma Sayacı' },
  { to: '/employee/reports', icon: FileText, label: 'Raporlarım' },
  { to: '/employee/files', icon: FolderOpen, label: 'Dosyalarım' },
  { to: '/employee/history', icon: Clock, label: 'Geçmiş' },
  { to: '/employee/feedbacks', icon: MessageSquare, label: 'Geri Bildirimler' },
  { to: '/employee/profile', icon: UserCircle, label: 'Profil' },
];

export function EmployeeLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchCount = () => {
      notificationsService.getUnreadCount().then(setUnreadCount).catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="layout employee-theme">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-logo">EM</div>
          <div>
            <span className="brand-name">Sebs Global</span>
            <span className="brand-tag">Çalışan Paneli</span>
          </div>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {employeeNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div>
              <div className="user-name">{user?.firstName} {user?.lastName}</div>
              <div className="user-role">
                <span className="role-badge employee">Çalışan</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="topbar-title">Çalışan Paneli</div>
          <div className="topbar-actions">
            <button className="icon-btn notification-btn" onClick={() => navigate('/notifications')} title="Bildirimler">
              <Bell size={18} />
              {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>
            <button className="icon-btn" onClick={handleLogout} title="Çıkış">
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
    </div>
  );
}
