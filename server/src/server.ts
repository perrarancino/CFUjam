import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';
import { env } from './config/env.js';
import { initJamLifecycleScheduler } from './lib/jamScheduler.js';
import { prisma } from './lib/prisma.js';
import { detectTenant } from './middlewares/tenantGuard.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { devlogRoutes } from './modules/devlogs/devlogs.routes.js';
import { jamRoutes } from './modules/jams/jams.routes.js';
import { organizationRoutes } from './modules/organizations/organizations.routes.js';
import { realtimeRoutes } from './modules/realtime/realtime.routes.js';
import { sandboxRoutes } from './modules/sandbox/sandbox.routes.js';
import { fileRoutes } from './modules/submissions/files.routes.js';
import { submissionRoutes } from './modules/submissions/submissions.routes.js';
import { inviteRoutes } from './modules/teams/invites.routes.js';
import { teamRoutes } from './modules/teams/teams.routes.js';
import { voteRoutes } from './modules/votes/votes.routes.js';

export async function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV === 'development' ? {
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' }
      }
    } : true,
    requestIdHeader: 'x-request-id',
    disableRequestLogging: false
  });

  // 1. БЕЗОПАСНОСТЬ: Security Headers (Helmet)
  await app.register(helmet, {
    contentSecurityPolicy: false, // CSP кастомизируется для песочницы /play/*
    crossOriginEmbedderPolicy: false // Настраивается отдельно для WebGL
  });

  // 2. БЕЗОПАСНОСТЬ: Защита от DDoS и спам-запросов (Rate Limiting)
  await app.register(rateLimit, {
    max: 120, // 120 запросов в минуту на IP
    timeWindow: '1 minute',
    allowList: ['127.0.0.1', 'localhost']
  });

  // 3. CORS
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || env.CORS_ORIGIN.some((o) => origin.startsWith(o)) || origin.includes('localhost') || origin.includes('127.0.0.1')) {
        cb(null, true);
        return;
      }
      cb(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  });

  // 4. JWT
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_EXPIRES_IN }
  });

  // 5. Загрузка файлов
  await app.register(multipart, {
    limits: {
      fileSize: 1024 * 1024 * 1024 // 1 GB лимит
    }
  });

  // 6. Swagger API Документация (/docs)
  await app.register(swagger, {
    swagger: {
      info: {
        title: 'CFU Jam Multi-Tenant API',
        description: 'Платформа проведения геймджемов вузами, организациями и сообществами (аналог itch.io)',
        version: '2.0.0'
      },
      host: `localhost:${env.PORT}`,
      schemes: ['http', 'https'],
      consumes: ['application/json'],
      produces: ['application/json'],
      securityDefinitions: {
        bearerAuth: {
          type: 'apiKey',
          name: 'Authorization',
          in: 'header',
          description: 'Введите токен: Bearer <JWT>'
        }
      }
    }
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false
    }
  });

  // 7. Автоматическое определение поддомена вуза (cfu.morejam.ru)
  app.addHook('onRequest', detectTenant);

  // Информация о текущей организации (вузе) на поддомене
  app.get('/api/org', async (request, reply) => {
    if (!request.org) {
      return reply.status(404).send({
        error: 'NotFound',
        message: 'Запрос выполнен с корневого домена платформы, организация не выбрана'
      });
    }
    return request.org;
  });

  // 8. Комплексный Healthcheck для мониторинга (Docker / K8s / UptimeRobot)
  app.get('/health', async (request, reply) => {
    let dbStatus = 'ok';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'error';
    }

    const memory = process.memoryUsage();
    const isHealthy = dbStatus === 'ok';

    return reply.status(isHealthy ? 200 : 503).send({
      status: isHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: dbStatus,
      memory: {
        rssMb: Math.round(memory.rss / 1024 / 1024),
        heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024)
      }
    });
  });

  // 9. Регистрация модулей API
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(organizationRoutes, { prefix: '/api/organizations' });
  await app.register(jamRoutes, { prefix: '/api/jams' });
  await app.register(teamRoutes, { prefix: '/api' });
  await app.register(inviteRoutes, { prefix: '/api' });
  await app.register(devlogRoutes, { prefix: '/api' });
  await app.register(submissionRoutes, { prefix: '/api' });
  await app.register(fileRoutes, { prefix: '/api' });
  await app.register(voteRoutes, { prefix: '/api' });
  await app.register(realtimeRoutes, { prefix: '/api' });
  await app.register(sandboxRoutes); // /play/:submissionId/*

  // 10. Глобальная обработка ошибок
  app.setErrorHandler((error, request, reply) => {
    app.log.error(error);
    const statusCode = error.statusCode || 500;
    reply.status(statusCode).send({
      error: error.name || 'InternalServerError',
      message: error.message || 'Произошла непредвиденная ошибка на сервере',
      statusCode,
      requestId: request.id
    });
  });

  return app;
}

async function start() {
  const app = await buildApp();
  try {
    await app.listen({ port: env.PORT, host: env.HOST });

    // Запуск фонового планировщика фаз джема
    initJamLifecycleScheduler();

    console.log(`\n🚀 Бэкенд CFUjam запущен на: http://localhost:${env.PORT}`);
    console.log(`📖 Swagger API документация:  http://localhost:${env.PORT}/docs`);
    console.log(`🎮 WebGL Sandbox песочница:   http://localhost:${env.PORT}/play/:id/`);
    console.log(`⏱️  Период милосердия (Grace): 60 минут`);
    console.log(`💡 Поддомен по умолчанию:     cfu.morejam.ru (или ?org=cfu)\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  start();
}
