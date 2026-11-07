import { EventEmitter } from 'events';
import { FastifyReply, FastifyRequest } from 'fastify';

interface SSEClient {
  id: string;
  userId?: string;
  jamSlug?: string;
  reply: FastifyReply;
}

class RealtimeHub extends EventEmitter {
  private clients: Map<string, SSEClient> = new Map();

  addClient(id: string, reply: FastifyReply, userId?: string, jamSlug?: string) {
    this.clients.set(id, { id, userId, jamSlug, reply });

    // Отправляем начальное подключение и серверное время
    reply.raw.write(`event: connected\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);

    reply.raw.on('close', () => {
      this.clients.delete(id);
    });
  }

  /**
   * Отправить событие конкретному джему (например, открытие темы или смена фазы)
   */
  broadcastToJam(jamSlug: string, event: string, data: any) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients.values()) {
      if (!client.jamSlug || client.jamSlug === jamSlug) {
        try {
          client.reply.raw.write(payload);
        } catch {
          this.clients.delete(client.id);
        }
      }
    }
  }

  /**
   * Отправить личное уведомление пользователю (инвайт, отзыв, опыт)
   */
  sendToUser(userId: string, event: string, data: any) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients.values()) {
      if (client.userId === userId) {
        try {
          client.reply.raw.write(payload);
        } catch {
          this.clients.delete(client.id);
        }
      }
    }
  }

  /**
   * Синхронизация времени каждые 10 секунд для идеального обратного отсчета
   */
  startHeartbeat() {
    setInterval(() => {
      const payload = `event: ping\ndata: ${JSON.stringify({ serverTime: Date.now() })}\n\n`;
      for (const client of this.clients.values()) {
        try {
          client.reply.raw.write(payload);
        } catch {
          this.clients.delete(client.id);
        }
      }
    }, 15000);
  }
}

export const realtime = new RealtimeHub();
realtime.startHeartbeat();
