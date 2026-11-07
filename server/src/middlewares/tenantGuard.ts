import { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';

export interface TenantOrg {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  description: string | null;
  logoUrl: string | null;
  website: string | null;
  featuredJamId: string | null;
  themeConfig: any;
  verified: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    org?: TenantOrg | null;
  }
}

/**
 * Извлекает поддомен из заголовка Host:
 * - cfu.morejam.ru       -> "cfu"
 * - cfu.localhost:4000   -> "cfu"
 * - morejam.ru / localhost -> null (главный домен платформы)
 */
function extractSubdomain(hostHeader?: string): string | null {
  if (!hostHeader) return null;
  const host = hostHeader.split(':')[0].toLowerCase();

  // Локальная разработка: cfu.localhost
  if (host.endsWith('.localhost')) {
    const parts = host.split('.');
    return parts.length >= 2 && parts[0] !== 'localhost' ? parts[0] : null;
  }

  // Боевой домен: cfu.morejam.ru
  const root = env.ROOT_DOMAIN.toLowerCase();
  if (host.endsWith('.' + root)) {
    const sub = host.slice(0, -(root.length + 1));
    // Исключаем технические поддомены
    if (['api', 'www', 'app', 'admin', 'auth'].includes(sub)) return null;
    return sub;
  }

  return null;
}

/**
 * Middleware для определения текущей организации (вуза) по поддомену.
 * Также поддерживает заголовок X-Org-Slug или query-параметр ?org= для удобного тестирования в Swagger / локально.
 */
export async function detectTenant(request: FastifyRequest, reply: FastifyReply) {
  const query = request.query as { org?: string };
  const headerSlug = request.headers['x-org-slug'] as string | undefined;
  const subSlug = extractSubdomain(request.headers.host);

  const orgSlug = query?.org || headerSlug || subSlug;

  if (orgSlug) {
    const org = await prisma.organization.findUnique({
      where: { slug: orgSlug.toLowerCase() },
      select: {
        id: true,
        slug: true,
        name: true,
        shortName: true,
        description: true,
        logoUrl: true,
        website: true,
        featuredJamId: true,
        themeConfig: true,
        verified: true
      }
    });

    if (org) {
      request.org = org;
      return;
    }
  }

  // Проверка на кастомный домен вуза (например: jam.cfuv.ru)
  const host = request.headers.host?.split(':')[0].toLowerCase();
  if (host && !host.includes('localhost') && !host.includes(env.ROOT_DOMAIN)) {
    const customOrg = await prisma.organization.findUnique({
      where: { customDomain: host },
      select: {
        id: true,
        slug: true,
        name: true,
        shortName: true,
        description: true,
        logoUrl: true,
        website: true,
        featuredJamId: true,
        themeConfig: true,
        verified: true
      }
    });
    if (customOrg) {
      request.org = customOrg;
      return;
    }
  }

  request.org = null;
}
