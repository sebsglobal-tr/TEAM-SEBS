import { api } from './api';
import type { Department } from '../types';

export const departmentsService = {
  getAll: () => api.get<Department[]>('/departments').then((r) => r.data),

  getById: (id: string) => api.get<Department>(`/departments/${id}`).then((r) => r.data),

  create: (data: { name: string; description?: string; managerId?: string }) =>
    api.post<Department>('/departments', data).then((r) => r.data),

  update: (id: string, data: Partial<Department>) =>
    api.patch<Department>(`/departments/${id}`, data).then((r) => r.data),
};
