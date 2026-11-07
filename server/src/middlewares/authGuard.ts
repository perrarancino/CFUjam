import { FastifyReply, FastifyRequest } from 'fastify';
import { JwtUserPayload } from '../lib/auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtUserPayload;
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.status(401).send({ error: 'Unauthorized', message: 'Необходима авторизация' });
  }
}

export function requireRole(...allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await requireAuth(request, reply);
    if (!request.user || !allowedRoles.includes(request.user.role)) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Недостаточно прав' });
    }
  };
}

export async function optionalAuth(request: FastifyRequest) {
  try {
    await request.jwtVerify();
  } catch {
    // Пользователь - гость, пропускаем
  }
}
