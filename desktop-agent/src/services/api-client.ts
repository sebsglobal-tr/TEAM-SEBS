import axios, { AxiosInstance } from 'axios';
import Store from 'electron-store';

const store = new Store();

const API_URL = process.env.API_URL ?? 'http://localhost:3000/api';

export class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: { 'Content-Type': 'application/json' },
    });

    this.client.interceptors.request.use((config) => {
      const token = store.get('accessToken') as string | undefined;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  setTokens(accessToken: string, refreshToken: string) {
    store.set('accessToken', accessToken);
    store.set('refreshToken', refreshToken);
  }

  clearTokens() {
    store.delete('accessToken');
    store.delete('refreshToken');
  }

  async login(email: string, password: string) {
    const { data } = await this.client.post('/auth/login', { email, password });
    this.setTokens(data.accessToken, data.refreshToken);
    return data;
  }

  async getSettings() {
    const { data } = await this.client.get('/agent/settings');
    return data;
  }

  async startSession() {
    const { data } = await this.client.post('/work-sessions/start');
    return data;
  }

  async stopSession() {
    const { data } = await this.client.post('/work-sessions/stop');
    return data;
  }

  async getToday() {
    const { data } = await this.client.get('/work-sessions/today');
    return data;
  }

  async sendHeartbeat(payload: Record<string, unknown>) {
    const { data } = await this.client.post('/agent/heartbeat', payload);
    return data;
  }

  async sendEvent(payload: Record<string, unknown>) {
    const { data } = await this.client.post('/agent/event', payload);
    return data;
  }

  async sync(payload: { heartbeats: unknown[]; events: unknown[] }) {
    const { data } = await this.client.post('/agent/sync', payload);
    return data;
  }
}
