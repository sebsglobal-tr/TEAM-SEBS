import { api } from './api';
import type { Task } from '../types';

export const tasksService = {
  getAll: (params?: Record<string, string | undefined>) =>
    api.get<Task[]>('/tasks', { params }).then((r) => r.data),

  getById: (id: string) => api.get<Task>(`/tasks/${id}`).then((r) => r.data),

  getStats: () => api.get('/tasks/stats').then((r) => r.data),

  create: (data: Record<string, unknown>) =>
    api.post<Task>('/tasks', data).then((r) => r.data),

  /** Admin bulk creates multiple tasks at once */
  createBulk: (tasks: Array<Record<string, unknown>>) =>
    api.post('/tasks/bulk', tasks).then((r) => r.data),

  update: (id: string, data: Record<string, unknown>) =>
    api.patch<Task>(`/tasks/${id}`, data).then((r) => r.data),

  updateStatus: (id: string, status: string, note?: string) =>
    api.patch<Task>(`/tasks/${id}/status`, { status, note }).then((r) => r.data),

  addComment: (id: string, message: string, commentType?: string) =>
    api.post(`/tasks/${id}/comments`, { message, commentType }).then((r) => r.data),

  addFile: (id: string, data: { fileName: string; fileUrl: string; fileType: string; fileSize: number }) =>
    api.post(`/tasks/${id}/files`, data).then((r) => r.data),

  getFiles: (id: string) => api.get(`/tasks/${id}/files`).then((r) => r.data),

  getHistory: (id: string) => api.get(`/tasks/${id}/history`).then((r) => r.data),

  // ─── Assignment Flow ─────────────────────────────────────

  assignToManager: (taskId: string, managerId: string) =>
    api.patch<Task>(`/tasks/${taskId}/assign`, { assigneeId: managerId }).then((r) => r.data),

  assignToEmployee: (taskId: string, employeeId: string) =>
    api.patch<Task>(`/tasks/${taskId}/assign-employee`, { assigneeId: employeeId }).then((r) => r.data),

  splitTask: (taskId: string, subtasks: Array<{ title: string; assignedToId?: string }>) =>
    api.post(`/tasks/${taskId}/split`, { subtasks }).then((r) => r.data),
};
