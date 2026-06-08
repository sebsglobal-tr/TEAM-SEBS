export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}s ${m}dk`;
  if (m > 0) return `${m}dk ${s}sn`;
  return `${s}sn`;
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const STATUS_LABELS: Record<string, string> = {
  ONLINE_ACTIVE: 'Aktif',
  ONLINE_IDLE: 'Boşta',
  SCREEN_LOCKED: 'Ekran Kilitli',
  ON_BREAK: 'Molada',
  OFFLINE: 'Çevrimdışı',
  WORK_SESSION_ENDED: 'Oturum Bitti',
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  TODO: 'Yapılacak',
  IN_PROGRESS: 'Devam Ediyor',
  WAITING_REVIEW: 'İnceleme Bekliyor',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal',
};

export const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Düşük',
  MEDIUM: 'Orta',
  HIGH: 'Yüksek',
  URGENT: 'Acil',
};

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Süper Admin',
  MANAGER: 'Yönetici',
  EMPLOYEE: 'Çalışan',
};
