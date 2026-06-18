import { api } from './api';

export interface Setting {
  id: string;
  key: string;
  value: string;
  createdAt: string;
  updatedAt: string;
}

export const settingsService = {
  getAll: () => api.get<Setting[]>('/settings').then((r) => r.data),

  update: (settings: Array<{ key: string; value: string }>) =>
    api.patch('/settings', { settings }).then((r) => r.data),
};
