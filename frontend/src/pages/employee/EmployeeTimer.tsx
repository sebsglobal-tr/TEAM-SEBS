import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Square, Coffee, RotateCcw, CheckCircle, Pause, PlayIcon, AlertCircle } from 'lucide-react';
import { useWorkSession } from '../../hooks/useWorkSession';
import { formatDuration } from '../../utils/format';

/**
 * EmployeeTimer
 *
 * MİMARİ:
 * - Tüm oturum mantığı useWorkSession hook'u tarafından yönetilir
 * - Sayaç backend'deki gerçek zaman damgalarına göre hesaplanır
 * - Formül: totalActiveSeconds + (Date.now() - lastResumedAt ?? startedAt) / 1000
 * - setInterval sadece ekranı günceller, süreyi HESAPLAMAZ
 * - Tüm duraklatma/bitirme işlemleri sadece manueldir
 * - Ana sayfa ile aynı backend verisini kullanır, senkron çalışır
 */

export function EmployeeTimer() {
  const navigate = useNavigate();
  const ws = useWorkSession();
  const [showEndOfDay, setShowEndOfDay] = useState(false);

  const stateLabel = !ws.activeSession ? 'Çalışma başlatılmadı'
    : ws.isPaused ? 'Duraklatıldı'
    : ws.isOnBreak ? 'Moladasınız'
    : 'Çalışma devam ediyor';

  const stateDot = !ws.activeSession ? 'off' : ws.isPaused ? 'paused' : ws.isOnBreak ? 'paused' : 'active';

  if (ws.loading) return <div className="loading-spinner">Yükleniyor...</div>;

  return (
    <div>
      <div className="page-header" style={{ textAlign: 'center' }}>
        <h1 className="page-title">Çalışma Sayacı</h1>
        <p className="page-subtitle">Çalışma sürenizi gerçek zamanlı takip edin</p>
      </div>

      {ws.error && (
        <div style={{
          maxWidth: 500, margin: '0 auto 1rem', padding: '0.65rem 1rem',
          background: 'rgba(239,68,68,0.1)', borderRadius: 8,
          border: '1px solid rgba(239,68,68,0.2)',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          fontSize: '0.85rem', color: '#ef4444',
        }}>
          <AlertCircle size={16} /> {ws.error}
        </div>
      )}

      <div className="timer-container">
        <div className="timer-status">
          <span className={`timer-status-dot ${stateDot}`} />
          <span>{stateLabel}</span>
        </div>

        <div className="timer-display" style={{ color: 'var(--accent)' }}>
          {ws.formatHHMMSS(ws.displaySeconds)}
        </div>

        <div className="timer-controls">
          {!ws.activeSession ? (
            <button
              className="btn btn-primary"
              style={{ padding: '0.75rem 2rem', fontSize: '1.1rem' }}
              onClick={ws.start}
              disabled={ws.actionLoading}
            >
              <Play size={24} /> {ws.actionLoading ? 'Başlatılıyor...' : 'Çalışmayı Başlat'}
            </button>
          ) : ws.isPaused ? (
            <button
              className="btn btn-primary"
              style={{ padding: '0.75rem 2rem', fontSize: '1.1rem' }}
              onClick={ws.resume}
              disabled={ws.actionLoading}
            >
              <PlayIcon size={24} /> Çalışmaya Devam Et
            </button>
          ) : (
            <>
              {!ws.isOnBreak ? (
                <>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}
                    onClick={ws.startBreak}
                    disabled={ws.actionLoading}
                  >
                    <Coffee size={20} /> Mola Ver
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}
                    onClick={ws.pause}
                    disabled={ws.actionLoading}
                  >
                    <Pause size={20} /> Duraklat
                  </button>
                </>
              ) : (
                <button
                  className="btn btn-primary"
                  style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}
                  onClick={ws.endBreak}
                  disabled={ws.actionLoading}
                >
                  <RotateCcw size={20} /> Moladan Dön
                </button>
              )}
              <button
                className="btn btn-danger"
                style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}
                onClick={async () => {
                  await ws.stop();
                  if (!ws.error) setShowEndOfDay(true);
                }}
                disabled={ws.stopLoading}
              >
                <Square size={20} /> Bitir
              </button>
            </>
          )}
        </div>

        {/* İstatistikler */}
        {ws.session && (
          <div className="timer-stats">
            <div className="timer-stat">
              <div className="timer-stat-value" style={{ color: '#10b981' }}>
                {formatDuration(ws.session.totals.active)}
              </div>
              <div className="timer-stat-label">Bugün Toplam</div>
            </div>
            <div className="timer-stat">
              <div className="timer-stat-value" style={{ color: '#f59e0b' }}>
                {formatDuration(ws.session.totals.break)}
              </div>
              <div className="timer-stat-label">Mola</div>
            </div>
            <div className="timer-stat">
              <div className="timer-stat-value" style={{ color: '#8b5cf6' }}>
                {formatDuration(ws.session.totals.idle)}
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
