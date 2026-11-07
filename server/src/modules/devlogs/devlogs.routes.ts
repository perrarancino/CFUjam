import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { resolveJam } from '../../lib/jamResolver.js';
import { prisma } from '../../lib/prisma.js';
import { realtime } from '../../lib/realtime.js';
import { sanitizePlainText, sanitizeRichText } from '../../lib/sanitizer.js';
import { optionalAuth, requireAuth } from '../../middlewares/authGuard.js';

const createDevlogSchema = z.object({
  title: z.string().min(2, 'Заголовок минимум 2 символа').max(120),
  content: z.string().min(10, 'Текст публикации минимум 10 символов').max(5000),
  images: z.array(z.string().url()).optional().default([])
});

export const devlogRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. Получить ленту дневников разработки джема
  fastify.get('/jams/:slug/devlogs', { preHandler: optionalAuth }, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const { teamId } = request.query as { teamId?: string };
    const currentUserId = request.user?.id;

    const jam = await resolveJam(slug, request);
    if (!jam) return reply.status(404).send({ error: 'NotFound', message: 'Джем не найден' });

    const where: any = { jamId: jam.id };
    if (teamId) where.teamId = teamId;

    const posts = await prisma.devlogPost.findMany({
      where,
      include: {
        author: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, role: true }
        },
        team: {
          select: { id: true, name: true }
        },
        likes: currentUserId ? { where: { userId: currentUserId }, select: { id: true } } : false
      },
      orderBy: { createdAt: 'desc' }
    });

    return posts.map((p) => ({
      id: p.id,
      title: p.title,
      content: p.content,
      images: p.images,
      likesCount: p.likesCount,
      createdAt: p.createdAt,
      author: p.author,
      team: p.team,
      iLiked: Array.isArray(p.likes) && p.likes.length > 0
    }));
  });

  // 2. Опубликовать запись в дневник разработки команды
  fastify.post('/jams/:slug/devlogs', { preHandler: requireAuth }, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const parse = createDevlogSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'ValidationError', details: parse.error.format() });
    }

    const userId = request.user!.id;
    const jam = await resolveJam(slug, request);
    if (!jam) return reply.status(404).send({ error: 'NotFound', message: 'Джем не найден' });

    // Проверяем, что пользователь состоит в команде этого джема
    const membership = await prisma.teamMember.findFirst({
      where: {
        userId,
        team: { jamId: jam.id }
      },
      include: { team: true }
    });

    if (!membership) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Публиковать записи в дневник могут только участники зарегистрированных команд этого джема'
      });
    }

    const { title, content, images } = parse.data;

    const post = await prisma.devlogPost.create({
      data: {
        jamId: jam.id,
        teamId: membership.teamId,
        authorId: userId,
        title: sanitizePlainText(title),
        content: sanitizeRichText(content),
        images: images || []
      },
      include: {
        author: {
          select: { id: true, username: true, displayName: true, avatarUrl: true }
        },
        team: {
          select: { id: true, name: true }
        }
      }
    });

    // Начисление XP за публикацию в дневник
    await prisma.user.update({
      where: { id: userId },
      data: { xp: { increment: 10 } }
    });

    // Оповещение всех участников джема в реальном времени через SSE
    realtime.broadcastToJam(jam.slug, 'NEW_DEVLOG', {
      id: post.id,
      title: post.title,
      teamName: post.team.name,
      authorName: post.author.displayName || post.author.username
    });

    return reply.status(201).send(post);
  });

  // 3. Поставить / снять лайк записи дневника
  fastify.post('/devlogs/:id/like', { preHandler: requireAuth }, async (request, reply) => {
    const { id: postId } = request.params as { id: string };
    const userId = request.user!.id;

    const post = await prisma.devlogPost.findUnique({ where: { id: postId } });
    if (!post) return reply.status(404).send({ error: 'NotFound', message: 'Запись не найдена' });

    const existing = await prisma.devlogLike.findUnique({
      where: { postId_userId: { postId, userId } }
    });

    if (existing) {
      await prisma.$transaction([
        prisma.devlogLike.delete({ where: { id: existing.id } }),
        prisma.devlogPost.update({ where: { id: postId }, data: { likesCount: { decrement: 1 } } })
      ]);
      return { liked: false };
    } else {
      await prisma.$transaction([
        prisma.devlogLike.create({ data: { postId, userId } }),
        prisma.devlogPost.update({ where: { id: postId }, data: { likesCount: { increment: 1 } } })
      ]);
      // Добавляем автору записи немного опыта
      await prisma.user.update({ where: { id: post.authorId }, data: { xp: { increment: 2 } } });
      return { liked: true };
    }
  });

  // 4. Удалить запись дневника
  fastify.delete('/devlogs/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.id;

    const post = await prisma.devlogPost.findUnique({
      where: { id },
      include: { team: true, jam: true }
    });

    if (!post) return reply.status(404).send({ error: 'NotFound', message: 'Запись не найдена' });

    const isAuthor = post.authorId === userId;
    const isTeamLeader = post.team.leaderId === userId;
    const isOrganizer = post.jam.organizerId === userId || request.user?.role === 'ADMIN';

    if (!isAuthor && !isTeamLeader && !isOrganizer) {
      return reply.status(403).send({ error: 'Forbidden', message: 'У вас нет прав на удаление этой записи' });
    }

    await prisma.devlogPost.delete({ where: { id } });
    return { message: 'Запись успешно удалена' };
  });
};
