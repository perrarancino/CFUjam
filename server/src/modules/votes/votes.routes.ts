import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middlewares/authGuard.js';

const voteSchema = z.object({
  criteriaScores: z.array(z.object({
    criteriaId: z.string().uuid(),
    score: z.number().int().min(1).max(5)
  })),
  feedback: z.string().max(1000).optional()
});

export const voteRoutes: FastifyPluginAsync = async (fastify) => {
  // Проголосовать за игру по критериям джема
  fastify.post('/submissions/:id/vote', { preHandler: requireAuth }, async (request, reply) => {
    const { id: submissionId } = request.params as { id: string };
    const parse = voteSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'ValidationError', details: parse.error.format() });
    }

    const userId = request.user!.id;
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { jam: true, team: true }
    });

    if (!submission) return reply.status(404).send({ error: 'NotFound', message: 'Игра не найдена' });

    // Запрет голосовать за свою собственную игру
    const isAuthor = await prisma.teamMember.findFirst({
      where: { teamId: submission.teamId, userId }
    });
    if (isAuthor) {
      return reply.status(400).send({ error: 'BadRequest', message: 'Нельзя голосовать за работу своей команды' });
    }

    // Проверяем статус джема
    if (submission.jam.status !== 'VOTING') {
      return reply.status(400).send({ error: 'BadRequest', message: 'Голосование для этого джема сейчас закрыто' });
    }

    const { criteriaScores, feedback } = parse.data;

    // Сохраняем оценки в транзакции
    await prisma.$transaction(
      criteriaScores.map((c) =>
        prisma.vote.upsert({
          where: {
            submissionId_criteriaId_userId: {
              submissionId,
              criteriaId: c.criteriaId,
              userId
            }
          },
          create: {
            submissionId,
            criteriaId: c.criteriaId,
            userId,
            score: c.score,
            feedback
          },
          update: {
            score: c.score,
            feedback
          }
        })
      )
    );

    // Начисление опыта за конструктивное голосование
    await prisma.user.update({
      where: { id: userId },
      data: { xp: { increment: 10 } }
    });

    return { message: 'Голос успешно принят' };
  });

  // Итоговая таблица лидеров (Leaderboard) джема
  fastify.get('/jams/:slug/leaderboard', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const jam = await prisma.jam.findUnique({
      where: { slug },
      include: { criteria: true }
    });

    if (!jam) return reply.status(404).send({ error: 'NotFound', message: 'Джем не найден' });

    const submissions = await prisma.submission.findMany({
      where: { jamId: jam.id, isPublished: true },
      include: {
        team: { select: { name: true } },
        votes: { include: { criteria: true } },
        _count: { select: { likes: true, votes: true } }
      }
    });

    // Расчет средневзвешенного балла для каждой игры
    const leaderboard = submissions.map((sub) => {
      let totalWeightedScore = 0;
      let totalWeight = 0;

      const criteriaBreakdown: Record<string, { average: number; count: number }> = {};

      for (const crit of jam.criteria) {
        const critVotes = sub.votes.filter((v) => v.criteriaId === crit.id);
        if (critVotes.length > 0) {
          const avg = critVotes.reduce((sum, v) => sum + v.score, 0) / critVotes.length;
          criteriaBreakdown[crit.name] = { average: Math.round(avg * 100) / 100, count: critVotes.length };
          totalWeightedScore += avg * crit.weight;
          totalWeight += crit.weight;
        } else {
          criteriaBreakdown[crit.name] = { average: 0, count: 0 };
        }
      }

      const overallScore = totalWeight > 0 ? Math.round((totalWeightedScore / totalWeight) * 100) / 100 : 0;

      return {
        id: sub.id,
        title: sub.title,
        teamName: sub.team.name,
        coverUrl: sub.coverUrl,
        likesCount: sub._count.likes,
        votesCount: sub._count.votes,
        overallScore,
        criteriaBreakdown
      };
    });

    // Сортировка по общему баллу
    leaderboard.sort((a, b) => b.overallScore - a.overallScore || b.likesCount - a.likesCount);

    return leaderboard;
  });
};
