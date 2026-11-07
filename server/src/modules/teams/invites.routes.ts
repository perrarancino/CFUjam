import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { resolveJam } from '../../lib/jamResolver.js';
import { prisma } from '../../lib/prisma.js';
import { realtime } from '../../lib/realtime.js';
import { sanitizePlainText } from '../../lib/sanitizer.js';
import { requireAuth } from '../../middlewares/authGuard.js';

const sendInviteSchema = z.object({
  targetUsername: z.string().min(1),
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
  ]).default('OTHER'),
  message: z.string().max(300).optional()
});

const applySchema = z.object({
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
  ]).default('OTHER'),
  message: z.string().max(300).optional()
});

const respondInviteSchema = z.object({
  accept: z.boolean()
});

const updateLfgSchema = z.object({
  bio: z.string().max(500).optional(),
  skills: z.array(z.string().max(30)).max(15).optional()
});

export const inviteRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. Отправить приглашение участнику («В команду»)
  fastify.post('/teams/:id/invites', { preHandler: requireAuth }, async (request, reply) => {
    const { id: teamId } = request.params as { id: string };
    const parse = sendInviteSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'ValidationError', details: parse.error.format() });
    }

    const currentUserId = request.user!.id;
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { jam: true, members: true }
    });

    if (!team) return reply.status(404).send({ error: 'NotFound', message: 'Команда не найдена' });

    // Приглашать может только капитан (или участник) команды
    const isMember = team.members.some((m) => m.userId === currentUserId);
    if (!isMember) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Вы не состоите в этой команде' });
    }

    if (team.members.length >= team.jam.maxTeamSize) {
      return reply.status(400).send({ error: 'BadRequest', message: 'В команде уже нет свободных мест' });
    }

    const { targetUsername, role, message } = parse.data;
    const cleanNick = targetUsername.trim().toLowerCase();

    const targetUser = await prisma.user.findFirst({
      where: {
        OR: [{ username: cleanNick }, { displayName: { equals: targetUsername, mode: 'insensitive' } }]
      }
    });

    if (!targetUser) {
      return reply.status(404).send({ error: 'NotFound', message: 'Пользователь не найден' });
    }

    if (targetUser.id === currentUserId) {
      return reply.status(400).send({ error: 'BadRequest', message: 'Нельзя отправить приглашение самому себе' });
    }

    // Проверяем, не состоит ли пользователь уже в команде этого джема
    const alreadyInTeam = await prisma.teamMember.findFirst({
      where: {
        userId: targetUser.id,
        team: { jamId: team.jamId }
      }
    });

    if (alreadyInTeam) {
      return reply.status(400).send({ error: 'BadRequest', message: 'Пользователь уже состоит в команде этого джема' });
    }

    // Проверяем существующий ожидающий инвайт
    const existing = await prisma.teamInvite.findFirst({
      where: {
        teamId: team.id,
        userId: targetUser.id,
        status: 'PENDING'
      }
    });

    if (existing) {
      return reply.status(400).send({ error: 'BadRequest', message: 'Приглашение этому пользователю уже отправлено' });
    }

    // Создаем инвайт
    const invite = await prisma.teamInvite.create({
      data: {
        teamId: team.id,
        userId: targetUser.id,
        fromId: currentUserId,
        type: 'INVITE_TO_USER',
        role,
        message: message ? sanitizePlainText(message) : null
      },
      include: {
        team: { select: { name: true, direction: true } },
        from: { select: { username: true, displayName: true } }
      }
    });

    // Отправляем уведомление в реальном времени через SSE
    realtime.sendToUser(targetUser.id, 'NEW_INVITE', {
      inviteId: invite.id,
      teamName: team.name,
      fromUser: invite.from.displayName || invite.from.username,
      message: invite.message
    });

    return reply.status(201).send({ message: 'Приглашение успешно отправлено', invite });
  });

  // 2. Откликнуться / Подать заявку в команду («Хочу в команду»)
  fastify.post('/teams/:id/apply', { preHandler: requireAuth }, async (request, reply) => {
    const { id: teamId } = request.params as { id: string };
    const parse = applySchema.safeParse(request.body || {});
    if (!parse.success) {
      return reply.status(400).send({ error: 'ValidationError', details: parse.error.format() });
    }

    const currentUserId = request.user!.id;
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { jam: true, members: true, leader: true }
    });

    if (!team) return reply.status(404).send({ error: 'NotFound', message: 'Команда не найдена' });

    // Проверяем, открыт ли набор
    if (!team.isOpen) {
      return reply.status(400).send({ error: 'BadRequest', message: 'Набор в эту команду закрыт' });
    }

    if (team.members.length >= team.jam.maxTeamSize) {
      return reply.status(400).send({ error: 'BadRequest', message: 'В команде уже заняты все места' });
    }

    // Проверяем, не состоит ли пользователь уже в команде этого джема
    const alreadyInTeam = await prisma.teamMember.findFirst({
      where: {
        userId: currentUserId,
        team: { jamId: team.jamId }
      }
    });

    if (alreadyInTeam) {
      return reply.status(400).send({ error: 'BadRequest', message: 'Вы уже состоите в команде этого джема' });
    }

    // Проверяем существующую заявку
    const existing = await prisma.teamInvite.findFirst({
      where: {
        teamId: team.id,
        userId: currentUserId,
        status: 'PENDING'
      }
    });

    if (existing) {
      return reply.status(400).send({ error: 'BadRequest', message: 'Ваша заявка уже ожидает ответа капитана' });
    }

    const { role, message } = parse.data;

    const application = await prisma.teamInvite.create({
      data: {
        teamId: team.id,
        userId: currentUserId,
        fromId: currentUserId,
        type: 'REQUEST_FROM_USER',
        role,
        message: message ? sanitizePlainText(message) : null
      },
      include: {
        user: { select: { username: true, displayName: true } }
      }
    });

    // Уведомляем капитана команды через SSE
    realtime.sendToUser(team.leaderId, 'NEW_APPLICATION', {
      inviteId: application.id,
      teamName: team.name,
      applicantName: application.user.displayName || application.user.username,
      role: application.role,
      message: application.message
    });

    return reply.status(201).send({ message: 'Заявка успешно отправлена капитану', application });
  });

  // 3. Получить список входящих заявок и приглашений пользователя
  fastify.get('/me/invites', { preHandler: requireAuth }, async (request) => {
    const userId = request.user!.id;

    // 1. Приглашения, отправленные текущему пользователю в команду
    const received = await prisma.teamInvite.findMany({
      where: {
        userId,
        status: 'PENDING',
        type: 'INVITE_TO_USER'
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            direction: true,
            jam: { select: { id: true, title: true, slug: true } }
          }
        },
        from: {
          select: { id: true, username: true, displayName: true, avatarUrl: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 2. Заявки от кандидатов в команду, где текущий пользователь является капитаном
    const myTeams = await prisma.team.findMany({
      where: { leaderId: userId },
      select: { id: true }
    });
    const myTeamIds = myTeams.map((t) => t.id);

    const teamRequests = await prisma.teamInvite.findMany({
      where: {
        teamId: { in: myTeamIds },
        status: 'PENDING',
        type: 'REQUEST_FROM_USER'
      },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, skills: true, xp: true, level: true }
        },
        team: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return {
      receivedInvites: received,
      teamRequests
    };
  });

  // 4. Ответить на приглашение / заявку («Принять» / «Отклонить»)
  fastify.post('/invites/:id/respond', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parse = respondInviteSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'ValidationError', details: parse.error.format() });
    }

    const userId = request.user!.id;
    const { accept } = parse.data;

    const invite = await prisma.teamInvite.findUnique({
      where: { id },
      include: {
        team: { include: { jam: true, members: true } },
        user: true
      }
    });

    if (!invite || invite.status !== 'PENDING') {
      return reply.status(404).send({ error: 'NotFound', message: 'Заявка не найдена или уже обработана' });
    }

    // Проверяем право отвечать на заявку
    const canRespond =
      (invite.type === 'INVITE_TO_USER' && invite.userId === userId) ||
      (invite.type === 'REQUEST_FROM_USER' && invite.team.leaderId === userId);

    if (!canRespond) {
      return reply.status(403).send({ error: 'Forbidden', message: 'У вас нет прав для ответа на эту заявку' });
    }

    if (!accept) {
      await prisma.teamInvite.update({
        where: { id },
        data: { status: 'REJECTED' }
      });
      return { message: 'Заявка отклонена' };
    }

    // Принятие: проверяем лимит команды
    if (invite.team.members.length >= invite.team.jam.maxTeamSize) {
      return reply.status(400).send({ error: 'BadRequest', message: 'Команда уже полностью укомплектована' });
    }

    // Добавляем участника в команду
    await prisma.$transaction([
      prisma.teamMember.create({
        data: {
          teamId: invite.teamId,
          userId: invite.userId,
          role: invite.role
        }
      }),
      prisma.teamInvite.update({
        where: { id },
        data: { status: 'ACCEPTED' }
      }),
      // Отменяем другие ожидающие заявки этого пользователя в данном джеме
      prisma.teamInvite.updateMany({
        where: {
          userId: invite.userId,
          status: 'PENDING',
          team: { jamId: invite.team.jamId }
        },
        data: { status: 'CANCELED' }
      }),
      // Начисляем опыт за вступление в команду
      prisma.user.update({
        where: { id: invite.userId },
        data: { xp: { increment: 15 } }
      })
    ]);

    // Уведомляем участников через SSE
    const notifyTarget = invite.type === 'INVITE_TO_USER' ? invite.team.leaderId : invite.userId;
    realtime.sendToUser(notifyTarget, 'INVITE_ACCEPTED', {
      teamName: invite.team.name,
      joinedUser: invite.user.displayName || invite.user.username
    });

    return { message: 'Участник успешно добавлен в команду' };
  });

  // 5. Управление набором команды (открыть/закрыть набор, сменить направление)
  fastify.patch('/teams/:id/recruitment', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { isOpen, direction, tagline } = request.body as { isOpen?: boolean; direction?: string; tagline?: string };
    const userId = request.user!.id;

    const team = await prisma.team.findUnique({ where: { id } });
    if (!team) return reply.status(404).send({ error: 'NotFound', message: 'Команда не найдена' });
    if (team.leaderId !== userId) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Только капитан может изменять статус набора' });
    }

    const updated = await prisma.team.update({
      where: { id },
      data: {
        isOpen: typeof isOpen === 'boolean' ? isOpen : undefined,
        direction: direction ? sanitizePlainText(direction) : undefined,
        tagline: tagline ? sanitizePlainText(tagline) : undefined
      }
    });

    return updated;
  });

  // 6. Список участников, ищущих команду (Биржа LFG) с поиском и фильтрами
  fastify.get('/jams/:slug/lfg', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const { role, search } = request.query as { role?: string; search?: string };

    const jam = await resolveJam(slug, request);
    if (!jam) return reply.status(404).send({ error: 'NotFound', message: 'Джем не найден' });

    // Пользователи, уже состоящие в команде этого джема
    const membersInJam = await prisma.teamMember.findMany({
      where: { team: { jamId: jam.id } },
      select: { userId: true }
    });
    const busyUserIds = membersInJam.map((m) => m.userId);

    const where: any = {
      id: { notIn: busyUserIds }
    };

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
        { bio: { contains: search, mode: 'insensitive' } },
        { skills: { has: search } }
      ];
    }

    const candidates = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        skills: true,
        bio: true,
        xp: true,
        level: true
      },
      take: 40,
      orderBy: { xp: 'desc' }
    });

    // Фильтр по роли/специализации при необходимости
    const filtered = role && role !== 'ALL'
      ? candidates.filter((c) => {
          const r = (c.bio || '') + ' ' + (c.skills || []).join(' ');
          return r.toLowerCase().includes(role.toLowerCase());
        })
      : candidates;

    return filtered;
  });

  // 7. Список команд, открытых для новых участников (Вакансии команд)
  fastify.get('/jams/:slug/vacancies', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const { search } = request.query as { search?: string };

    const jam = await resolveJam(slug, request);
    if (!jam) return reply.status(404).send({ error: 'NotFound', message: 'Джем не найден' });

    const where: any = {
      jamId: jam.id,
      isOpen: true
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { direction: { contains: search, mode: 'insensitive' } },
        { tagline: { contains: search, mode: 'insensitive' } }
      ];
    }

    const teams = await prisma.team.findMany({
      where,
      include: {
        leader: {
          select: { id: true, username: true, displayName: true, avatarUrl: true }
        },
        members: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Возвращаем только команды, где ещё есть места (< maxTeamSize)
    return teams
      .filter((t) => t.members.length < jam.maxTeamSize)
      .map((t) => ({
        id: t.id,
        name: t.name,
        tagline: t.tagline,
        direction: t.direction,
        leader: t.leader,
        membersCount: t.members.length,
        maxSize: jam.maxTeamSize,
        members: t.members.map((m) => ({
          userId: m.userId,
          role: m.role,
          name: m.user.displayName || m.user.username,
          avatarUrl: m.user.avatarUrl
        }))
      }));
  });

  // 8. Обновить свой LFG-профиль (навыки, био)
  fastify.put('/me/lfg', { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.user!.id;
    const parse = updateLfgSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'ValidationError', details: parse.error.format() });
    }

    const { bio, skills } = parse.data;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        bio: bio !== undefined ? sanitizePlainText(bio) : undefined,
        skills: skills ? skills.map((s) => sanitizePlainText(s)) : undefined
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        skills: true,
        xp: true,
        level: true
      }
    });

    return user;
  });
};
