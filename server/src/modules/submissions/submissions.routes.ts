import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { resolveJam } from '../../lib/jamResolver.js';
import { prisma } from '../../lib/prisma.js';
import { optionalAuth, requireAuth } from '../../middlewares/authGuard.js';

const submitGameSchema = z.object({
  title: z.string().min(2).max(100),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/),
  tagline: z.string().max(200).optional(),
  description: z.string().min(10),
  engine: z.string().optional(),
  coverUrl: z.string().optional(),
  screenshots: z.array(z.string().url()).optional().default([]),
  webPlayableUrl: z.string().url().optional().or(z.literal(''))
});

export const submissionRoutes: FastifyPluginAsync = async (fastify) => {
  // Список игр джема
  fastify.get('/jams/:slug/submissions', { preHandler: optionalAuth }, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const { engine, search } = request.query as { engine?: string; search?: string };
    const currentUserId = request.user?.id;

    const jam = await resolveJam(slug, request);
    if (!jam) return reply.status(404).send({ error: 'NotFound', message: 'Джем не найден' });

    const where: any = { jamId: jam.id, isPublished: true };
    if (engine) where.engine = { equals: engine, mode: 'insensitive' };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const items = await prisma.submission.findMany({
      where,
      include: {
        team: {
          select: {
            id: true,
            name: true,
            members: {
              include: {
                user: { select: { id: true, username: true, displayName: true, avatarUrl: true } }
              }
            }
          }
        },
        files: true,
        _count: {
          select: { likes: true, votes: true }
        },
        likes: currentUserId ? { where: { userId: currentUserId }, select: { id: true } } : false
      },
      orderBy: { createdAt: 'desc' }
    });

    // Добавляем флаг iLiked для удобства фронтенда
    return items.map((g) => ({
      ...g,
      likesCount: g._count.likes,
      votesCount: g._count.votes,
      iLiked: Array.isArray(g.likes) && g.likes.length > 0
    }));
  });

  // Получить одну игру
  fastify.get('/submissions/:id', { preHandler: optionalAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const currentUserId = request.user?.id;

    const game = await prisma.submission.findUnique({
      where: { id },
      include: {
        team: {
          include: {
            members: {
              include: {
                user: { select: { id: true, username: true, displayName: true, avatarUrl: true } }
              }
            }
          }
        },
        jam: {
          select: { id: true, slug: true, title: true, status: true, votingType: true }
        },
        files: true,
        _count: {
          select: { likes: true, votes: true }
        },
        likes: currentUserId ? { where: { userId: currentUserId }, select: { id: true } } : false
      }
    });

    if (!game) return reply.status(404).send({ error: 'NotFound', message: 'Игра не найдена' });

    return {
      ...game,
      likesCount: game._count.likes,
      votesCount: game._count.votes,
      iLiked: Array.isArray(game.likes) && game.likes.length > 0
    };
  });

  // Загрузить / опубликовать игру от имени команды
  fastify.post('/jams/:slug/submissions', { preHandler: requireAuth }, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const parse = submitGameSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'ValidationError', details: parse.error.format() });
    }

    const userId = request.user!.id;
    const jam = await resolveJam(slug, request);
    if (!jam) return reply.status(404).send({ error: 'NotFound', message: 'Джем не найден' });

    // Проверяем статус джема
    if (['SUBMISSION_CLOSED', 'VOTING', 'FINISHED'].includes(jam.status)) {
      return reply.status(400).send({ error: 'BadRequest', message: 'Приём сборок на этот джем уже закрыт' });
    }

    const isLate = jam.status === 'GRACE_PERIOD';

    // Ищем команду пользователя в этом джеме, где он лидер
    const team = await prisma.team.findFirst({
      where: { jamId: jam.id, leaderId: userId }
    });

    if (!team) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Только лидер команды может публиковать игру' });
    }

    const data = parse.data;

    // Создаем или обновляем сабмишен
    const submission = await prisma.submission.upsert({
      where: { teamId: team.id },
      create: {
        jamId: jam.id,
        teamId: team.id,
        title: data.title,
        slug: data.slug,
        tagline: data.tagline,
        description: data.description,
        engine: data.engine,
        coverUrl: data.coverUrl,
        screenshots: data.screenshots || [],
        webPlayableUrl: data.webPlayableUrl || null,
        isLate
      },
      update: {
        title: data.title,
        slug: data.slug,
        tagline: data.tagline,
        description: data.description,
        engine: data.engine,
        coverUrl: data.coverUrl,
        screenshots: data.screenshots || [],
        webPlayableUrl: data.webPlayableUrl || null,
        isLate: isLate ? true : undefined
      }
    });

    await prisma.user.update({
      where: { id: userId },
      data: { xp: { increment: 50 } }
    });

    return reply.status(201).send(submission);
  });

  // Лайкнуть игру (toggle)
  fastify.post('/submissions/:id/like', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.id;

    const existing = await prisma.submissionLike.findUnique({
      where: { submissionId_userId: { submissionId: id, userId } }
    });

    if (existing) {
      await prisma.submissionLike.delete({ where: { id: existing.id } });
      return { liked: false };
    } else {
      await prisma.submissionLike.create({
        data: { submissionId: id, userId }
      });
      await prisma.user.update({
        where: { id: userId },
        data: { xp: { increment: 3 } }
      });
      return { liked: true };
    }
  });
};
