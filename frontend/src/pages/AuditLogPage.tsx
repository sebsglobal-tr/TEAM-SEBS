import { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { api } from '../services/api';
import { formatDateTime } from '../utils/format';

interface AuditEntry {
  id: string;
  action: string;
  entityType?: string;
  entityId?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  actor?: { id: string; firstName: string; lastName: string; email: string };
}

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Giriş',
  LOGOUT: 'Çıkış',
  USER_CREATE: 'Kullanıcı Oluşturma',
  USER_UPDATE: 'Kullanıcı Güncelleme',
  USER_DEACTIVATE: 'Kullanıcı Pasife Alma',
  TASK_CREATE: 'Görev Oluşturma',
  TASK_UPDATE: 'Görev Güncelleme',
  TASK_DELETE: 'Görev Silme',
  FILE_UPLOAD: 'Dosya Yükleme',
  FILE_DOWNLOAD: 'Dosya İndirme',
  FILE_DELETE: 'Dosya Silme',
  SESSION_START: 'Oturum Başlatma',
  SESSION_END: 'Oturum Bitirme',
  BREAK_START: 'Mola Başlatma',
  BREAK_END: 'Mola Bitirme',
  DEPARTMENT_CREATE: 'Departman Oluşturma',
  DEPARTMENT_UPDATE: 'Departman Güncelleme',
  DEPARTMENT_DELETE: 'Departman Silme',
  SETTING_UPDATE: 'Ayar Güncelleme',
};

const ACTION_VARIANTS: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'default'> = {
  LOGIN: 'info',
  LOGOUT: 'default',
  USER_CREATE: 'success',
  USER_DEACTIVATE: 'danger',
  TASK_CREATE: 'success',
  TASK_UPDATE: 'info',
  TASK_DELETE: 'danger',
  FILE_UPLOAD: 'info',
  FILE_DOWNLOAD: 'info',
  FILE_DELETE: 'danger',
  SESSION_START: 'success',
  SESSION_END: 'warning',
  BREAK_START: 'warning',
  BREAK_END: 'success',
  DEPARTMENT_CREATE: 'success',
  DEPARTMENT_DELETE: 'danger',
  SETTING_UPDATE: 'info',
};

export function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const limit = 25;

  const load = () => {
    setLoading(true);
    const params: Record<string, string> = { page: String(page), limit: String(limit) };
    if (filter) params.action = filter;
    api.get('/audit', { params })
      .then((r) => { setEntries(r.data.data); setTotal(r.data.total); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, filter]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Aktivite Günlüğü</h1>
        <p className="page-subtitle">Tüm sistem işlem kayıtları ({total} kayıt)</p>
      </div>

      {/* Filtre */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="form-input" style={{ width: 'auto', minWidth: 200 }} value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }}>
          <option value="">Tüm İşlemler</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Sayfa {page}/{totalPages || 1}
        </span>
      </div>

      <Card>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Yükleniyor...</div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>İşlem</th>
                    <th>Kullanıcı</th>
                    <th>Hedef</th>
                    <th>Detay</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Kayıt bulunamadı</td>
                    </tr>
                  ) : (
                    entries.map((entry) => (
                      <tr key={entry.id}>
                        <td className="td-nowrap">{formatDateTime(entry.createdAt)}</td>
                        <td>
                          <Badge variant={ACTION_VARIANTS[entry.action] ?? 'default'}>
                            {ACTION_LABELS[entry.action] ?? entry.action}
                          </Badge>
                        </td>
                        <td>{entry.actor ? `${entry.actor.firstName} ${entry.actor.lastName}` : '-'}</td>
                        <td className="td-entity">
                          {entry.entityType ? `${entry.entityType}${entry.entityId ? ` #${entry.entityId.slice(0, 8)}` : ''}` : '-'}
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: 250 }}>
                          {entry.metadata ? JSON.stringify(entry.metadata).slice(0, 60) + (JSON.stringify(entry.metadata).length > 60 ? '...' : '') : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Sayfalama */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  ← Önceki
                </Button>
                <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.85rem', padding: '0 0.5rem', color: 'var(--text-secondary)' }}>
                  {page} / {totalPages}
                </span>
                <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  Sonraki →
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
