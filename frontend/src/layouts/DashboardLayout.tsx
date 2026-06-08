import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Building2,
  CheckSquare,
  FolderOpen,
  Clock,
  BarChart3,
  Bell,
  Settings,
  Shield,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  Upload,
  UserCircle,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { notificationsService } from '../services/notifications.service';
import './layout.css';

/** Çalışan navigasyonu — sade, görev odaklı */
const employeeNav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Ana Sayfa' },
  { to: '/work-sessions', icon: Clock, label: 'Çalışma Sürem' },
  { to: '/notifications', icon: Bell, label: 'Bildirimler' },
  { to: '/transparency', icon: Shield, label: 'Veri Kullanımı' },
];

/** Yönetici navigasyonu — ekip yönetimi ağırlıklı */
const managerNav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/employees', icon: Users, label: 'Çalışanlar' },
  { to: '/departments', icon: Building2, label: 'Departmanlar' },
  { to: '/tasks', icon: CheckSquare, label: 'Görev Yönetimi' },
  { to: '/files', icon: FolderOpen, label: 'Dosyalar' },
  { to: '/work-sessions', icon: Clock, label: 'Çalışma Süreleri' },
  { to: '/reports', icon: BarChart3, label: 'Raporlar' },
  { to: '/notifications', icon: Bell, label: 'Bildirimler' },
  { to: '/transparency', icon: Shield, label: 'Şeffaflık' },
];

/** Admin navigasyonu — her şey + ayarlar + audit log */
const adminNav = [
  ...managerNav,
  { to: '/audit', icon: Shield, label: 'Aktivite Günlüğü' },
  { to: '/settings', icon: Settings, label: 'Ayarlar' },
];

export function DashboardLayout() {
  const { user, logout, isManager, isSuperAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
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

  // Role'e göre navigasyon
  const navItems = isSuperAdmin ? adminNav : isManager ? managerNav : employeeNav;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const roleBadge = isSuperAdmin ? 'Admin' : isManager ? 'Yönetici' : 'Çalışan';

  return (
    <div className="layout">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <img src="/sebs-logo.png" alt="Sebs Global" className="sidebar-logo" />
          <div>
            <span className="brand-name">Sebs Global</span>
            <span className="brand-tag">Çalışan Takip Sistemi</span>
          </div>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
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
              {user?.firstName[0]}{user?.lastName[0]}
            </div>
            <div>
              <div className="user-name">{user?.firstName} {user?.lastName}</div>
              <div className="user-role" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{
                  display: 'inline-block', padding: '1px 6px', borderRadius: 4,
                  fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase',
                  background: isSuperAdmin ? '#ef4444' : isManager ? '#3b82f6' : '#10b981',
                  color: 'white', lineHeight: '1.4',
                }}>{roleBadge}</span>
                <span style={{ opacity: 0.6 }}>{user?.position ?? user?.role}</span>
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
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {isManager ? 'Yönetim Paneli' : 'Çalışan Paneli'}
          </div>
          <div className="topbar-actions">
            <button className="icon-btn notification-btn" onClick={() => navigate('/notifications')} title="Bildirimler">
              <Bell size={18} />
              {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>
            <button className="icon-btn" onClick={toggleTheme} title="Tema değiştir">
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
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
