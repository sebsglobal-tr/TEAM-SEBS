import { useEffect, useState } from 'react';
import { usersService } from '../../services/users.service';

interface EmployeeUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  manager?: { id: string; firstName: string; lastName: string } | null;
}

interface ManagerUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export function AdminAssignments() {
  const [employees, setEmployees] = useState<EmployeeUser[]>([]);
  const [managers, setManagers] = useState<ManagerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    try {
      const [empData, allUsers] = await Promise.all([
        usersService.getEmployees(),
        usersService.getAll({ status: 'ACTIVE' }),
      ]);
      const all = Array.isArray(allUsers) ? allUsers : [];
      setEmployees(empData);
      setManagers(all.filter((u: any) => u.role === 'MANAGER'));
    } catch (err) {
      console.error('Yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const assignManager = async (employeeId: string, managerId: string) => {
    setSavingId(employeeId);
    try {
      await usersService.update(employeeId, { managerId } as any);
      load();
    } catch (err) {
      console.error('Atama yapılırken hata:', err);
    } finally {
      setSavingId(null);
    }
  };

  const removeAssignment = async (employeeId: string) => {
    setSavingId(employeeId);
    try {
      await usersService.update(employeeId, { managerId: '' } as any);
      load();
    } catch (err) {
      console.error('Atama kaldırılırken hata:', err);
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Yönetici - Çalışan Atamaları</h1>
        <p className="page-subtitle">Çalışanları yöneticilere atayın</p>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Çalışan Listesi</div></div>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Çalışan</th>
                <th>E-posta</th>
                <th>Mevcut Yöneticisi</th>
                <th>Yeni Yönetici Ata</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Çalışan bulunamadı.</td></tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id}>
                    <td style={{ fontWeight: 500 }}>{emp.firstName} {emp.lastName}</td>
                    <td>{emp.email}</td>
                    <td>
                      {emp.manager
                        ? <span className="badge badge-info">{emp.manager.firstName} {emp.manager.lastName}</span>
                        : <span className="badge badge-default">Atanmamış</span>
                      }
                    </td>
                    <td>
                      <select
                        className="form-select"
                        style={{ minWidth: 180 }}
                        value=""
                        onChange={(e) => {
                          if (e.target.value) assignManager(emp.id, e.target.value);
                        }}
                      >
                        <option value="">Yönetici seçin...</option>
                        {managers.map((m) => (
                          <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {emp.manager && (
                        <button className="btn btn-ghost btn-sm" onClick={() => removeAssignment(emp.id)} disabled={savingId === emp.id}>
                          Kaldır
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
