import { api } from './api';

export interface FileRecord {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  fileType: string;
  taskId?: string;
  description?: string;
  uploadedBy?: { id: string; firstName: string; lastName: string };
  task?: { id: string; title: string };
  createdAt: string;
}

export const filesService = {
  getAll: (params?: { taskId?: string; fileType?: string; limit?: number }) =>
    api.get<FileRecord[]>('/files', { params }).then((r) => r.data),

  upload: (file: File, options?: { taskId?: string; fileType?: string; description?: string }) => {
    const formData = new FormData();
    formData.append('file', file);
    if (options?.taskId) formData.append('taskId', options.taskId);
    if (options?.fileType) formData.append('fileType', options.fileType);
    if (options?.description) formData.append('description', options.description);

    return api
      .post<FileRecord>('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  download: async (id: string, filename: string) => {
    const response = await api.get(`/files/${id}/download`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  },

  remove: (id: string) => api.delete(`/files/${id}`).then((r) => r.data),
};
