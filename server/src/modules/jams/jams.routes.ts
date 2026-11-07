import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
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
  // Список джемов:
  // - На поддомене (cfu.morejam.ru) возвращает только джемы этой организации
  // - На главном домене (morejam.ru) возвращает все публичные джемы платформы
  fastify.get('/', async (request) => {
    const { status, org: queryOrg } = request.query as { status?: string; org?: string };

    const where: any = { isPublic: true };
    if (status) where.status = status;

    // Контекст поддомена (например cfu.morejam.ru)
    if (request.org) {
      where.organizationId = request.org.id;
    } else if (queryOrg) {
      where.organization = { slug: queryOrg.toLowerCase() };
    }

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

  // Текущий выбранный / активный джем (равноправие джемов: никакого захардкоженного джема!)
  // Логика выбора:
  // 1. Если клиент явно передал ?jam=slug -> возвращаем этот джем
  // 2. Если организация закрепила featuredJamId -> возвращаем его
  // 3. Иначе ищем активный джем (RUNNING) этой организации
  // 4. Если нет RUNNING -> ищем ближайший UPCOMING или VOTING
  // 5. Иначе -> берем самый свежий созданный джем
  fastify.get('/current', async (request, reply) => {
    const { jam: requestedSlug } = request.query as { jam?: string };

    const orgId = request.org?.id;

    // 1. Клиент запросил конкретный slug
    if (requestedSlug) {
      const jam = await prisma.jam.findFirst({
        where: {
          slug: requestedSlug,
          ...(orgId ? { organizationId: orgId } : {})
        },
        include: {
          organization: true,
          criteria: { orderBy: { order: 'asc' } },
          _count: { select: { teams: true, submissions: true } }
        }
      });
      if (jam) return jam;
    }

    // 2. Закрепленный джем организации
    if (request.org?.featuredJamId) {
      const featured = await prisma.jam.findUnique({
        where: { id: request.org.featuredJamId },
        include: {
          organization: true,
          criteria: { orderBy: { order: 'asc' } },
          _count: { select: { teams: true, submissions: true } }
        }
      });
      if (featured) return featured;
    }

    // 3. Ищем джем в статусе RUNNING
    const runningJam = await prisma.jam.findFirst({
      where: {
        status: 'RUNNING',
        ...(orgId ? { organizationId: orgId } : { isPublic: true })
      },
      include: {
        organization: true,
        criteria: { orderBy: { order: 'asc' } },
        _count: { select: { teams: true, submissions: true } }
      },
      orderBy: { jamStartsAt: 'desc' }
    });
    if (runningJam) return runningJam;

    // 4. Ищем джем в статусе UPCOMING или VOTING
    const activeJam = await prisma.jam.findFirst({
      where: {
        status: { in: ['UPCOMING', 'VOTING'] },
        ...(orgId ? { organizationId: orgId } : { isPublic: true })
      },
      include: {
        organization: true,
        criteria: { orderBy: { order: 'asc' } },
        _count: { select: { teams: true, submissions: true } }
      },
      orderBy: { jamStartsAt: 'desc' }
    });
    if (activeJam) return activeJam;

    // 5. Любой последний созданный джем
    const fallbackJam = await prisma.jam.findFirst({
      where: orgId ? { organizationId: orgId } : { isPublic: true },
      include: {
        organization: true,
        criteria: { orderBy: { order: 'asc' } },
        _count: { select: { teams: true, submissions: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!fallbackJam) {
      return reply.status(404).send({
        error: 'NotFound',
        message: request.org
          ? `У организации «${request.org.name}» пока нет созданных джемов`
          : 'На платформе пока нет активных джемов'
      });
    }

    return fallbackJam;
  });

  // Получить джем по slug
  fastify.get('/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const orgId = request.org?.id;

    const jam = await prisma.jam.findFirst({
      where: {
        slug,
        ...(orgId ? { organizationId: orgId } : {})
      },
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

  // Создать новый джем
  fastify.post('/', { preHandler: requireAuth }, async (request, reply) => {
    const parse = createJamSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'ValidationError', details: parse.error.format() });
    }

    const userId = request.user!.id;
    const data = parse.data;

    // Если запрос пришел с поддомена вуза (cfu.morejam.ru), привязываем к этой организации
    const targetOrgId = request.org?.id || data.organizationId || null;

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
        organizationId: targetOrgId,
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
