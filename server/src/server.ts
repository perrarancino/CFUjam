import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';
import { env } from './config/env.js';
import { detectTenant } from './middlewares/tenantGuard.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { jamRoutes } from './modules/jams/jams.routes.js';
import { organizationRoutes } from './modules/organizations/organizations.routes.js';
import { submissionRoutes } from './modules/submissions/submissions.routes.js';
import { teamRoutes } from './modules/teams/teams.routes.js';
import { voteRoutes } from './modules/votes/votes.routes.js';

export async function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV === 'development' ? {
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' }
      }
    } : true
  });

  // CORS
  await app.register(cors, {
    origin: (origin, cb) => {
      // Разрешаем запросы с любого локального хоста или разрешенных доменов
      if (!origin || env.CORS_ORIGIN.some((o) => origin.startsWith(o)) || origin.includes('localhost') || origin.includes('127.0.0.1')) {
        cb(null, true);
        return;
      }
      cb(null, true); // Для разработки разрешаем
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  });

  // JWT
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_EXPIRES_IN }
  });

  // Загрузка файлов
  await app.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024 // 100 MB лимит
    }
  });

  // Интерактивная Swagger документация API (/docs)
  await app.register(swagger, {
    swagger: {
      info: {
        title: 'CFU Jam Multi-Tenant API',
        description: 'Платформа для проведения геймджемов вузами, организациями и сообществами (аналог itch.io)',
        version: '1.0.0'
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
          description: 'Введите токен в формате: Bearer <JWT>'
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

  // Автоматическое определение организации (вуза) по поддомену (cfu.morejam.ru)
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

  // Healthcheck
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV
  }));

  // Регистрация модулей API
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(organizationRoutes, { prefix: '/api/organizations' });
  await app.register(jamRoutes, { prefix: '/api/jams' });
  await app.register(teamRoutes, { prefix: '/api' });
  await app.register(submissionRoutes, { prefix: '/api' });
  await app.register(voteRoutes, { prefix: '/api' });

  // Глобальная обработка ошибок
  app.setErrorHandler((error, request, reply) => {
    app.log.error(error);
    const statusCode = error.statusCode || 500;
    reply.status(statusCode).send({
      error: error.name || 'InternalServerError',
      message: error.message || 'Произошла непредвиденная ошибка на сервере',
      statusCode
    });
  });

  return app;
}

async function start() {
  const app = await buildApp();
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    console.log(`\n🚀 Бэкенд CFUjam запущен на: http://localhost:${env.PORT}`);
    console.log(`📖 Swagger API документация:  http://localhost:${env.PORT}/docs`);
    console.log(`💡 По умолчанию выбран джем:  ${env.DEFAULT_JAM_SLUG}\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Запуск, если файл вызван напрямую
if (process.env.NODE_ENV !== 'test') {
  start();
}
