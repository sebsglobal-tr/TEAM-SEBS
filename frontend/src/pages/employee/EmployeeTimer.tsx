import { useEffect, useState, useRef, useCallback } from 'react';
import { Play, Square, Coffee, RotateCcw } from 'lucide-react';
import { workSessionsService } from '../../services/work-sessions.service';
import { useWorkSessionHeartbeat } from '../../hooks/useWorkSessionHeartbeat';
import { formatDuration } from '../../utils/format';
import type { WorkSessionToday } from '../../types';

export function EmployeeTimer() {
  const [session, setSession] = useState<WorkSessionToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    try {
      const s = await workSessionsService.getToday();
      setSession(s);

      // Check initial break state from active break
      if (s.activeSession && s.activeSession.status === 'ACTIVE') {
        // Calculate elapsed time from server
        const startedAt = new Date(s.activeSession.startedAt).getTime();
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        setElapsedSeconds(elapsed - (s.totals.break ?? 0) - (s.totals.idle ?? 0));
      } else {
        setElapsedSeconds(0);
      }
    } catch (err) {
      console.error('Session yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Real-time counter
  useEffect(() => {
    if (!session?.activeSession || isOnBreak) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [session?.activeSession, isOnBreak]);

  const activeSession = session?.activeSession;
  useWorkSessionHeartbeat({
    isSessionActive: !!activeSession,
    isOnBreak,
    onUpdate: loadData,
  });

  const handleAction = async (action: () => Promise<unknown>, onSuccess?: () => void) => {
    setActionLoading(true);
    try {
      await action();
      onSuccess?.();
      loadData();
    } catch (err) {
      console.error('İşlem sırasında hata:', err);
    } finally {
      setActionLoading(false);
    }
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
      <div className="page-header" style={{ textAlign: 'center' }}>
        <h1 className="page-title">Çalışma Sayacı</h1>
        <p className="page-subtitle">Çalışma sürenizi gerçek zamanlı takip edin</p>
      </div>

      <div className="timer-container">
        <div className="timer-status">
          <span className={`timer-status-dot ${activeSession ? (isOnBreak ? 'paused' : 'active') : 'off'}`} />
          <span>
            {activeSession
              ? (isOnBreak ? 'Moladasınız' : 'Çalışma devam ediyor')
              : 'Çalışma başlatılmadı'}
          </span>
        </div>

        {/* Ana Sayaç */}
        <div className="timer-display" style={{ color: 'var(--accent)' }}>
          {formatHHMMSS(elapsedSeconds)}
        </div>

        {/* Kontrol Butonları */}
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
          ) : (
            <>
              {!isOnBreak ? (
                <button
                  className="btn btn-secondary"
                  style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}
                  onClick={() => handleAction(() => workSessionsService.startBreak(), () => setIsOnBreak(true))}
                  disabled={actionLoading}
                >
                  <Coffee size={20} /> Mola Ver
                </button>
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
                  setElapsedSeconds(0);
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
              <div className="timer-stat-label">Bugün Aktif</div>
            </div>
            <div className="timer-stat">
              <div className="timer-stat-value" style={{ color: '#f59e0b' }}>
                {formatDuration(session.totals.idle)}
              </div>
              <div className="timer-stat-label">Boşta</div>
            </div>
            <div className="timer-stat">
              <div className="timer-stat-value" style={{ color: '#8b5cf6' }}>
                {formatDuration(session.totals.break)}
              </div>
              <div className="timer-stat-label">Mola</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
