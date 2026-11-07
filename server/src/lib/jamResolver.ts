import { FastifyRequest } from 'fastify';
import { prisma } from './prisma.js';

/**
 * Разрешает джем по его slug или специальному значению 'current'
 * с учётом поддомена текущей организации (request.org).
 */
export async function resolveJam(slug: string, request: FastifyRequest) {
  const orgId = request.org?.id;

  if (slug === 'current') {
    // 1. Закрепленный джем организации
    if (request.org?.featuredJamId) {
      const jam = await prisma.jam.findUnique({
        where: { id: request.org.featuredJamId }
      });
      if (jam) return jam;
    }

    // 2. Активный RUNNING джем
    const running = await prisma.jam.findFirst({
      where: {
        status: 'RUNNING',
        ...(orgId ? { organizationId: orgId } : { isPublic: true })
      },
      orderBy: { jamStartsAt: 'desc' }
    });
    if (running) return running;

    // 3. Ближайший UPCOMING или VOTING
    const active = await prisma.jam.findFirst({
      where: {
        status: { in: ['UPCOMING', 'VOTING'] },
        ...(orgId ? { organizationId: orgId } : { isPublic: true })
      },
      orderBy: { jamStartsAt: 'desc' }
    });
    if (active) return active;

    // 4. Последний созданный
    return prisma.jam.findFirst({
      where: orgId ? { organizationId: orgId } : { isPublic: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  // Конкретный slug (например: "jam-1" или "cfu-game-jam-2026")
  return prisma.jam.findFirst({
    where: {
      slug,
      ...(orgId ? { organizationId: orgId } : {})
    }
  });
}
