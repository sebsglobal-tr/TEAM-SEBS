import { useEffect, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { notificationsService } from '../services/notifications.service';
import { formatDateTime } from '../utils/format';
import type { Notification } from '../types';

const TYPE_LABELS: Record<string, string> = {
  TASK_ASSIGNED: 'Görev',
  TASK_DUE_SOON: 'Son Tarih',
  TASK_REVISION: 'Revize',
  FILE_UPLOADED: 'Dosya',
  TASK_APPROVED: 'Onay',
  TASK_REJECTED: 'Red',
  IDLE_WARNING: 'Idle',
  SESSION_ENDED: 'Oturum',
  GENERAL: 'Genel',
};

const TYPE_VARIANT: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'default'> = {
  TASK_ASSIGNED: 'info',
  TASK_APPROVED: 'success',
  TASK_REVISION: 'warning',
  TASK_REJECTED: 'danger',
  FILE_UPLOADED: 'info',
  IDLE_WARNING: 'warning',
};

export function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const load = () => {
    notificationsService.getAll(filter === 'unread').then(setNotifications).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter]);

  const handleMarkRead = async (id: string, metadata?: Record<string, unknown>) => {
    await notificationsService.markAsRead(id);
    if (metadata?.taskId) {
      navigate(`/tasks/${metadata.taskId as string}`);
    } else {
      load();
    }
  };

  const handleMarkAllRead = async () => {
    await notificationsService.markAllAsRead();
    load();
  };

  if (loading) return <div>Yükleniyor...</div>;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Bildirimler</h1>
          <p className="page-subtitle">
            {unreadCount > 0 ? `${unreadCount} okunmamış bildirim` : 'Tüm bildirimler okundu'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="secondary" onClick={handleMarkAllRead}>
            <CheckCheck size={16} /> Tümünü Okundu İşaretle
          </Button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <Button
          size="sm"
          variant={filter === 'all' ? 'primary' : 'secondary'}
          onClick={() => setFilter('all')}
        >
          Tümü
        </Button>
        <Button
          size="sm"
          variant={filter === 'unread' ? 'primary' : 'secondary'}
          onClick={() => setFilter('unread')}
        >
          Okunmamış
        </Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {notifications.length === 0 ? (
          <Card>
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              <Bell size={32} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
              Bildirim bulunamadı
            </div>
          </Card>
        ) : (
          notifications.map((n) => (
            <Card
              key={n.id}
              className={!n.isRead ? 'notification-unread' : ''}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  cursor: 'pointer',
                }}
                onClick={() => handleMarkRead(n.id, n.metadata as Record<string, unknown> | undefined)}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <Badge variant={TYPE_VARIANT[n.type] ?? 'default'}>
                      {TYPE_LABELS[n.type] ?? n.type}
                    </Badge>
                    {!n.isRead && (
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
                    )}
                  </div>
                  <strong style={{ fontSize: '0.95rem' }}>{n.title}</strong>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    {n.message}
                  </p>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {formatDateTime(n.createdAt)}
                  </span>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
