import { api } from './api';
import type { Task } from '../types';

export const tasksService = {
  getAll: (params?: Record<string, string | undefined>) =>
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

  update: (id: string, data: Record<string, unknown>) =>
    api.patch<Task>(`/tasks/${id}`, data).then((r) => r.data),

  updateStatus: (id: string, status: string, note?: string) =>
    api.patch<Task>(`/tasks/${id}/status`, { status, note }).then((r) => r.data),

  addComment: (id: string, comment: string) =>
    api.post(`/tasks/${id}/comments`, { comment }).then((r) => r.data),

  // ─── Hierarchical Assignment ─────────────────────────────────────

  /** Admin assigns a task (or pool task) to a manager */
  assignToManager: (taskId: string, managerId: string) =>
    api.patch<Task>(`/tasks/${taskId}/assign`, { assigneeId: managerId }).then((r) => r.data),

  /** Manager assigns a task to an employee */
  assignToEmployee: (taskId: string, employeeId: string) =>
    api.patch<Task>(`/tasks/${taskId}/assign-employee`, { assigneeId: employeeId }).then((r) => r.data),

  /** Manager splits a task into subtasks for employees */
  splitTask: (taskId: string, subtasks: Array<{ title: string; assignedToId?: string }>) =>
    api.post(`/tasks/${taskId}/split`, { subtasks }).then((r) => r.data),
};
