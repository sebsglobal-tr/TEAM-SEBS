import { useEffect, useState, useRef, useCallback } from 'react';
import { Play, Square, Coffee, Pause, PlayIcon } from 'lucide-react';
import { workSessionsService } from '../../services/work-sessions.service';
import { useWorkSessionHeartbeat } from '../../hooks/useWorkSessionHeartbeat';
import { formatDuration } from '../../utils/format';
import type { WorkSessionToday } from '../../types';

/**
 * ManagerTimer
 *
 * - Sayaç backend'deki gerçek zaman damgalarına göre hesaplanır
 * - setInterval sadece görüntüyü günceller, süreyi hesaplamaz
 * - Tüm duraklatma/bitirme işlemleri sadece manueldir
 */
export function ManagerTimer() {
  const [session, setSession] = useState<WorkSessionToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [displaySeconds, setDisplaySeconds] = useState(0);

  const displayRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Canlı sayaç — Date.now() tabanlı hesaplama
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

  const activeSession = session?.activeSession;
  const isSessionActive = !!activeSession && activeSession.status === 'ACTIVE';
  const isPaused = activeSession?.status === 'PAUSED';

  useWorkSessionHeartbeat({
    isSessionActive,
    onUpdate: loadData,
  });

  const handleAction = async (action: () => Promise<unknown>, onSuccess?: () => void) => {
    setActionLoading(true);
    try { await action(); onSuccess?.(); await loadData(); } catch (err) { console.error(err); } finally { setActionLoading(false); }
  };

  const handleResume = async () => {
    setActionLoading(true);
    try { await workSessionsService.resume(); await loadData(); } catch (err) { console.error(err); } finally { setActionLoading(false); }
  };

  const handlePause = async () => {
    setActionLoading(true);
    try { await workSessionsService.pause(); await loadData(); } catch (err) { console.error(err); } finally { setActionLoading(false); }
  };

  const formatHHMMSS = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) return <div className="loading-spinner">Yükleniyor...</div>;

  const stateLabel = !activeSession ? 'Çalışma başlatılmadı'
    : isPaused ? 'Duraklatıldı'
    : isOnBreak ? 'Moladasınız'
    : 'Çalışıyorsunuz';

  const stateDot = !activeSession ? 'off' : isPaused ? 'paused' : isOnBreak ? 'paused' : 'active';

  return (
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
          <button className="btn btn-primary" onClick={() => handleAction(() => workSessionsService.start())} disabled={actionLoading}>
            <Play size={20} /> Başla
          </button>
        ) : isPaused ? (
          <button className="btn btn-primary" onClick={handleResume} disabled={actionLoading}>
            <PlayIcon size={20} /> Devam Et
          </button>
        ) : (
          <>
            {!isOnBreak ? (
              <>
                <button className="btn btn-secondary" onClick={() => handleAction(() => workSessionsService.startBreak(), () => setIsOnBreak(true))} disabled={actionLoading}>
                  <Coffee size={20} /> Mola
                </button>
                <button className="btn btn-secondary" onClick={handlePause} disabled={actionLoading}>
                  <Pause size={20} /> Duraklat
                </button>
              </>
            ) : (
              <button className="btn btn-secondary" onClick={() => handleAction(() => workSessionsService.endBreak(), () => setIsOnBreak(false))} disabled={actionLoading}>
                Mola Bitir
              </button>
            )}
            <button className="btn btn-danger" onClick={() => handleAction(() => workSessionsService.stop(), () => setIsOnBreak(false))} disabled={actionLoading}>
              <Square size={20} /> Bitir
            </button>
          </>
        )}
      </div>

      {session && (
        <div className="timer-stats">
          <div className="timer-stat">
            <div className="timer-stat-value" style={{ color: '#10b981' }}>{formatDuration(session.totals.active)}</div>
            <div className="timer-stat-label">Bugün Aktif</div>
          </div>
          <div className="timer-stat">
            <div className="timer-stat-value" style={{ color: '#f59e0b' }}>{formatDuration(session.totals.break)}</div>
            <div className="timer-stat-label">Mola</div>
          </div>
          <div className="timer-stat">
            <div className="timer-stat-value" style={{ color: '#8b5cf6' }}>{formatDuration(session.totals.idle)}</div>
            <div className="timer-stat-label">Boşta</div>
          </div>
        </div>
      )}
    </div>
  );
}
