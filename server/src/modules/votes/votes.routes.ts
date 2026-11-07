import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { resolveJam } from '../../lib/jamResolver.js';
import { prisma } from '../../lib/prisma.js';
import { RatingEngine } from '../../lib/ratingEngine.js';
import { requireAuth } from '../../middlewares/authGuard.js';

const voteSchema = z.object({
  criteriaScores: z.array(z.object({
    criteriaId: z.string().uuid(),
    score: z.number().int().min(1).max(5)
  })),
  feedback: z.string().max(1000).optional()
});

const MIN_VOTES_TO_QUALIFY = 3; // Минимум оцененных чужих игр для квалификации своей игры

export const voteRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. Проголосовать за игру (с проверкой на судью и антифродом)
  fastify.post('/submissions/:id/vote', { preHandler: requireAuth }, async (request, reply) => {
    const { id: submissionId } = request.params as { id: string };
    const parse = voteSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'ValidationError', details: parse.error.format() });
    }

    const userId = request.user!.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { jam: true, team: true }
    });

    if (!submission) return reply.status(404).send({ error: 'NotFound', message: 'Игра не найдена' });

    // Проверяем статус джема
    if (submission.jam.status !== 'VOTING') {
      return reply.status(400).send({ error: 'BadRequest', message: 'Голосование для этого джема сейчас закрыто' });
    }

    // Запрет голосовать за работу своей команды
    const isAuthor = await prisma.teamMember.findFirst({
      where: { teamId: submission.teamId, userId }
    });
    if (isAuthor) {
      return reply.status(400).send({ error: 'BadRequest', message: 'Нельзя голосовать за работу своей команды' });
    }

    // АНТИФРОД: аккаунт должен быть создан ДО дедлайна сдачи джема (защита от ботов и однодневок)
    if (user.createdAt > submission.jam.submissionEndsAt) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Голосование доступно только пользователям, зарегистрированным до дедлайна джема'
      });
    }

    // Проверяем, является ли голосующий официальным судьей джема
    const judgeRecord = await prisma.jamJudge.findUnique({
      where: { jamId_userId: { jamId: submission.jam.id, userId } }
    });
    const isJudge = !!judgeRecord;

    const { criteriaScores, feedback } = parse.data;

    // Сохраняем оценки
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
            feedback,
            isJudge
          },
          update: {
            score: c.score,
            feedback,
            isJudge
          }
        })
      )
    );

    // Начисление опыта за оценку игры
    await prisma.user.update({
      where: { id: userId },
      data: { xp: { increment: 15 } }
    });

    return { message: 'Голос успешно сохранен', isJudge };
  });

  // 2. Карма-очередь судейства (itch.io Queue): какие игры нужно оценить в первую очередь
  fastify.get('/jams/:slug/queue', { preHandler: requireAuth }, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const userId = request.user!.id;

    const jam = await resolveJam(slug, request);
    if (!jam) return reply.status(404).send({ error: 'NotFound', message: 'Джем не найден' });

    // Игры своей команды (их исключаем)
    const myTeams = await prisma.teamMember.findMany({
      where: { userId },
      select: { teamId: true }
    });
    const myTeamIds = myTeams.map((t) => t.teamId);

    // Сколько игр пользователь уже оценил
    const myVotesCount = await prisma.vote.groupBy({
      by: ['submissionId'],
      where: {
        userId,
        submission: { jamId: jam.id }
      }
    });
    const votedSubmissionIds = myVotesCount.map((v) => v.submissionId);

    // Подбираем игры с наименьшим количеством голосов
    const queue = await prisma.submission.findMany({
      where: {
        jamId: jam.id,
        isPublished: true,
        teamId: { notIn: myTeamIds },
        id: { notIn: votedSubmissionIds }
      },
      include: {
        team: { select: { name: true } },
        _count: { select: { votes: true } }
      },
      orderBy: { votes: { _count: 'asc' } },
      take: 5
    });

    return {
      reviewedCount: votedSubmissionIds.length,
      requiredCount: MIN_VOTES_TO_QUALIFY,
      isQualified: votedSubmissionIds.length >= MIN_VOTES_TO_QUALIFY,
      nextGamesToJudge: queue.map((g) => ({
        id: g.id,
        title: g.title,
        coverUrl: g.coverUrl,
        teamName: g.team.name,
        votesReceived: g._count.votes
      }))
    };
  });

  // 3. Лидерборд с математической нормализацией (Trimmed Mean + Разделение Жюри / Игроки)
  fastify.get('/jams/:slug/leaderboard', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const jam = await resolveJam(slug, request);
    if (!jam) return reply.status(404).send({ error: 'NotFound', message: 'Джем не найден' });

    const criteria = await prisma.jamCriteria.findMany({
      where: { jamId: jam.id },
      orderBy: { order: 'asc' }
    });

    const submissions = await prisma.submission.findMany({
      where: { jamId: jam.id, isPublished: true },
      include: {
        team: {
          select: {
            name: true,
            leader: { select: { username: true, displayName: true } }
          }
        },
        votes: {
          select: { criteriaId: true, score: true, isJudge: true }
        },
        _count: { select: { likes: true, votes: true } }
      }
    });

    const evaluated = submissions.map((sub) => {
      const metrics = RatingEngine.evaluateSubmission(
        criteria.map((c) => ({ id: c.id, name: c.name, weight: c.weight })),
        sub.votes,
        jam.votingType
      );

      return {
        id: sub.id,
        title: sub.title,
        coverUrl: sub.coverUrl,
        webPlayableUrl: sub.webPlayableUrl,
        teamName: sub.team.name,
        isLate: sub.isLate,
        likesCount: sub._count.likes,
        overallScore: metrics.finalScore,
        juryScore: metrics.juryScore,
        peerScore: metrics.peerScore,
        juryVoteCount: metrics.juryVoteCount,
        peerVoteCount: metrics.peerVoteCount,
        criteriaBreakdown: metrics.breakdown
      };
    });

    // Сортировка по общему баллу, затем по лайкам
    evaluated.sort((a, b) => b.overallScore - a.overallScore || b.likesCount - a.likesCount);

    return {
      jam: { id: jam.id, title: jam.title, status: jam.status, votingType: jam.votingType },
      leaderboard: evaluated.map((item, index) => ({
        rank: index + 1,
        ...item
      }))
    };
  });
};
