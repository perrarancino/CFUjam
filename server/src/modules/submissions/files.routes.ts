import { FastifyPluginAsync } from 'fastify';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { ArchiveSecurity } from '../../lib/archiveSecurity.js';
import { prisma } from '../../lib/prisma.js';
import { storage } from '../../lib/storage.js';
import { requireAuth } from '../../middlewares/authGuard.js';

const uploadUrlSchema = z.object({
  fileName: z.string().min(1).max(200),
  fileSize: z.number().int().positive(),
  platform: z.enum(['WINDOWS', 'LINUX', 'MACOS', 'WEB', 'ANDROID', 'SOURCE_CODE'])
});

const completeUploadSchema = z.object({
  key: z.string().min(1),
  fileName: z.string().min(1),
  fileSize: z.number().int().positive(),
  platform: z.enum(['WINDOWS', 'LINUX', 'MACOS', 'WEB', 'ANDROID', 'SOURCE_CODE'])
});

export const fileRoutes: FastifyPluginAsync = async (fastify) => {
  // Парсер для прямой заливки бинарных файлов (ZIP, архивы, байты)
  fastify.addContentTypeParser(['application/octet-stream', 'application/zip', 'application/x-zip-compressed'], { parseAs: 'buffer' }, (req, body, done) => {
    done(null, body);
  });

  // 1. Получить Presigned URL для прямой загрузки сборки в S3
  fastify.post('/submissions/:id/upload-url', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parse = uploadUrlSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'ValidationError', details: parse.error.format() });
    }

    const userId = request.user!.id;
    const submission = await prisma.submission.findUnique({
      where: { id },
      include: { team: true, jam: true }
    });

    if (!submission) return reply.status(404).send({ error: 'NotFound', message: 'Игра не найдена' });

    // Проверяем, что пользователь состоит в команде этой игры
    const isMember = await prisma.teamMember.findFirst({
      where: { teamId: submission.teamId, userId }
    });
    if (!isMember) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Только участники команды могут загружать сборки' });
    }

    const { fileName, platform } = parse.data;
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const s3Key = `jams/${submission.jamId}/games/${submission.id}/${platform.toLowerCase()}_${Date.now()}_${cleanFileName}`;

    const contentType = platform === 'WEB' ? 'application/zip' : 'application/octet-stream';
    const { uploadUrl, key } = await storage.getPresignedUploadUrl(s3Key, contentType);

    return { uploadUrl, key };
  });

  // 2. Зафиксировать успешную загрузку сборки и распаковать WebGL
  fastify.post('/submissions/:id/complete-upload', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parse = completeUploadSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'ValidationError', details: parse.error.format() });
    }

    const userId = request.user!.id;
    const submission = await prisma.submission.findUnique({
      where: { id },
      include: { team: true }
    });

    if (!submission) return reply.status(404).send({ error: 'NotFound', message: 'Игра не найдена' });

    const isMember = await prisma.teamMember.findFirst({
      where: { teamId: submission.teamId, userId }
    });
    if (!isMember) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Только участники команды могут загружать сборки' });
    }

    const { key, fileName, fileSize, platform } = parse.data;
    const downloadUrl = await storage.getPresignedDownloadUrl(key);

    // ФИЗИЧЕСКАЯ ЗАЧИСТКА S3: Находим старый файл этой платформы и удаляем его из S3
    const oldFiles = await prisma.submissionFile.findMany({
      where: { submissionId: id, platform }
    });

    for (const oldFile of oldFiles) {
      if (oldFile.fileKey) {
        await storage.deleteFile(oldFile.fileKey).catch((err) => {
          request.log.warn({ err, key: oldFile.fileKey }, 'Не удалось удалить старый файл из хранилища');
        });
      }
    }

    // Удаляем предыдущую запись этого типа платформы из БД
    await prisma.submissionFile.deleteMany({
      where: { submissionId: id, platform }
    });

    // Создаем запись файла с сохранением fileKey для будущей зачистки
    const file = await prisma.submissionFile.create({
      data: {
        submissionId: id,
        platform,
        fileName,
        fileSize: BigInt(fileSize),
        fileUrl: downloadUrl,
        fileKey: key
      }
    });

    // Если это WEB-сборка -> распаковываем в защищенный sandbox-каталог
    if (platform === 'WEB') {
      try {
        const zipBuffer = await storage.getFileBuffer(key);
        const webglDir = path.resolve(process.cwd(), 'public', 'webgl', id);

        // Очищаем старую распакованную версию WebGL, если была
        if (fs.existsSync(webglDir)) {
          fs.rmSync(webglDir, { recursive: true, force: true });
        }

        const result = ArchiveSecurity.safeExtract(zipBuffer, webglDir);

        if (!result.success) {
          return reply.status(400).send({
            error: 'SecurityError',
            message: 'Ошибка распаковки WebGL архива: ' + result.error
          });
        }

        const entry = result.entryPoint || 'index.html';
        const playableUrl = `/play/${id}/${entry}`;

        await prisma.submission.update({
          where: { id },
          data: { webPlayableUrl: playableUrl }
        });

        return {
          file: { ...file, fileSize: Number(file.fileSize) },
          webPlayableUrl: playableUrl,
          unpackedFilesCount: result.totalFiles
        };
      } catch (err: any) {
        request.log.error(err, 'Ошибка распаковки архива');
        return reply.status(500).send({ error: 'UnpackError', message: 'Не удалось распаковать веб-сборку' });
      }
    }

    return {
      file: { ...file, fileSize: Number(file.fileSize) }
    };
  });

  // 3. Получить список файлов и подписанные ссылки на скачивание
  fastify.get('/submissions/:id/downloads', async (request, reply) => {
    const { id } = request.params as { id: string };
    const files = await prisma.submissionFile.findMany({
      where: { submissionId: id }
    });

    // Обновляем ссылки на свежие Presigned GET
    const downloads = await Promise.all(
      files.map(async (f) => ({
        id: f.id,
        platform: f.platform,
        fileName: f.fileName,
        fileSize: Number(f.fileSize),
        createdAt: f.createdAt,
        downloadUrl: f.fileUrl
      }))
    );

    return downloads;
  });

  // Локальный fallback эндпоинт загрузки (для разработки без S3/MinIO)
  fastify.put('/storage/local-upload', async (request, reply) => {
    const { key } = request.query as { key: string };
    if (!key) return reply.status(400).send({ error: 'MissingKey' });

    const buffer = await request.body; // Raw body
    const fullPath = path.resolve(process.cwd(), 'uploads', key);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, buffer as any);

    return { status: 'ok', key };
  });
};
