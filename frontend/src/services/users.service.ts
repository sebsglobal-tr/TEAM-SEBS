import { api } from './api';
import type { User } from '../types';

export interface EmployeeUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  position?: string;
  department?: { id: string; name: string };
  manager?: { id: string; firstName: string; lastName: string; email: string } | null;
  createdAt: string;
}

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
    managerId?: string;
  }) => api.post<User>('/users', data).then((r) => r.data),

  update: (id: string, data: Record<string, unknown>) =>
    api.patch<User>(`/users/${id}`, data).then((r) => r.data),

  deactivate: (id: string) =>
    api.patch<User>(`/users/${id}/deactivate`).then((r) => r.data),

  getEmployees: (params?: { status?: string; search?: string; managerId?: string }) =>
    api.get<EmployeeUser[]>('/users/employees', { params }).then((r) => r.data),

  getManagers: () =>
    api.get('/users/managers').then((r) => r.data),
};
