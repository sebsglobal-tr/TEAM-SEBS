import { app, BrowserWindow, Tray, Menu, powerMonitor, nativeImage } from 'electron';
import path from 'path';
import { ActivityTracker } from './activity-tracker';
import { ApiClient } from '../services/api-client';
import { SyncQueue } from '../sync/sync-queue';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let tracker: ActivityTracker | null = null;
const apiClient = new ApiClient();
const syncQueue = new SyncQueue();

const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 600,
    resizable: false,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'WorkTrack Agent',
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3001');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
}

function createTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('WorkTrack Agent');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Göster', click: () => mainWindow?.show() },
    { label: 'Çalışmaya Başla', click: () => mainWindow?.webContents.send('tray-action', 'start') },
    { label: 'Molaya Çık', click: () => mainWindow?.webContents.send('tray-action', 'break') },
    { type: 'separator' },
    { label: 'Çıkış', click: () => { app.isQuitting = true; app.quit(); } },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => mainWindow?.show());
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  tracker = new ActivityTracker({
    apiClient,
    syncQueue,
    onStatusChange: (status) => {
      mainWindow?.webContents.send('status-update', status);
    },
  });

  powerMonitor.on('lock-screen', () => tracker?.handleScreenLock());
  powerMonitor.on('unlock-screen', () => tracker?.handleScreenUnlock());
  powerMonitor.on('suspend', () => tracker?.handleOffline());
  powerMonitor.on('resume', () => tracker?.handleResume());

  app.on('activate', () => {
    if (!mainWindow) createWindow();
    else mainWindow.show();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  await tracker?.shutdown();
});
