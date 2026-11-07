import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { comparePassword, hashPassword, issueTokens, revokeAllUserTokens, revokeToken, rotateRefreshToken } from '../../lib/auth.js';
import { prisma } from '../../lib/prisma.js';
import { sanitizePlainText } from '../../lib/sanitizer.js';
import { requireAuth } from '../../middlewares/authGuard.js';

// Строгая проверка сложности пароля (минимум 8 символов, буквы + цифры)
const passwordValidator = z.string()
  .min(8, 'Пароль должен быть не менее 8 символов')
  .regex(/^(?=.*[A-Za-z])(?=.*\d)/, 'Пароль должен содержать хотя бы одну букву и одну цифру');

const registerSchema = z.object({
  email: z.string().email('Некорректный email').toLowerCase().trim(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Никнейм может содержать только латиницу, цифры и _').optional(),
  nick: z.string().min(3).max(30).optional(), // поддержка фронтенда
  password: passwordValidator.optional(),
  pass: passwordValidator.optional(), // поддержка фронтенда
  displayName: z.string().max(50).optional()
}).refine((data) => data.username || data.nick, {
  message: 'Необходимо указать username или nick',
  path: ['username']
}).refine((data) => data.password || data.pass, {
  message: 'Необходимо указать password или pass',
  path: ['password']
});

const loginSchema = z.object({
  login: z.string().min(1, 'Введите email или никнейм').trim(),
  password: z.string().min(1, 'Введите пароль').optional(),
  pass: z.string().min(1, 'Введите пароль').optional()
}).refine((data) => data.password || data.pass, {
  message: 'Необходимо указать пароль',
  path: ['password']
});

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Регистрация (Строгий Rate Limit: максимум 3 попытки в минуту на IP для защиты от ботов)
  fastify.post('/register', { config: { rateLimit: { max: 3, timeWindow: '1 minute' } } }, async (request, reply) => {
    const parse = registerSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'ValidationError', details: parse.error.format() });
    }

    const username = sanitizePlainText((parse.data.username || parse.data.nick)!.toLowerCase());
    const password = (parse.data.password || parse.data.pass)!;
    const { email } = parse.data;
    const displayName = parse.data.displayName ? sanitizePlainText(parse.data.displayName) : username;

    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email: email.toLowerCase() }, { username: username }]
      }
    });

    if (existing) {
      const field = existing.email.toLowerCase() === email.toLowerCase() ? 'email' : 'username';
      return reply.status(409).send({ error: 'Conflict', message: `Пользователь с таким ${field} уже существует` });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        username: username,
        displayName: displayName,
        passwordHash,
        xp: 10,
        level: 1
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        role: true,
        xp: true,
        level: true,
        avatarUrl: true,
        createdAt: true
      }
    });

    const tokens = await issueTokens(
      { id: user.id, username: user.username, email: user.email, role: user.role },
      fastify.jwt.sign.bind(fastify.jwt)
    );

    return reply.status(201).send({
      user,
      token: tokens.accessToken, // для обратной совместимости
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn
    });
  });

  // Вход (Строгий Rate Limit: максимум 5 попыток в минуту на IP для защиты от подбора паролей)
  fastify.post('/login', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
    const parse = loginSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'ValidationError', details: parse.error.format() });
    }

    const { login } = parse.data;
    const password = (parse.data.password || parse.data.pass)!;
    const l = login.trim().toLowerCase();

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: l }, { username: l }]
      }
    });

    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Пользователь не найден' });
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Неверный пароль' });
    }

    const tokens = await issueTokens(
      { id: user.id, username: user.username, email: user.email, role: user.role },
      fastify.jwt.sign.bind(fastify.jwt)
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        xp: user.xp,
        level: user.level,
        avatarUrl: user.avatarUrl
      },
      token: tokens.accessToken,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn
    };
  });

  // Обновление Access-токена через Refresh-токен
  fastify.post('/refresh', async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken?: string };
    if (!refreshToken) {
      return reply.status(400).send({ error: 'BadRequest', message: 'Не передан refreshToken' });
    }

    const newTokens = await rotateRefreshToken(refreshToken, fastify.jwt.sign.bind(fastify.jwt));
    if (!newTokens) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Refresh-токен недействителен или истек' });
    }

    return {
      token: newTokens.accessToken,
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
      expiresIn: newTokens.expiresIn
    };
  });

  // Выход из системы (отзыв текущей сессии)
  fastify.post('/logout', async (request) => {
    const { refreshToken } = request.body as { refreshToken?: string };
    if (refreshToken) {
      await revokeToken(refreshToken);
    }
    return { message: 'Успешный выход из системы' };
  });

  // Выход со всех устройств (смена пароля / компрометация)
  fastify.post('/revoke-all', { preHandler: requireAuth }, async (request) => {
    await revokeAllUserTokens(request.user!.id);
    return { message: 'Все активные сессии успешно завершены' };
  });

  // Текущий профиль
  fastify.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.user!.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        role: true,
        bio: true,
        skills: true,
        xp: true,
        level: true,
        avatarUrl: true,
        createdAt: true,
        orgMemberships: {
          include: { organization: true }
        },
        teamMemberships: {
          include: { team: { include: { jam: true, submission: true } } }
        }
      }
    });

    if (!user) {
      return reply.status(404).send({ error: 'NotFound', message: 'Пользователь не найден' });
    }

    return user;
  });
};
