import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middlewares/authGuard.js';

const createJamSchema = z.object({
  slug: z.string().min(3).max(60).regex(/^[a-z0-9-]+$/),
  title: z.string().min(3).max(120),
  tagline: z.string().max(200).optional(),
  description: z.string().min(10),
  rules: z.string().optional(),
  theme: z.string().optional(),
  coverUrl: z.string().optional(),
  bannerUrl: z.string().optional(),
  organizationId: z.string().uuid().optional(),
  regStartsAt: z.string().datetime().optional(),
  jamStartsAt: z.string().datetime(),
  submissionEndsAt: z.string().datetime(),
  votingEndsAt: z.string().datetime(),
  votingType: z.enum(['PUBLIC', 'PARTICIPANTS_ONLY', 'JUDGES_ONLY', 'HYBRID']).default('HYBRID'),
  minTeamSize: z.number().int().min(1).default(1),
  maxTeamSize: z.number().int().max(20).default(5),
  criteria: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    weight: z.number().default(1.0)
  })).optional()
});

export const jamRoutes: FastifyPluginAsync = async (fastify) => {
  // Список всех джемов (с фильтрацией по статусу и организации)
  fastify.get('/', async (request) => {
    const { status, org } = request.query as { status?: string; org?: string };

    const where: any = { isPublic: true };
    if (status) where.status = status;
    if (org) where.organization = { slug: org };

    return prisma.jam.findMany({
      where,
      include: {
        organization: {
          select: { id: true, slug: true, name: true, logoUrl: true, verified: true }
        },
        _count: {
          select: { teams: true, submissions: true }
        }
      },
      orderBy: { jamStartsAt: 'desc' }
    });
  });

  // Текущий/дефолтный джем (для совместимости с существующим фронтендом КФУ)
  fastify.get('/current', async (request, reply) => {
    const jam = await prisma.jam.findUnique({
      where: { slug: env.DEFAULT_JAM_SLUG },
      include: {
        organization: true,
        criteria: { orderBy: { order: 'asc' } },
        _count: {
          select: { teams: true, submissions: true }
        }
      }
    });

    if (!jam) {
      // Если джем еще не создан в БД, возвращаем первый активный или 404
      const fallback = await prisma.jam.findFirst({
        orderBy: { createdAt: 'desc' },
        include: { organization: true, criteria: true }
      });
      if (!fallback) {
        return reply.status(404).send({ error: 'NotFound', message: 'Джем по умолчанию не настроен' });
      }
      return fallback;
    }

    return jam;
  });

  // Получить джем по slug
  fastify.get('/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const jam = await prisma.jam.findUnique({
      where: { slug },
      include: {
        organization: true,
        criteria: { orderBy: { order: 'asc' } },
        judges: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true }
            }
          }
        },
        _count: {
          select: { teams: true, submissions: true }
        }
      }
    });

    if (!jam) {
      return reply.status(404).send({ error: 'NotFound', message: 'Джем не найден' });
    }

    return jam;
  });

  // Создать новый джем (для организаторов / вузов)
  fastify.post('/', { preHandler: requireAuth }, async (request, reply) => {
    const parse = createJamSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'ValidationError', details: parse.error.format() });
    }

    const userId = request.user!.id;
    const data = parse.data;

    const existing = await prisma.jam.findUnique({ where: { slug: data.slug } });
    if (existing) {
      return reply.status(409).send({ error: 'Conflict', message: 'Джем с таким slug уже существует' });
    }

    const defaultCriteria = data.criteria || [
      { name: 'Геймплей', description: 'Увлекательность и механики', weight: 1.0 },
      { name: 'Графика и стиль', description: 'Визуальное оформление и анимации', weight: 1.0 },
      { name: 'Звук и музыка', description: 'Атмосфера и аудиоэффекты', weight: 0.8 },
      { name: 'Соответствие теме', description: 'Насколько идея отражает тему джема', weight: 1.2 }
    ];

    const jam = await prisma.jam.create({
      data: {
        slug: data.slug,
        title: data.title,
        tagline: data.tagline,
        description: data.description,
        rules: data.rules,
        theme: data.theme,
        coverUrl: data.coverUrl,
        bannerUrl: data.bannerUrl,
        organizationId: data.organizationId,
        organizerId: userId,
        votingType: data.votingType,
        minTeamSize: data.minTeamSize,
        maxTeamSize: data.maxTeamSize,
        regStartsAt: data.regStartsAt ? new Date(data.regStartsAt) : new Date(),
        jamStartsAt: new Date(data.jamStartsAt),
        submissionEndsAt: new Date(data.submissionEndsAt),
        votingEndsAt: new Date(data.votingEndsAt),
        criteria: {
          create: defaultCriteria.map((c, i) => ({
            name: c.name,
            description: c.description,
            weight: c.weight,
            order: i
          }))
        }
      },
      include: {
        criteria: true,
        organization: true
      }
    });

    return reply.status(201).send(jam);
  });

  // Участники джема (вкладка «Люди» / «Участники»)
  fastify.get('/:slug/participants', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const jam = await prisma.jam.findUnique({ where: { slug }, select: { id: true } });
    if (!jam) return reply.status(404).send({ error: 'NotFound', message: 'Джем не найден' });

    // Получаем всех участников команд этого джема
    const members = await prisma.teamMember.findMany({
      where: { team: { jamId: jam.id } },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            role: true,
            skills: true,
            xp: true,
            level: true
          }
        },
        team: {
          select: { id: true, name: true }
        }
      }
    });

    return members;
  });
};
