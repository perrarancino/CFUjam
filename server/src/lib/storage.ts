import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env.js';

class StorageService {
  private s3: S3Client | null = null;
  private bucket: string;
  private isLocalStorage: boolean = false;
  private localUploadsDir: string;

  constructor() {
    this.bucket = env.S3.bucket;
    this.localUploadsDir = path.resolve(process.cwd(), 'uploads');

    // Если S3 сконфигурирован, инициализируем клиент
    try {
      this.s3 = new S3Client({
        region: env.S3.region,
        endpoint: env.S3.endpoint,
        credentials: {
          accessKeyId: env.S3.accessKey,
          secretAccessKey: env.S3.secretKey
        },
        forcePathStyle: true // Необходимо для MinIO
      });
    } catch (e) {
      console.warn('⚠️ S3 клиент не инициализирован, включен локальный диск fallback');
      this.isLocalStorage = true;
    }

    if (!fs.existsSync(this.localUploadsDir)) {
      fs.mkdirSync(this.localUploadsDir, { recursive: true });
    }
  }

  /**
   * Получить Presigned PUT URL для прямой загрузки файла с клиента в S3
   */
  async getPresignedUploadUrl(key: string, contentType: string, expiresIn = 3600): Promise<{ uploadUrl: string; key: string }> {
    if (!this.s3 || this.isLocalStorage) {
      // Локальный fallback эндпоинт загрузки
      const localUrl = `http://localhost:${env.PORT}/api/storage/local-upload?key=${encodeURIComponent(key)}`;
      return { uploadUrl: localUrl, key };
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType
    });

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn });
    return { uploadUrl, key };
  }

  /**
   * Получить ссылку на скачивание (Presigned GET URL)
   */
  async getPresignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    if (!this.s3 || this.isLocalStorage) {
      return `http://localhost:${env.PORT}/uploads/${key}`;
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key
    });

    return getSignedUrl(this.s3, command, { expiresIn });
  }

  /**
   * Загрузка буфера напрямую (например, распакованный файл)
   */
  async uploadBuffer(key: string, buffer: Buffer, contentType: string): Promise<string> {
    if (!this.s3 || this.isLocalStorage) {
      const fullPath = path.join(this.localUploadsDir, key);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      await fs.promises.writeFile(fullPath, buffer);
      return `/uploads/${key}`;
    }

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType
      })
    );

    return `${env.S3.endpoint}/${this.bucket}/${key}`;
  }

  /**
   * Скачать файл в виде Buffer
   */
  async getFileBuffer(key: string): Promise<Buffer> {
    if (!this.s3 || this.isLocalStorage) {
      const fullPath = path.join(this.localUploadsDir, key);
      return fs.promises.readFile(fullPath);
    }

    const res = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key
      })
    );

    const stream = res.Body as any;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  /**
   * Удалить файл
   */
  async deleteFile(key: string): Promise<void> {
    if (!this.s3 || this.isLocalStorage) {
      const fullPath = path.join(this.localUploadsDir, key);
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
      }
      return;
    }

    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key
      })
    );
  }
}

export const storage = new StorageService();
