import { PrismaClient } from '@prisma/client';

// Фикс сериализации BigInt в JSON для Fastify (например, fileSize у SubmissionFile)
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
  });

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}
