import { powerMonitor } from 'electron';
import { ApiClient } from '../services/api-client';
import { SyncQueue } from '../sync/sync-queue';

export interface TrackerStatus {
  isSessionActive: boolean;
  isOnBreak: boolean;
  currentStatus: string;
  workSessionId?: string;
  todayActive: number;
  todayIdle: number;
  todayBreak: number;
  isOnline: boolean;
}

interface TrackerOptions {
  apiClient: ApiClient;
  syncQueue: SyncQueue;
  onStatusChange: (status: TrackerStatus) => void;
}

export class ActivityTracker {
  private apiClient: ApiClient;
  private syncQueue: SyncQueue;
  private onStatusChange: (status: TrackerStatus) => void;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private idleCheckInterval: ReturnType<typeof setInterval> | null = null;
  private workSessionId: string | null = null;
  private isSessionActive = false;
  private isOnBreak = false;
  private currentStatus = 'OFFLINE';
  private idleThresholdMinutes = 10;
  private heartbeatIntervalSeconds = 30;
  private todayActive = 0;
  private todayIdle = 0;
  private todayBreak = 0;

  constructor(options: TrackerOptions) {
    this.apiClient = options.apiClient;
    this.syncQueue = options.syncQueue;
    this.onStatusChange = options.onStatusChange;
    this.loadSettings();
  }

  async loadSettings() {
    try {
      const settings = await this.apiClient.getSettings();
      this.idleThresholdMinutes = settings.idleThresholdMinutes;
      this.heartbeatIntervalSeconds = settings.heartbeatIntervalSeconds;
    } catch {
      // Use defaults if offline
    }
  }

  async startSession() {
    const session = await this.apiClient.startSession();
    this.workSessionId = session.id;
    this.isSessionActive = true;
    this.isOnBreak = false;
    this.currentStatus = 'ONLINE_ACTIVE';
    this.startTracking();
    this.emitStatus();
    return session;
  }

  async stopSession() {
    if (!this.isSessionActive) return;
    this.stopTracking();
    await this.apiClient.stopSession();
    this.isSessionActive = false;
    this.isOnBreak = false;
    this.workSessionId = null;
    this.currentStatus = 'WORK_SESSION_ENDED';
    this.emitStatus();
  }

  async startBreak() {
    if (!this.isSessionActive || this.isOnBreak) return;
    this.isOnBreak = true;
    this.currentStatus = 'ON_BREAK';
    await this.sendEvent('BREAK_START');
    this.emitStatus();
  }

  async endBreak() {
    if (!this.isOnBreak) return;
    this.isOnBreak = false;
    this.currentStatus = 'ONLINE_ACTIVE';
    await this.sendEvent('BREAK_END');
    this.emitStatus();
  }

  handleScreenLock() {
    if (!this.isSessionActive) return;
    this.currentStatus = 'SCREEN_LOCKED';
    this.sendEvent('SCREEN_LOCK');
    this.emitStatus();
  }

  handleScreenUnlock() {
    if (!this.isSessionActive) return;
    this.currentStatus = this.isOnBreak ? 'ON_BREAK' : 'ONLINE_ACTIVE';
    this.sendEvent('SCREEN_UNLOCK');
    this.emitStatus();
  }

  handleOffline() {
    this.currentStatus = 'OFFLINE';
    this.sendEvent('OFFLINE');
    this.emitStatus();
  }

  handleResume() {
    if (this.isSessionActive) {
      this.currentStatus = 'ONLINE_ACTIVE';
      this.sendEvent('ACTIVE');
      this.emitStatus();
    }
  }

  private startTracking() {
    this.heartbeatInterval = setInterval(() => this.sendHeartbeat(), this.heartbeatIntervalSeconds * 1000);
    this.idleCheckInterval = setInterval(() => this.checkIdle(), 5000);
  }

  private stopTracking() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.idleCheckInterval) clearInterval(this.idleCheckInterval);
    this.heartbeatInterval = null;
    this.idleCheckInterval = null;
  }

  private checkIdle() {
    if (!this.isSessionActive || this.isOnBreak) return;

    const idleSeconds = powerMonitor.getSystemIdleTime();
    const threshold = this.idleThresholdMinutes * 60;

    if (idleSeconds >= threshold && this.currentStatus === 'ONLINE_ACTIVE') {
      this.currentStatus = 'ONLINE_IDLE';
      this.sendEvent('IDLE', idleSeconds);
      this.emitStatus();
    } else if (idleSeconds < 30 && this.currentStatus === 'ONLINE_IDLE') {
      this.currentStatus = 'ONLINE_ACTIVE';
      this.sendEvent('ACTIVE');
      this.emitStatus();
    }
  }

  private async sendHeartbeat() {
    const idleSeconds = powerMonitor.getSystemIdleTime();
    const payload = {
      workSessionId: this.workSessionId ?? undefined,
      status: this.currentStatus,
      idleSeconds,
      clientVersion: '1.0.0',
    };

    try {
      await this.apiClient.sendHeartbeat(payload);
      await this.syncQueue.flush(this.apiClient);
    } catch {
      this.syncQueue.enqueueHeartbeat(payload);
    }
  }

  private async sendEvent(type: string, durationSeconds?: number) {
    const payload = {
      workSessionId: this.workSessionId ?? undefined,
      type,
      durationSeconds: durationSeconds ?? 0,
      timestamp: new Date().toISOString(),
    };

    try {
      await this.apiClient.sendEvent(payload);
    } catch {
      this.syncQueue.enqueueEvent(payload);
    }
  }

  async shutdown() {
    this.stopTracking();
    if (this.isSessionActive) {
      await this.sendHeartbeat();
      await this.stopSession();
    }
    await this.syncQueue.flush(this.apiClient);
  }

  private emitStatus() {
    this.onStatusChange({
      isSessionActive: this.isSessionActive,
      isOnBreak: this.isOnBreak,
      currentStatus: this.currentStatus,
      workSessionId: this.workSessionId ?? undefined,
      todayActive: this.todayActive,
      todayIdle: this.todayIdle,
      todayBreak: this.todayBreak,
      isOnline: true,
    });
  }
}
