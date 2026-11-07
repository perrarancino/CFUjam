import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sanitizeJamTheme } from '../../lib/jamScheduler.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middlewares/authGuard.js';

// Библиотека готовых параметров голосования (пресетов), из которых организация может выбирать
export const CRITERIA_PRESETS = [
  { id: 'theme', name: 'Соответствие теме', description: 'Насколько идея, мир и механики отражают заданную тему джема', defaultWeight: 1.2 },
  { id: 'gameplay', name: 'Геймплей и механики', description: 'Динамика, отзывчивость управления, глубина и баланс правил', defaultWeight: 1.0 },
  { id: 'visuals', name: 'Визуальные эффекты и графика', description: 'Художественный стиль, анимации, интерфейс и сочность картинки', defaultWeight: 1.0 },
  { id: 'audio', name: 'Звуковое сопровождение и музыка', description: 'Атмосферный саундтрек, сочные звуковые эффекты и озвучка', defaultWeight: 0.8 },
  { id: 'story', name: 'Сюжет и нарратив', description: 'История, диалоги, проработка персонажей и погружение в мир', defaultWeight: 1.0 },
  { id: 'humor', name: 'Юмор', description: 'Комедийная составляющая, остроумные ситуации и позитивные эмоции', defaultWeight: 0.9 },
  { id: 'fear', name: 'Атмосфера и страх / Хоррор', description: 'Саспенс, напряжение, пугающие элементы и ощущение тревоги', defaultWeight: 0.9 },
  { id: 'innovation', name: 'Оригинальность и инновации', description: 'Необычные механики, свежий взгляд на жанр и смелые идеи', defaultWeight: 1.1 }
];

const criteriaItemSchema = z.object({
  name: z.string().min(2, 'Название параметра минимум 2 символа').max(60),
  description: z.string().max(200).optional(),
  weight: z.number().min(0.1).max(3.0).default(1.0)
});

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
  gracePeriodMinutes: z.number().int().min(0).max(240).default(60),
  votingEndsAt: z.string().datetime(),
  votingType: z.enum(['PUBLIC', 'PARTICIPANTS_ONLY', 'JUDGES_ONLY', 'HYBRID']).default('HYBRID'),
  minTeamSize: z.number().int().min(1).default(1),
  maxTeamSize: z.number().int().max(20).default(5),
  criteria: z.array(criteriaItemSchema)
    .min(5, 'Организация должна выбрать минимум 5 параметров голосования')
    .max(8, 'Максимум 8 параметров голосования')
    .optional()
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
      if (jam) return sanitizeJamTheme(jam);
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
      if (featured) return sanitizeJamTheme(featured);
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
    if (runningJam) return sanitizeJamTheme(runningJam);

    // 4. Ищем джем в статусе UPCOMING, GRACE_PERIOD или VOTING
    const activeJam = await prisma.jam.findFirst({
      where: {
        status: { in: ['UPCOMING', 'GRACE_PERIOD', 'VOTING'] },
        ...(orgId ? { organizationId: orgId } : { isPublic: true })
      },
      include: {
        organization: true,
        criteria: { orderBy: { order: 'asc' } },
        _count: { select: { teams: true, submissions: true } }
      },
      orderBy: { jamStartsAt: 'desc' }
    });
    if (activeJam) return sanitizeJamTheme(activeJam);

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

    return sanitizeJamTheme(fallbackJam);
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

    return sanitizeJamTheme(jam);
  });

  // Библиотека доступных параметров голосования (для фронтенда / конструктора джема)
  fastify.get('/criteria/presets', async () => {
    return CRITERIA_PRESETS;
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

    // По умолчанию 5 сбалансированных критериев
    const defaultCriteria = data.criteria || [
      { name: 'Соответствие теме', description: 'Насколько идея отражает тему джема', weight: 1.2 },
      { name: 'Геймплей и механики', description: 'Увлекательность и механики', weight: 1.0 },
      { name: 'Визуальные эффекты и графика', description: 'Художественное оформление и анимации', weight: 1.0 },
      { name: 'Звуковое сопровождение и музыка', description: 'Атмосфера и аудиоэффекты', weight: 0.8 },
      { name: 'Сюжет и нарратив', description: 'Повествование, диалоги и атмосфера', weight: 1.0 }
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
        gracePeriodMinutes: data.gracePeriodMinutes ?? 60,
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

  // Настройка/изменение параметров голосования организацией (от 5 до 8 параметров)
  fastify.put('/:slug/criteria', { preHandler: requireAuth }, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const criteriaSchema = z.array(criteriaItemSchema)
      .min(5, 'Необходимо выбрать минимум 5 параметров голосования')
      .max(8, 'Разрешено выбрать максимум 8 параметров голосования');

    const parse = criteriaSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'ValidationError', details: parse.error.format() });
    }

    const userId = request.user!.id;
    const jam = await resolveJam(slug, request);
    if (!jam) return reply.status(404).send({ error: 'NotFound', message: 'Джем не найден' });

    // Менять критерии можно только до начала голосования
    if (['VOTING', 'FINISHED'].includes(jam.status)) {
      return reply.status(400).send({ error: 'BadRequest', message: 'Нельзя менять параметры голосования после его начала' });
    }

    // Проверяем, что пользователь является создателем джема или админом организации
    if (jam.organizerId !== userId && request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Только организатор может изменять параметры' });
    }

    const newCriteria = parse.data;

    // В транзакции заменяем критерии джема
    await prisma.$transaction([
      prisma.jamCriteria.deleteMany({ where: { jamId: jam.id } }),
      prisma.jamCriteria.createMany({
        data: newCriteria.map((c, i) => ({
          jamId: jam.id,
          name: c.name,
          description: c.description,
          weight: c.weight,
          order: i
        }))
      })
    ]);

    const updated = await prisma.jamCriteria.findMany({
      where: { jamId: jam.id },
      orderBy: { order: 'asc' }
    });

    return { message: 'Параметры голосования успешно сохранены', count: updated.length, criteria: updated };
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
