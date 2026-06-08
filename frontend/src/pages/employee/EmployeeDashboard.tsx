import { useEffect, useState, useCallback } from 'react';
import { Clock, Coffee, Play, Square, FileText, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { workSessionsService } from '../../services/work-sessions.service';
import { filesService, type FileRecord } from '../../services/files.service';
import { api } from '../../services/api';
import { useWorkSessionHeartbeat } from '../../hooks/useWorkSessionHeartbeat';
import { formatDuration } from '../../utils/format';
import type { WorkSessionToday } from '../../types';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EmployeeDashboard() {
  const navigate = useNavigate();
  const [session, setSession] = useState<WorkSessionToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [recentFiles, setRecentFiles] = useState<FileRecord[]>([]);
  const [stats, setStats] = useState<any>(null);

  const loadData = useCallback(async () => {
    try {
      const [s, f] = await Promise.all([
        workSessionsService.getToday(),
        filesService.getAll({ limit: 5 }),
      ]);
      setSession(s);
      setRecentFiles(f);
    } catch (err) {
      console.error('Veri yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Load report stats
    api.get('/reports/stats/my').then(setStats).catch(() => {});
  }, [loadData]);

  const activeSession = session?.activeSession;
  useWorkSessionHeartbeat({
    isSessionActive: !!activeSession,
    isOnBreak,
    onUpdate: loadData,
  });

  const handleAction = async (action: () => Promise<unknown>, onSuccess?: () => void) => {
    setActionLoading(true);
    try { await action(); onSuccess?.(); loadData(); } finally { setActionLoading(false); }
  };

  const formatHHMMSS = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Ana Sayfa</h1>
        <p className="page-subtitle">Çalışma takibiniz ve özet bilgiler</p>
      </div>

      {/* Quick Timer */}
      <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
        <div style={{
          fontSize: '3.5rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
          letterSpacing: '0.1em', color: 'var(--accent)', marginBottom: '1rem',
        }}>
          {formatHHMMSS(session?.totals.active ?? 0)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          {!activeSession ? (
            <button className="btn btn-primary" onClick={() => handleAction(() => workSessionsService.start())} disabled={actionLoading}>
              <Play size={16} /> Çalışmayı Başlat
            </button>
          ) : (
            <>
              {!isOnBreak ? (
                <button className="btn btn-secondary" onClick={() => handleAction(() => workSessionsService.startBreak(), () => setIsOnBreak(true))} disabled={actionLoading}>
                  <Coffee size={16} /> Mola
                </button>
              ) : (
                <button className="btn btn-secondary" onClick={() => handleAction(() => workSessionsService.endBreak(), () => setIsOnBreak(false))} disabled={actionLoading}>
                  Mola Bitir
                </button>
              )}
              <button className="btn btn-danger" onClick={() => handleAction(() => workSessionsService.stop(), () => setIsOnBreak(false))} disabled={actionLoading}>
                <Square size={16} /> Bitir
              </button>
            </>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <span>Mola: {formatDuration(session?.totals.break ?? 0)}</span>
          <span>Boşta: {formatDuration(session?.totals.idle ?? 0)}</span>
        </div>
      </div>

      {/* Hızlı Erişim */}
      <div className="stats-grid">
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/employee/timer')}>
          <div className="stat-card-icon employee"><Clock size={20} /></div>
          <div>
            <div className="stat-card-label">Çalışma Sayacı</div>
            <div className="stat-card-value" style={{ fontSize: '0.9rem' }}>Detaylı sayaç</div>
          </div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/employee/upload-report')}>
          <div className="stat-card-icon employee"><Upload size={20} /></div>
          <div>
            <div className="stat-card-label">Rapor Yükle</div>
            <div className="stat-card-value" style={{ fontSize: '0.9rem' }}>Yeni rapor ekle</div>
          </div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/employee/reports')}>
          <div className="stat-card-icon employee"><FileText size={20} /></div>
          <div>
            <div className="stat-card-label">Raporlarım</div>
            <div className="stat-card-value" style={{ fontSize: '0.9rem' }}>
              {stats?.totalReports ?? 0} rapor
            </div>
          </div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/employee/feedbacks')}>
          <div className="stat-card-icon employee"><FileText size={20} /></div>
          <div>
            <div className="stat-card-label">Geri Bildirimler</div>
            <div className="stat-card-value" style={{ fontSize: '0.9rem' }}>
              {stats?.recentReports?.reduce((c: number, r: any) => c + (r.feedbacks?.length ?? 0), 0) ?? 0} yeni
            </div>
          </div>
        </div>
      </div>

      {/* Son Dosyalar */}
      {recentFiles.length > 0 && (
        <div className="card">
          <div className="card-header"><div className="card-title">Son Dosyalarım</div></div>
          <div className="card-body">
            {recentFiles.map((file) => (
              <div key={file.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.5rem 0', borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={14} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontSize: '0.85rem' }}>{file.originalName}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{formatFileSize(file.size)}</span>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => filesService.download(file.id, file.originalName)}>
                  İndir
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
