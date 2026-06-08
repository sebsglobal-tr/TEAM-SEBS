import { useEffect, useState, useRef, useCallback } from 'react';
import { Play, Square, Coffee } from 'lucide-react';
import { workSessionsService } from '../../services/work-sessions.service';
import { useWorkSessionHeartbeat } from '../../hooks/useWorkSessionHeartbeat';
import { formatDuration } from '../../utils/format';
import type { WorkSessionToday } from '../../types';

export function ManagerTimer() {
  const [session, setSession] = useState<WorkSessionToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const loadData = useCallback(() => {
    workSessionsService.getToday()
      .then((s) => {
        setSession(s);
        if (s.activeSession) {
          const elapsed = Math.floor((Date.now() - new Date(s.activeSession.startedAt).getTime()) / 1000);
          setCurrentTime(elapsed);
        } else {
          setCurrentTime(0);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Real-time counter
  useEffect(() => {
    if (!session?.activeSession) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - new Date(session.activeSession!.startedAt).getTime()) / 1000);
      setCurrentTime(elapsed);
    }, 1000);
    return () => clearInterval(interval);
  }, [session?.activeSession]);

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
    <div className="timer-container">
      <div className="timer-status">
        <span className={`timer-status-dot ${activeSession ? (isOnBreak ? 'paused' : 'active') : 'off'}`} />
        <span>
          {activeSession
            ? (isOnBreak ? 'Moladasınız' : 'Çalışıyorsunuz')
            : 'Çalışma başlatılmadı'}
        </span>
      </div>

      <div className="timer-display" style={{ color: 'var(--accent)' }}>
        {formatHHMMSS(currentTime)}
      </div>

      <div className="timer-controls">
        {!activeSession ? (
          <button className="btn btn-primary" onClick={() => handleAction(() => workSessionsService.start())} disabled={actionLoading}>
            <Play size={20} /> Başla
          </button>
        ) : (
          <>
            {!isOnBreak ? (
              <button className="btn btn-secondary" onClick={() => handleAction(() => workSessionsService.startBreak(), () => setIsOnBreak(true))} disabled={actionLoading}>
                <Coffee size={20} /> Mola
              </button>
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
            <div className="timer-stat-value" style={{ color: '#f59e0b' }}>{formatDuration(session.totals.idle)}</div>
            <div className="timer-stat-label">Boşta</div>
          </div>
          <div className="timer-stat">
            <div className="timer-stat-value" style={{ color: '#8b5cf6' }}>{formatDuration(session.totals.break)}</div>
            <div className="timer-stat-label">Mola</div>
          </div>
        </div>
      )}
    </div>
  );
}
