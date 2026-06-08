import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('worktrack', {
  onStatusUpdate: (callback: (status: unknown) => void) => {
    ipcRenderer.on('status-update', (_event, status) => callback(status));
  },
  onTrayAction: (callback: (action: string) => void) => {
    ipcRenderer.on('tray-action', (_event, action) => callback(action));
  },
});
