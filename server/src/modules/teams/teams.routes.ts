import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { resolveJam } from '../../lib/jamResolver.js';
import { prisma } from '../../lib/prisma.js';
import { sanitizePlainText } from '../../lib/sanitizer.js';
import { requireAuth } from '../../middlewares/authGuard.js';

const createTeamSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  team: z.string().min(2).max(50).optional(), // поддержка фронтенда
  tagline: z.string().max(100).optional(),
  direction: z.string().optional(),
  dir: z.string().optional(), // поддержка фронтенда
  size: z.number().int().min(1).max(20).optional(), // поддержка фронтенда
  isOpen: z.boolean().default(true),
  role: z.enum([
    'LEADER',
    'PROGRAMMER',
    'ARTIST_2D',
    'ARTIST_3D',
    'GAME_DESIGNER',
    'SOUND_DESIGNER',
    'WRITER',
    'TESTER',
    'OTHER'
  ]).default('LEADER')
}).refine((data) => data.name || data.team, {
  message: 'Укажите название команды (name или team)',
  path: ['name']
});

export const teamRoutes: FastifyPluginAsync = async (fastify) => {
  // Список команд конкретного джема
  fastify.get('/jams/:slug/teams', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const { search, openOnly } = request.query as { search?: string; openOnly?: string };

    const jam = await resolveJam(slug, request);
    if (!jam) return reply.status(404).send({ error: 'NotFound', message: 'Джем не найден' });

    const where: any = { jamId: jam.id };
    if (openOnly === 'true') where.isOpen = true;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { direction: { contains: search, mode: 'insensitive' } }
      ];
    }

    return prisma.team.findMany({
      where,
      include: {
        leader: {
          select: { id: true, username: true, displayName: true, avatarUrl: true }
        },
        members: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true, xp: true, level: true }
            }
          }
        },
        submission: {
          select: { id: true, title: true, coverUrl: true, slug: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  });

  // Создать команду для джема
  fastify.post('/jams/:slug/teams', { preHandler: requireAuth }, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const parse = createTeamSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'ValidationError', details: parse.error.format() });
    }

    const userId = request.user!.id;
    const jam = await resolveJam(slug, request);
    if (!jam) return reply.status(404).send({ error: 'NotFound', message: 'Джем не найден' });

    // Проверяем, не состоит ли пользователь уже в команде этого джема
    const existingMembership = await prisma.teamMember.findFirst({
      where: {
        userId,
        team: { jamId: jam.id }
      }
    });

    if (existingMembership) {
      return reply.status(400).send({ error: 'BadRequest', message: 'Вы уже состоите в команде этого джема' });
    }

    const name = sanitizePlainText((parse.data.name || parse.data.team)!);
    const direction = sanitizePlainText(parse.data.direction || parse.data.dir || 'Общее');
    const tagline = parse.data.tagline ? sanitizePlainText(parse.data.tagline) : undefined;
    const { isOpen, role } = parse.data;

    const team = await prisma.team.create({
      data: {
        jamId: jam.id,
        name,
        tagline,
        direction,
        isOpen,
        leaderId: userId,
        members: {
          create: {
            userId,
            role
          }
        }
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, username: true, displayName: true, avatarUrl: true } }
          }
        }
      }
    });

    // Начисление XP за создание команды
    await prisma.user.update({
      where: { id: userId },
      data: { xp: { increment: 25 } }
    });

    return reply.status(201).send(team);
  });

  // Вступить в команду по invite коду или открытому набору
  fastify.post('/teams/:id/join', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { inviteCode, role } = request.body as { inviteCode?: string; role?: any };
    const userId = request.user!.id;

    const team = await prisma.team.findUnique({
      where: { id },
      include: { jam: true, members: true }
    });

    if (!team) return reply.status(404).send({ error: 'NotFound', message: 'Команда не найдена' });

    // ЗАЩИТА: Пользователь не может состоять в двух командах одного и того же джема
    const alreadyInJam = await prisma.teamMember.findFirst({
      where: {
        userId,
        team: { jamId: team.jamId }
      }
    });

    if (alreadyInJam) {
      return reply.status(400).send({
        error: 'BadRequest',
        message: 'Вы уже состоите в команде этого джема. 1 участник = 1 команда.'
      });
    }

    if (team.members.length >= team.jam.maxTeamSize) {
      return reply.status(400).send({ error: 'BadRequest', message: 'Команда уже укомплектована' });
    }

    if (!team.isOpen && team.inviteCode !== inviteCode) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Неверный код приглашения' });
    }

    const member = await prisma.teamMember.create({
      data: {
        teamId: id,
        userId,
        role: role || 'OTHER'
      },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } }
      }
    });

    await prisma.user.update({
      where: { id: userId },
      data: { xp: { increment: 15 } }
    });

    return reply.status(201).send(member);
  });

  // Покинуть команду (Leave team)
  fastify.post('/teams/:id/leave', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.id;

    const team = await prisma.team.findUnique({
      where: { id },
      include: { members: true }
    });

    if (!team) return reply.status(404).send({ error: 'NotFound', message: 'Команда не найдена' });

    const membership = team.members.find((m) => m.userId === userId);
    if (!membership) {
      return reply.status(400).send({ error: 'BadRequest', message: 'Вы не состоите в этой команде' });
    }

    // Капитан не может просто уйти, если в команде есть другие участники
    if (team.leaderId === userId && team.members.length > 1) {
      return reply.status(400).send({
        error: 'BadRequest',
        message: 'Капитан не может покинуть команду, пока в ней есть участники. Передайте лидерство или распустите команду.'
      });
    }

    if (team.members.length === 1) {
      // Последний участник -> распускаем команду
      await prisma.team.delete({ where: { id } });
      return { message: 'Команда распущена' };
    }

    await prisma.teamMember.delete({ where: { id: membership.id } });
    return { message: 'Вы успешно покинули команду' };
  });

  // Исключить участника из команды (только для капитана)
  fastify.delete('/teams/:id/members/:memberUserId', { preHandler: requireAuth }, async (request, reply) => {
    const { id, memberUserId } = request.params as { id: string; memberUserId: string };
    const currentUserId = request.user!.id;

    const team = await prisma.team.findUnique({ where: { id } });
    if (!team) return reply.status(404).send({ error: 'NotFound', message: 'Команда не найдена' });

    // Проверка прав: только капитан команды может исключать
    if (team.leaderId !== currentUserId) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Только капитан команды может исключать участников' });
    }

    if (memberUserId === currentUserId) {
      return reply.status(400).send({ error: 'BadRequest', message: 'Капитан не может исключить сам себя' });
    }

    const member = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: id, userId: memberUserId } }
    });

    if (!member) {
      return reply.status(404).send({ error: 'NotFound', message: 'Участник не найден в этой команде' });
    }

    await prisma.teamMember.delete({ where: { id: member.id } });
    return { message: 'Участник исключен из команды' };
  });
};
