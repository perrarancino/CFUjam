import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from './prisma.js';

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface JwtUserPayload {
  id: string;
  username: string;
  email: string;
  role: string;
}

const REFRESH_TOKEN_DAYS = 30;

/**
 * Создает пару токенов:
 * - Access Token (15 минут)
 * - Refresh Token (30 дней, хранится в базе)
 */
export async function issueTokens(
  user: { id: string; username: string; email: string; role: string },
  jwtSign: (payload: any, options?: any) => string
) {
  // Короткоживущий Access Token (15m)
  const accessToken = jwtSign(
    { id: user.id, username: user.username, email: user.email, role: user.role },
    { expiresIn: '15m' }
  );

  // Долгоживущий криптографический Refresh Token
  const refreshTokenStr = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);

  await prisma.refreshToken.create({
    data: {
      token: refreshTokenStr,
      userId: user.id,
      expiresAt
    }
  });

  return {
    accessToken,
    refreshToken: refreshTokenStr,
    expiresIn: 15 * 60 // 15 минут в секундах
  };
}

/**
 * Ротация Refresh-токена (One-time use)
 */
export async function rotateRefreshToken(
  tokenStr: string,
  jwtSign: (payload: any, options?: any) => string
) {
  const existing = await prisma.refreshToken.findUnique({
    where: { token: tokenStr },
    include: { user: true }
  });

  if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
    return null;
  }

  // Отзываем старый токен
  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() }
  });

  // Выдаем новую пару токенов
  return issueTokens(
    {
      id: existing.user.id,
      username: existing.user.username,
      email: existing.user.email,
      role: existing.user.role
    },
    jwtSign
  );
}

/**
 * Отзыв конкретного Refresh-токена (при выходе с устройства)
 */
export async function revokeToken(tokenStr: string) {
  await prisma.refreshToken.updateMany({
    where: { token: tokenStr },
    data: { revokedAt: new Date() }
  });
}

/**
 * Отзыв всех активных сессий пользователя (выход со всех устройств / смена пароля)
 */
export async function revokeAllUserTokens(userId: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() }
  });
}
