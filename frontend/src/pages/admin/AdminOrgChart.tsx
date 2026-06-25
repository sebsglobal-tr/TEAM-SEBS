import { useEffect, useState } from 'react';
import { Users, Briefcase, User, ChevronRight, Building2 } from 'lucide-react';
import { api } from '../../services/api';

interface UserNode {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  position?: string;
  department?: { id: string; name: string };
  employees?: UserNode[];
}

export function AdminOrgChart() {
  const [managers, setManagers] = useState<UserNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const [usersRes, depsRes] = await Promise.all([
          api.get('/users', { params: { status: 'ACTIVE' } }),
          api.get('/departments'),
        ]);
        const users = Array.isArray(usersRes.data) ? usersRes.data : [];
        const departments = Array.isArray(depsRes.data) ? depsRes.data : [];

        // Build org tree
        const deptMap = new Map(departments.map((d: any) => [d.id, d]));
        const mgrs = users.filter((u: any) => u.role === 'MANAGER' || u.role === 'SUPER_ADMIN');
        const emps = users.filter((u: any) => u.role === 'EMPLOYEE');

        const tree = mgrs.map((m: any) => ({
          ...m,
          department: m.department || (m.departmentId ? deptMap.get(m.departmentId) : undefined),
          employees: emps.filter((e: any) => {
            if (m.role === 'SUPER_ADMIN') return true;
            return e.managerId === m.id || e.departmentId === m.departmentId;
          }),
        }));

        setManagers(tree);
      } catch (err) {
        console.error('Organizasyon şeması yüklenirken hata:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  const roleColors: Record<string, string> = {
    SUPER_ADMIN: '#7c3aed',
    MANAGER: '#2563eb',
    EMPLOYEE: '#059669',
  };

  const roleLabels: Record<string, string> = {
    SUPER_ADMIN: 'Admin',
    MANAGER: 'Yönetici',
    EMPLOYEE: 'Çalışan',
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Organizasyon Şeması</h1>
        <p className="page-subtitle">Şirket hiyerarşisi ve departman yapısı</p>
      </div>

      {managers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Building2 size={48} /></div>
          <div className="empty-state-text">Henüz kullanıcı bulunmuyor.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {managers.map((mgr) => (
            <div key={mgr.id} className="card">
              <div className="card-body" style={{ padding: 0 }}>
                {/* Manager node */}
                <div
                  onClick={() => mgr.employees?.length && toggleExpand(mgr.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '1rem 1.25rem', cursor: mgr.employees?.length ? 'pointer' : 'default',
                    borderBottom: expanded[mgr.id] ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: `${roleColors[mgr.role]}20`, color: roleColors[mgr.role],
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '0.9rem',
                  }}>
                    {mgr.firstName[0]}{mgr.lastName[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                      {mgr.firstName} {mgr.lastName}
                      <span className="badge" style={{
                        marginLeft: 8, background: `${roleColors[mgr.role]}20`, color: roleColors[mgr.role],
                        fontSize: '0.6rem',
                      }}>
                        {roleLabels[mgr.role]}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {mgr.position || mgr.department?.name || '-'}
                      {mgr.employees && ` · ${mgr.employees.length} çalışan`}
                    </div>
                  </div>
                  {(mgr.employees?.length ?? 0) > 0 && (
                    <ChevronRight size={18} style={{
                      color: 'var(--text-secondary)',
                      transform: expanded[mgr.id] ? 'rotate(90deg)' : 'none',
                      transition: 'transform 0.2s',
                    }} />
                  )}
                </div>

                {/* Employee nodes */}
                {expanded[mgr.id] && mgr.employees?.map((emp) => (
                  <div key={emp.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.65rem 1.25rem 0.65rem 3rem',
                    borderBottom: '1px solid var(--border)',
                    background: 'var(--bg-primary)',
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 10,
                      background: 'rgba(5,150,105,0.1)', color: '#059669',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 600, fontSize: '0.75rem',
                    }}>
                      {emp.firstName[0]}{emp.lastName[0]}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>
                        {emp.firstName} {emp.lastName}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        {emp.position || emp.department?.name || '-'}
                      </div>
                    </div>
                  </div>
                ))}

                {(!mgr.employees || mgr.employees.length === 0) && (
                  <div style={{
                    padding: '1rem 1.25rem 1rem 3rem', fontSize: '0.78rem',
                    color: 'var(--text-secondary)', fontStyle: 'italic',
                  }}>
                    Bu yöneticiye bağlı çalışan bulunmuyor.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
