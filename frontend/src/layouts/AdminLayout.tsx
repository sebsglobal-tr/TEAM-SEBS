import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
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
  MessageSquare,
  LogOut,
  Menu,
  X,
  Bell,
  Shield,
  CalendarDays,
  Megaphone,
  Calendar,
  TrendingUp,
  Sun,
  Moon,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { notificationsService } from '../services/notifications.service';
import { GlobalSearch } from '../components/GlobalSearch';
import './layout.css';

const adminNav = [
  {
    section: 'Ana Sayfa',
    items: [
      { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    section: 'Kullanıcılar',
    items: [
      { to: '/admin/users', icon: Users, label: 'Tüm Kullanıcılar' },
      { to: '/admin/managers', icon: UserCog, label: 'Yöneticiler' },
      { to: '/admin/employees', icon: UserCheck, label: 'Çalışanlar' },
      { to: '/admin/assignments', icon: UserPlus, label: 'Atamalar' },
    ],
  },
  {
    section: 'Yönetim',
    items: [
      { to: '/admin/tasks', icon: CheckSquare, label: 'Görevler' },
      { to: '/admin/tasks/kanban', icon: LayoutDashboard, label: 'Kanban Board' },
      { to: '/admin/reports', icon: BarChart3, label: 'Raporlar' },
      { to: '/admin/reports/calendar', icon: CalendarDays, label: 'Rapor Takvimi' },
      { to: '/admin/files', icon: FolderOpen, label: 'Dosyalar' },
      { to: '/admin/work-sessions', icon: Clock, label: 'Çalışma Süreleri' },
      { to: '/admin/leaves', icon: Calendar, label: 'İzin Talepleri' },
      { to: '/admin/performance', icon: BarChart3, label: 'Performans' },
    ],
  },
  {
    section: 'İletişim',
    items: [
      { to: '/messages', icon: MessageSquare, label: 'Mesajlar' },
      { to: '/announcements', icon: Megaphone, label: 'Duyurular' },
    ],
  },
  {
    section: 'Sistem',
    items: [
      { to: '/admin/departments', icon: Users, label: 'Departmanlar' },
      { to: '/admin/org-chart', icon: Users, label: 'Organizasyon Şeması' },
      { to: '/admin/audit-log', icon: Shield, label: 'Denetim Kaydı' },
      { to: '/admin/settings', icon: Settings, label: 'Ayarlar' },
    ],
  },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
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

  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getPageTitle = () => {
    // Önce tam eşleşme ara, sonra prefix eşleşmesi yap
    let bestMatch = { label: 'Admin Paneli', depth: 0 };
    for (const section of adminNav) {
      for (const item of section.items) {
        if (location.pathname === item.to) {
          return item.label; // tam eşleşme → hemen dön
        }
        // Prefix eşleşmesi: en uzun eşleşeni seç
        if (location.pathname.startsWith(item.to + '/') && item.to.length > bestMatch.depth) {
          bestMatch = { label: item.label, depth: item.to.length };
        }
      }
    }
    return bestMatch.label;
  };

  return (
    <div className="layout admin-theme">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-logo">
            <Shield size={20} />
          </div>
          <div>
            <span className="brand-name">Sebs Global</span>
            <span className="brand-tag">Admin Paneli</span>
          </div>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {adminNav.map((section) => (
            <div key={section.section}>
              <div className="nav-section">{section.section}</div>
              {section.items.map((item) => (
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
            </div>
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
          <div className="topbar-left">
            <button className="menu-btn" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            <div className="topbar-title">{getPageTitle()}</div>
          </div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '0 1rem' }}>
            <GlobalSearch />
          </div>
          <div className="topbar-actions">
            <button className="icon-btn" onClick={toggleTheme} title={theme === 'dark' ? 'Aydınlık tema' : 'Karanlık tema'}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
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
