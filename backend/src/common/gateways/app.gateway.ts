import { Injectable } from '@nestjs/common';
import { Response } from 'express';

/**
 * Simple SSE (Server-Sent Events) notification broadcaster.
 * No WebSocket dependencies needed - works with plain HTTP.
 *
 * Usage:
 *   this.appGateway.broadcast('notification', { userId, title, message });
 *   this.appGateway.sendToUser(userId, 'notification', { title, message });
 */

@Injectable()
export class AppGateway {
  // userId -> Set of Response objects
  private connections = new Map<string, Set<Response>>();

  addConnection(userId: string, res: Response) {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    this.connections.get(userId)!.add(res);

    res.on('close', () => {
      this.connections.get(userId)?.delete(res);
      if (this.connections.get(userId)?.size === 0) {
        this.connections.delete(userId);
      }
    });
  }

  sendToUser(userId: string, event: string, data: any) {
    const sockets = this.connections.get(userId);
    if (!sockets) return;
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of sockets) {
      try { res.write(payload); } catch { /* connection lost */ }
    }
  }

  sendToAll(event: string, data: any) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [_, sockets] of this.connections) {
      for (const res of sockets) {
        try { res.write(payload); } catch { /* connection lost */ }
      }
    }
  }
}
