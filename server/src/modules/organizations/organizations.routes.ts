import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middlewares/authGuard.js';

const createOrgSchema = z.object({
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Только строчные латинские буквы, цифры и дефис'),
  name: z.string().min(3).max(150),
  shortName: z.string().max(50).optional(),
  description: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  logoUrl: z.string().url().optional().or(z.literal(''))
});

export const organizationRoutes: FastifyPluginAsync = async (fastify) => {
  // Список организаций (вузы, компании, сообщества)
  fastify.get('/', async (request) => {
    const { verified } = request.query as { verified?: string };
    const where = verified === 'true' ? { verified: true } : {};

    return prisma.organization.findMany({
      where,
      include: {
        _count: {
          select: { jams: true, members: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  });

  // Получить организацию по slug
  fastify.get('/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const org = await prisma.organization.findUnique({
      where: { slug },
      include: {
        jams: {
          where: { isPublic: true },
          orderBy: { jamStartsAt: 'desc' }
        },
        members: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true }
            }
          }
        }
      }
    });

    if (!org) {
      return reply.status(404).send({ error: 'NotFound', message: 'Организация не найдена' });
    }

    return org;
  });

  // Создать организацию (для вуза или компании)
  fastify.post('/', { preHandler: requireAuth }, async (request, reply) => {
    const parse = createOrgSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'ValidationError', details: parse.error.format() });
    }

    const userId = request.user!.id;
    const { slug, name, shortName, description, website, logoUrl } = parse.data;

    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (existing) {
      return reply.status(409).send({ error: 'Conflict', message: 'Организация с таким slug уже существует' });
    }

    const org = await prisma.organization.create({
      data: {
        slug,
        name,
        shortName,
        description,
        website: website || null,
        logoUrl: logoUrl || null,
        members: {
          create: {
            userId,
            role: 'OWNER'
          }
        }
      }
    });

    return reply.status(201).send(org);
  });
};
