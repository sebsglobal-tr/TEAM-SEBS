import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserCog,
  UserCheck,
  UserPlus,
  CheckSquare,
  BarChart3,
  FolderOpen,
  Clock,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { notificationsService } from '../services/notifications.service';
import './layout.css';

const adminNav = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/users', icon: Users, label: 'Tüm Kullanıcılar' },
  { to: '/admin/managers', icon: UserCog, label: 'Yöneticiler' },
  { to: '/admin/employees', icon: UserCheck, label: 'Çalışanlar' },
  { to: '/admin/assignments', icon: UserPlus, label: 'Atamalar' },
  { to: '/admin/tasks', icon: CheckSquare, label: 'Görevler' },
  { to: '/admin/reports', icon: BarChart3, label: 'Raporlar' },
  { to: '/admin/files', icon: FolderOpen, label: 'Dosyalar' },
  { to: '/admin/work-sessions', icon: Clock, label: 'Çalışma Süreleri' },
  { to: '/admin/settings', icon: Settings, label: 'Ayarlar' },
];

export function AdminLayout() {
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
    <div className="layout admin-theme">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-logo">AG</div>
          <div>
            <span className="brand-name">Sebs Global</span>
            <span className="brand-tag">Admin Paneli</span>
          </div>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {adminNav.map((item) => (
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
                <span className="role-badge admin">Admin</span>
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
          <div className="topbar-title">Admin Paneli</div>
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
