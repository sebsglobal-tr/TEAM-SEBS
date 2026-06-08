import { api } from './api';
import type { Notification } from '../types';

export const notificationsService = {
  getAll: (unreadOnly = false) =>
    api
      .get<Notification[]>('/notifications', { params: { unreadOnly: unreadOnly ? 'true' : undefined } })
      .then((r) => r.data),

  getUnreadCount: () =>
    api.get<number>('/notifications/unread-count').then((r) => r.data),

  markAsRead: (id: string) =>
    api.patch(`/notifications/${id}/read`).then((r) => r.data),

  markAllAsRead: () =>
    api.patch('/notifications/read-all').then((r) => r.data),
};
