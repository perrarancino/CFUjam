import { FastifyPluginAsync } from 'fastify';
import { realtime } from '../../lib/realtime.js';
import { optionalAuth } from '../../middlewares/authGuard.js';

export const realtimeRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. Поток событий джема (SSE: Server-Sent Events)
  // Используется фронтендом для обратного отсчета, моментального открытия темы и обновления фаз
  fastify.get('/jams/:slug/live', { preHandler: optionalAuth }, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const clientId = Math.random().toString(36).substring(2);
    const userId = request.user?.id;

    // Устанавливаем SSE заголовки
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no'); // Отключение буферизации Nginx
    reply.raw.flushHeaders();

    realtime.addClient(clientId, reply, userId, slug);

    // Удерживаем соединение открытым
    await new Promise(() => {});
  });

  // 2. Личные живые уведомления пользователя
  fastify.get('/notifications/live', { preHandler: optionalAuth }, async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const clientId = Math.random().toString(36).substring(2);

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');
    reply.raw.flushHeaders();

    realtime.addClient(clientId, reply, request.user.id);

    await new Promise(() => {});
  });
};
