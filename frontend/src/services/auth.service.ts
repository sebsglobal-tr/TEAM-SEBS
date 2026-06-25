import { api } from './api';
import type { AuthResponse, User } from '../types';

export const authService = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }).then((r) => r.data),

  logout: (refreshToken?: string) =>
    api.post('/auth/logout', { refreshToken }).then((r) => r.data),

  getMe: () => api.get<User>('/auth/me').then((r) => r.data),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }).then((r) => r.data),

  getSessions: () =>
    api.get<Array<{ id: string; createdAt: string; expiresAt: string; isExpired: boolean }>>('/auth/sessions').then((r) => r.data),

  revokeSession: (id: string) =>
    api.delete(`/auth/sessions/${id}`).then((r) => r.data),

  revokeAllSessions: (currentRefreshToken?: string) =>
    api.delete('/auth/sessions', { data: { currentToken: currentRefreshToken } }).then((r) => r.data),
};
