import { api } from './api';
import type { User } from '../types';

export const usersService = {
  getAll: (params?: { departmentId?: string; status?: string; search?: string }) =>
    api.get<User[]>('/users', { params }).then((r) => r.data),

  getById: (id: string) => api.get<User>(`/users/${id}`).then((r) => r.data),

  create: (data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    role?: string;
    departmentId?: string;
    position?: string;
  }) => api.post<User>('/users', data).then((r) => r.data),

  update: (id: string, data: Partial<User>) =>
    api.patch<User>(`/users/${id}`, data).then((r) => r.data),

  deactivate: (id: string) =>
    api.patch<User>(`/users/${id}/deactivate`).then((r) => r.data),
};
