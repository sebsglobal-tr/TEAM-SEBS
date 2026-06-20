import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Square, Coffee, RotateCcw, CheckCircle, Pause, PlayIcon } from 'lucide-react';
import { workSessionsService } from '../../services/work-sessions.service';
import { useWorkSessionHeartbeat } from '../../hooks/useWorkSessionHeartbeat';
import { formatDuration } from '../../utils/format';
import type { WorkSessionToday } from '../../types';

/**
 * EmployeeTimer
 *
 * MİMARİ:
 * - Sayaç backend'deki gerçek zaman damgalarına göre hesaplanır
 * - Formül: totalActiveSeconds + (Date.now() - lastResumedAt ?? startedAt) / 1000
 * - setInterval sadece ekranı günceller, süreyi HESAPLAMAZ
 * - Tüm duraklatma/bitirme işlemleri sadece manueldir
 */

export function EmployeeTimer() {
  const navigate = useNavigate();
  const [showEndOfDay, setShowEndOfDay] = useState(false);
  const [session, setSession] = useState<WorkSessionToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [displaySeconds, setDisplaySeconds] = useState(0);

  const displayRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── SÜRE HESAPLAMA (Date.now() tabanlı) ───

  const calculateActiveSeconds = useCallback((sessionData: WorkSessionToday): number => {
    const active = sessionData.activeSession;
    if (!active) return 0;

    if (active.status === 'ACTIVE') {
      const referenceTime = active.lastResumedAt
        ? new Date(active.lastResumedAt).getTime()
        : new Date(active.startedAt).getTime();
      const elapsedSinceResume = Math.max(0, Math.floor((Date.now() - referenceTime) / 1000));
      return active.totalActiveSeconds + elapsedSinceResume;
    }

    // PAUSED / ENDED — sadece kayıtlı süre
    return active.totalActiveSeconds;
  }, []);

  const loadData = useCallback(async () => {
    try {
      const s = await workSessionsService.getToday();
      setSession(s);
      setDisplaySeconds(calculateActiveSeconds(s));
    } catch (err) {
      console.error('Session yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  }, [calculateActiveSeconds]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── CANLI SAYAÇ (sadece görüntü — süre hesaplamaz) ───

  useEffect(() => {
    if (!session?.activeSession || session.activeSession.status !== 'ACTIVE') {
      if (displayRef.current) { clearInterval(displayRef.current); displayRef.current = null; }
      return;
    }

    displayRef.current = setInterval(() => {
      if (session?.activeSession?.status === 'ACTIVE') {
        const active = session.activeSession;
        const referenceTime = active.lastResumedAt
          ? new Date(active.lastResumedAt).getTime()
          : new Date(active.startedAt).getTime();
        const elapsedSinceResume = Math.max(0, Math.floor((Date.now() - referenceTime) / 1000));
        setDisplaySeconds(active.totalActiveSeconds + elapsedSinceResume);
      }
    }, 1000);

    return () => { if (displayRef.current) clearInterval(displayRef.current); };
  }, [session?.activeSession]);

  // ─── HEARTBEAT ───

  const activeSession = session?.activeSession;
  const isSessionActive = !!activeSession && activeSession.status === 'ACTIVE';
  const isPaused = activeSession?.status === 'PAUSED';

  useWorkSessionHeartbeat({
    isSessionActive,
    onUpdate: loadData,
  });

  // ─── AKSİYONLAR ───

  const handleAction = async (action: () => Promise<unknown>, onSuccess?: () => void) => {
    setActionLoading(true);
    try {
      await action();
      onSuccess?.();
      await loadData();
    } catch (err) {
      console.error('İşlem sırasında hata:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    setActionLoading(true);
    try {
      await workSessionsService.resume();
      await loadData();
    } catch (err) {
      console.error('Devam ettirme hatası:', err);
      await loadData();
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    setActionLoading(true);
    try {
      await workSessionsService.pause();
      await loadData();
    } catch (err) {
      console.error('Duraklatma hatası:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // ─── FORMAT ───

  const formatHHMMSS = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const stateLabel = !activeSession ? 'Çalışma başlatılmadı'
    : isPaused ? 'Duraklatıldı'
    : isOnBreak ? 'Moladasınız'
    : 'Çalışma devam ediyor';

  const stateDot = !activeSession ? 'off' : isPaused ? 'paused' : isOnBreak ? 'paused' : 'active';

  // ─── RENDER ───

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  return (
    <div>
      <div className="page-header" style={{ textAlign: 'center' }}>
        <h1 className="page-title">Çalışma Sayacı</h1>
        <p className="page-subtitle">Çalışma sürenizi gerçek zamanlı takip edin</p>
      </div>

      <div className="timer-container">
        <div className="timer-status">
          <span className={`timer-status-dot ${stateDot}`} />
          <span>{stateLabel}</span>
        </div>

        <div className="timer-display" style={{ color: 'var(--accent)' }}>
          {formatHHMMSS(displaySeconds)}
        </div>

        <div className="timer-controls">
          {!activeSession ? (
            <button
              className="btn btn-primary"
              style={{ padding: '0.75rem 2rem', fontSize: '1.1rem' }}
              onClick={() => handleAction(() => workSessionsService.start())}
              disabled={actionLoading}
            >
              <Play size={24} /> Çalışmayı Başlat
            </button>
          ) : isPaused ? (
            <button
              className="btn btn-primary"
              style={{ padding: '0.75rem 2rem', fontSize: '1.1rem' }}
              onClick={handleResume}
              disabled={actionLoading}
            >
              <PlayIcon size={24} /> Çalışmaya Devam Et
            </button>
          ) : (
            <>
              {!isOnBreak ? (
                <>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}
                    onClick={() => handleAction(() => workSessionsService.startBreak(), () => setIsOnBreak(true))}
                    disabled={actionLoading}
                  >
                    <Coffee size={20} /> Mola Ver
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}
                    onClick={handlePause}
                    disabled={actionLoading}
                  >
                    <Pause size={20} /> Duraklat
                  </button>
                </>
              ) : (
                <button
                  className="btn btn-primary"
                  style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}
                  onClick={() => handleAction(() => workSessionsService.endBreak(), () => setIsOnBreak(false))}
                  disabled={actionLoading}
                >
                  <RotateCcw size={20} /> Moladan Dön
                </button>
              )}
              <button
                className="btn btn-danger"
                style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}
                onClick={() => handleAction(() => workSessionsService.stop(), () => {
                  setIsOnBreak(false);
                  setDisplaySeconds(0);
                  setShowEndOfDay(true);
                })}
                disabled={actionLoading}
              >
                <Square size={20} /> Bitir
              </button>
            </>
          )}
        </div>

        {/* İstatistikler */}
        {session && (
          <div className="timer-stats">
            <div className="timer-stat">
              <div className="timer-stat-value" style={{ color: '#10b981' }}>
                {formatDuration(session.totals.active)}
              </div>
              <div className="timer-stat-label">Bugün Toplam</div>
            </div>
            <div className="timer-stat">
              <div className="timer-stat-value" style={{ color: '#f59e0b' }}>
                {formatDuration(session.totals.break)}
              </div>
              <div className="timer-stat-label">Mola</div>
            </div>
            <div className="timer-stat">
              <div className="timer-stat-value" style={{ color: '#8b5cf6' }}>
                {formatDuration(session.totals.idle)}
              </div>
              <div className="timer-stat-label">Boşta</div>
            </div>
          </div>
        )}
      </div>

      {/* Gün Sonu Raporu Modal */}
      {showEndOfDay && (
        <div className="modal-overlay" onClick={() => setShowEndOfDay(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>Çalışma Sonlandı 🎯</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowEndOfDay(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <CheckCircle size={48} style={{ color: '#10b981', marginBottom: '0.5rem' }} />
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Bugünkü çalışmanız kaydedildi.<br />
                  Gün sonu raporu eklemek ister misiniz?
                </div>
              </div>
              <div style={{
                background: 'rgba(16,185,129,0.08)', borderRadius: 8,
                padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5,
              }}>
                <strong>Rapor şunları içerebilir:</strong><br />
                · Bugün ne yaptım?<br />
                · Hangi görevi tamamladım?<br />
                · Nerede takıldım?<br />
                · Yarın ne kalıyor?
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowEndOfDay(false)}>
                Daha Sonra
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => {
                setShowEndOfDay(false);
                navigate('/employee/upload-report');
              }}>
                Rapor Ekle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
