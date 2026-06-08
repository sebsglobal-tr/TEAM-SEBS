import Store from 'electron-store';
import { ApiClient } from '../services/api-client';

interface QueueData {
  heartbeats: Record<string, unknown>[];
  events: Record<string, unknown>[];
}

const store = new Store<{ queue: QueueData }>({
  defaults: { queue: { heartbeats: [], events: [] } },
});

export class SyncQueue {
  enqueueHeartbeat(payload: Record<string, unknown>) {
    const queue = store.get('queue');
    queue.heartbeats.push({ ...payload, queuedAt: new Date().toISOString() });
    store.set('queue', queue);
  }

  enqueueEvent(payload: Record<string, unknown>) {
    const queue = store.get('queue');
    queue.events.push({ ...payload, queuedAt: new Date().toISOString() });
    store.set('queue', queue);
  }

  async flush(apiClient: ApiClient) {
    const queue = store.get('queue');
    if (queue.heartbeats.length === 0 && queue.events.length === 0) return;

    try {
      await apiClient.sync({
        heartbeats: queue.heartbeats,
        events: queue.events,
      });
      store.set('queue', { heartbeats: [], events: [] });
    } catch {
      // Keep queue for next attempt
    }
  }

  getPendingCount(): number {
    const queue = store.get('queue');
    return queue.heartbeats.length + queue.events.length;
  }
}
