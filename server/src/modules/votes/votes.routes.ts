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

// ПРАВИЛО ПЛАТФОРМЫ: Чтобы игра попала в зачёт и получила место в лидерборде,
// участники команды должны оценить минимум 10 чужих игр
export const MIN_VOTES_TO_QUALIFY = 10;

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

    // АНТИФРОД: аккаунт должен быть создан ДО дедлайна сдачи сборок джема
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

    // Всего других игр на джеме
    const totalOtherGames = await prisma.submission.count({
      where: {
        jamId: jam.id,
        isPublished: true,
        teamId: { notIn: myTeamIds }
      }
    });

    // Требуемое число оценок: 10 игр (или меньше, если на маленьком локальном джеме всего меньше 10 игр)
    const requiredCount = Math.min(MIN_VOTES_TO_QUALIFY, Math.max(1, totalOtherGames));

    // Сколько уникальных игр пользователь уже оценил
    const myVotesCount = await prisma.vote.groupBy({
      by: ['submissionId'],
      where: {
        userId,
        submission: { jamId: jam.id }
      }
    });
    const votedSubmissionIds = myVotesCount.map((v) => v.submissionId);

    // Подбираем 5 игр с наименьшим количеством оценок (балансировка очереди)
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

    const reviewedCount = votedSubmissionIds.length;
    const isQualified = reviewedCount >= requiredCount;

    return {
      reviewedCount,
      requiredCount,
      isQualified,
      progressPercentage: Math.min(100, Math.round((reviewedCount / requiredCount) * 100)),
      notice: isQualified
        ? 'Вы выполнили условие квалификации (оценено 10+ игр). Ваша игра участвует в распределении мест!'
        : `Чтобы ваша игра получила место в лидерборде, оцените ещё ${requiredCount - reviewedCount} игр из очереди.`,
      nextGamesToJudge: queue.map((g) => ({
        id: g.id,
        title: g.title,
        coverUrl: g.coverUrl,
        teamName: g.team.name,
        votesReceived: g._count.votes
      }))
    };
  });

  // 3. Лидерборд с математической нормализацией и проверкой квалификации (10 оценок)
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
            id: true,
            name: true,
            leader: { select: { username: true, displayName: true } },
            members: { select: { userId: true } }
          }
        },
        votes: {
          select: { criteriaId: true, score: true, isJudge: true }
        },
        _count: { select: { likes: true, votes: true } }
      }
    });

    const totalSubmissionsCount = submissions.length;
    const requiredCount = Math.min(MIN_VOTES_TO_QUALIFY, Math.max(1, totalSubmissionsCount - 1));

    // Проверяем каждую работу на выполнение условия 10 оценок чужих игр командой
    const evaluatedList = await Promise.all(
      submissions.map(async (sub) => {
        const teamMemberIds = sub.team.members.map((m) => m.userId);

        // Количество уникальных чужих игр, которые оценили участники команды этой игры
        const teamEvaluations = await prisma.vote.groupBy({
          by: ['submissionId'],
          where: {
            userId: { in: teamMemberIds },
            submission: {
              jamId: jam.id,
              id: { not: sub.id }
            }
          }
        });

        const evaluatedCount = teamEvaluations.length;
        const isQualified = evaluatedCount >= requiredCount;

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
          isQualified,
          evaluatedCount,
          requiredCount,
          likesCount: sub._count.likes,
          overallScore: metrics.finalScore,
          juryScore: metrics.juryScore,
          peerScore: metrics.peerScore,
          juryVoteCount: metrics.juryVoteCount,
          peerVoteCount: metrics.peerVoteCount,
          criteriaBreakdown: metrics.breakdown
        };
      })
    );

    // Разделяем на квалифицированные (оценили >= 10 игр) и неквалифицированные
    const qualified = evaluatedList.filter((s) => s.isQualified);
    const unranked = evaluatedList.filter((s) => !s.isQualified);

    // Сортировка квалифицированных по общему баллу, затем по лайкам
    qualified.sort((a, b) => b.overallScore - a.overallScore || b.likesCount - a.likesCount);
    unranked.sort((a, b) => b.overallScore - a.overallScore || b.likesCount - a.likesCount);

    return {
      jam: {
        id: jam.id,
        title: jam.title,
        status: jam.status,
        votingType: jam.votingType,
        requiredVotesToQualify: requiredCount
      },
      leaderboard: qualified.map((item, index) => ({
        rank: index + 1,
        ...item
      })),
      unrankedNotice: 'Работы, чьи авторы не оценили минимум 10 чужих игр, отображаются вне общего зачёта',
      unranked: unranked.map((item) => ({
        rank: null,
        statusMessage: `Не квалифицирован (оценено ${item.evaluatedCount} из ${item.requiredCount} игр)`,
        ...item
      }))
    };
  });
};
