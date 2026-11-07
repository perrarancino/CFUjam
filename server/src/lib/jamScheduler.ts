import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { prisma } from './prisma.js';
import { realtime } from './realtime.js';

let redisClient: Redis | null = null;
let lifecycleQueue: Queue | null = null;
let lifecycleWorker: Worker | null = null;

try {
  redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    lazyConnect: true
  });
  redisClient.connect().catch(() => {
    console.warn('⚠️ Redis недоступен. Запущен локальный интервальный планировщик джемов.');
    redisClient = null;
  });
} catch {
  redisClient = null;
}

/**
 * Проверяет и актуализирует статусы всех джемов на основе текущего времени
 * (Защита от сбоев и пропущенных таймеров)
 */
export async function syncAllJamStatuses() {
  const now = new Date();

  // 1. DRAFT / UPCOMING -> RUNNING (Старт разработки и объявление темы)
  const toStart = await prisma.jam.findMany({
    where: {
      status: { in: ['DRAFT', 'UPCOMING'] },
      jamStartsAt: { lte: now },
      submissionEndsAt: { gt: now }
    }
  });
  for (const j of toStart) {
    await prisma.jam.update({ where: { id: j.id }, data: { status: 'RUNNING' } });
    console.log(`[JamLifecycle] Джем «${j.title}» переведен в статус RUNNING. Тема открыта!`);
    realtime.broadcastToJam(j.slug, 'PHASE_CHANGED', { status: 'RUNNING', theme: j.theme });
  }

  // 2. RUNNING -> GRACE_PERIOD (Основной дедлайн наступил, включен 60-минутный период милосердия)
  const runningJams = await prisma.jam.findMany({
    where: {
      status: 'RUNNING',
      submissionEndsAt: { lte: now }
    }
  });
  for (const j of runningJams) {
    const graceEnd = new Date(j.submissionEndsAt.getTime() + j.gracePeriodMinutes * 60 * 1000);
    if (now < graceEnd) {
      await prisma.jam.update({ where: { id: j.id }, data: { status: 'GRACE_PERIOD' } });
      console.log(`[JamLifecycle] Джем «${j.title}» в фазе GRACE_PERIOD (милосердие ${j.gracePeriodMinutes} мин).`);
      realtime.broadcastToJam(j.slug, 'PHASE_CHANGED', { status: 'GRACE_PERIOD', gracePeriodMinutes: j.gracePeriodMinutes });
    } else {
      await prisma.jam.update({ where: { id: j.id }, data: { status: 'VOTING' } });
      console.log(`[JamLifecycle] Джем «${j.title}» переведен в статус VOTING (голосование).`);
      realtime.broadcastToJam(j.slug, 'PHASE_CHANGED', { status: 'VOTING' });
    }
  }

  // 3. GRACE_PERIOD -> VOTING (60-минутный период милосердия истек)
  const graceJams = await prisma.jam.findMany({
    where: { status: 'GRACE_PERIOD' }
  });
  for (const j of graceJams) {
    const graceEnd = new Date(j.submissionEndsAt.getTime() + j.gracePeriodMinutes * 60 * 1000);
    if (now >= graceEnd) {
      await prisma.jam.update({ where: { id: j.id }, data: { status: 'VOTING' } });
      console.log(`[JamLifecycle] Период милосердия для «${j.title}» окончен. Началось голосование.`);
      realtime.broadcastToJam(j.slug, 'PHASE_CHANGED', { status: 'VOTING' });
    }
  }

  // 4. VOTING -> FINISHED (Голосование завершено, подведение итогов)
  const votingJams = await prisma.jam.findMany({
    where: {
      status: 'VOTING',
      votingEndsAt: { lte: now }
    }
  });
  for (const j of votingJams) {
    await prisma.jam.update({ where: { id: j.id }, data: { status: 'FINISHED' } });
    console.log(`[JamLifecycle] Джем «${j.title}» успешно завершен. Итоги зафиксированы.`);
    realtime.broadcastToJam(j.slug, 'PHASE_CHANGED', { status: 'FINISHED' });
  }
}

/**
 * Безопасное скрытие темы джема до официального старта
 */
export function sanitizeJamTheme<T extends { status: string; theme: string | null }>(jam: T): T {
  if (jam.status === 'DRAFT' || jam.status === 'UPCOMING') {
    return { ...jam, theme: null };
  }
  return jam;
}

/**
 * Инициализация воркера очередей и интервала синхронизации
 */
export function initJamLifecycleScheduler() {
  // Проверяем статусы сразу при старте
  syncAllJamStatuses().catch(console.error);

  // Периодическая проверка раз в 30 секунд
  setInterval(() => {
    syncAllJamStatuses().catch(console.error);
  }, 30 * 1000);
}
