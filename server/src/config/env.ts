import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const env = {
  PORT: parseInt(process.env.PORT || '4000', 10),
  HOST: process.env.HOST || '0.0.0.0',
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://cfujam:cfujam_secret@localhost:5432/cfujam_db?schema=public',
  JWT_SECRET: process.env.JWT_SECRET || 'super-secret-jwt-key-jam-default',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CORS_ORIGIN: (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3000').split(','),
  ROOT_DOMAIN: process.env.ROOT_DOMAIN || 'morejam.ru',
  DEFAULT_JAM_SLUG: process.env.DEFAULT_JAM_SLUG || 'cfu-game-jam-2026',
  S3: {
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
    accessKey: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.S3_SECRET_KEY || 'minioadmin',
    bucket: process.env.S3_BUCKET || 'cfujam-builds',
    region: process.env.S3_REGION || 'us-east-1'
  }
};
