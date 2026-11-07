import { FastifyPluginAsync } from 'fastify';
import fs from 'fs';
import path from 'path';

const MIME_MAP: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.data': 'application/octet-stream',
  '.pck': 'application/octet-stream',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.css': 'text/css; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav'
};

export const sandboxRoutes: FastifyPluginAsync = async (fastify) => {
  // Эндпоинт безопасного хостинга и запуска WebGL/HTML5 сборки
  fastify.get('/play/:submissionId/*', async (request, reply) => {
    const { submissionId } = request.params as { submissionId: string };
    const filePathParam = (request.params as any)['*'] || 'index.html';

    // Защита от Path Traversal
    const sanitizedPath = path.normalize(filePathParam).replace(/^(\.\.[\/\\])+/, '');
    const webglRoot = path.resolve(process.cwd(), 'public', 'webgl', submissionId);
    const absoluteFilePath = path.join(webglRoot, sanitizedPath);

    if (!absoluteFilePath.startsWith(webglRoot)) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Доступ запрещен' });
    }

    if (!fs.existsSync(absoluteFilePath)) {
      return reply.status(404).send({ error: 'NotFound', message: 'Файл игры не найден' });
    }

    const stat = fs.statSync(absoluteFilePath);
    if (stat.isDirectory()) {
      const indexFile = path.join(absoluteFilePath, 'index.html');
      if (fs.existsSync(indexFile)) {
        return reply.redirect(request.url.endsWith('/') ? request.url + 'index.html' : request.url + '/index.html');
      }
      return reply.status(404).send({ error: 'NotFound', message: 'Точка входа index.html не найдена' });
    }

    const ext = path.extname(absoluteFilePath).toLowerCase();
    const contentType = MIME_MAP[ext] || 'application/octet-stream';

    // КРИТИЧЕСКИЕ ЗАГОЛОВКИ БЕЗОПАСНОСТИ И ПОДДЕРЖКИ WASM / GODOT / UNITY MULTITHREADING
    reply.header('Content-Type', contentType);
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Cross-Origin-Opener-Policy', 'same-origin');
    reply.header('Cross-Origin-Embedder-Policy', 'require-corp');

    // Ограничиваем CSP для песочницы: запрещаем доступ к кукам основного приложения
    reply.header(
      'Content-Security-Policy',
      "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; worker-src 'self' blob:; media-src 'self' blob: data:; connect-src 'self' blob: data:;"
    );

    // Поддержка Range-запросов для тяжелых аудио/видео ассетов
    const stream = fs.createReadStream(absoluteFilePath);
    return reply.send(stream);
  });
};
