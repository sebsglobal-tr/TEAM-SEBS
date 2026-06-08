import { api } from './api';
import type { Task } from '../types';

export const tasksService = {
  getAll: (params?: Record<string, string>) =>
    api.get<Task[]>('/tasks', { params }).then((r) => r.data),

  getById: (id: string) => api.get<Task>(`/tasks/${id}`).then((r) => r.data),

  create: (data: {
    title: string;
    description?: string;
    priority?: string;
    assignedToId?: string;
    departmentId?: string;
    dueDate?: string;
    estimatedMinutes?: number;
  }) => api.post<Task>('/tasks', data).then((r) => r.data),

  update: (id: string, data: Partial<Task>) =>
    api.patch<Task>(`/tasks/${id}`, data).then((r) => r.data),

  updateStatus: (id: string, status: string, note?: string) =>
    api.patch<Task>(`/tasks/${id}/status`, { status, note }).then((r) => r.data),

  addComment: (id: string, comment: string) =>
    api.post(`/tasks/${id}/comments`, { comment }).then((r) => r.data),
};
