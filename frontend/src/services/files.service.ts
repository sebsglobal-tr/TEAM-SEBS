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

  uploadMultiple: (files: File[], options?: { taskId?: string; fileType?: string }) => {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    if (options?.taskId) formData.append('taskId', options.taskId);
    if (options?.fileType) formData.append('fileType', options.fileType);

    return api
      .post<{ count: number; files: FileRecord[] }>('/files/upload-multiple', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  /**
   * Dosyayı indirir.
   * @param idOrUrl File ID'si veya "/api/files/{id}/download" şeklinde tam URL
   * @param filename İndirilen dosyaya verilecek ad
   */
  download: async (idOrUrl: string, filename: string) => {
    // Tam URL verilmişse (örn. /api/files/{id}/download) File ID'sini çıkar
    const fileId = idOrUrl.startsWith('/api/')
      ? idOrUrl.replace('/api/files/', '').replace('/download', '').split('?')[0]
      : idOrUrl;
    try {
      const response = await api.get(`/files/${fileId}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      // responseType:'blob' olduğunda hata yanıtları Blob olarak gelir, JSON çözümlemesi yap
      if (err.response?.data instanceof Blob) {
        try {
          const text = await (err.response.data as Blob).text();
          const parsed = JSON.parse(text);
          err.response.data = parsed;
        } catch { /* blob JSON değilse sorun değil */ }
      }
      throw err;
    }
  },

  remove: (id: string) => api.delete(`/files/${id}`).then((r) => r.data),
};
