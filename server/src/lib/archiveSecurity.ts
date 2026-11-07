import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';

export interface UnpackResult {
  success: boolean;
  error?: string;
  entryPoint?: string; // Относительный путь к index.html
  totalFiles: number;
  totalBytes: number;
}

export class ArchiveSecurity {
  // Лимиты безопасности
  private static MAX_FILES = 10000;
  private static MAX_TOTAL_BYTES = 1024 * 1024 * 1024; // 1 GB в распакованном виде
  private static MAX_COMPRESSION_RATIO = 100; // Отношение сжатого к несжатому

  /**
   * Безопасная валидация и распаковка ZIP-архива
   */
  static safeExtract(zipBuffer: Buffer, destinationDir: string): UnpackResult {
    let zip: AdmZip;
    try {
      zip = new AdmZip(zipBuffer);
    } catch (e: any) {
      return { success: false, error: 'Некорректный ZIP-архив: ' + e.message, totalFiles: 0, totalBytes: 0 };
    }

    const entries = zip.getEntries();

    if (entries.length > this.MAX_FILES) {
      return {
        success: false,
        error: `Превышен лимит файлов в архиве (${entries.length} > ${this.MAX_FILES})`,
        totalFiles: entries.length,
        totalBytes: 0
      };
    }

    let totalBytes = 0;
    const destNormalized = path.resolve(destinationDir);

    // 1. Предварительный проход: проверка безопасности и вычисление размера (Zip-bomb check)
    for (const entry of entries) {
      if (entry.isDirectory) continue;

      totalBytes += entry.header.size;

      if (totalBytes > this.MAX_TOTAL_BYTES) {
        return {
          success: false,
          error: `Размер распакованных файлов превышает лимит в 1 GB (Zip-Bomb защита)`,
          totalFiles: entries.length,
          totalBytes
        };
      }

      // Проверка на Path Traversal (выход за пределы каталога назначения)
      const targetPath = path.resolve(destNormalized, entry.entryName);
      if (!targetPath.startsWith(destNormalized + path.sep) && targetPath !== destNormalized) {
        return {
          success: false,
          error: `Обнаружена попытка Path Traversal в пути: ${entry.entryName}`,
          totalFiles: entries.length,
          totalBytes
        };
      }

      // Проверка коэффициента сжатия
      const compressedSize = entry.header.compressedSize || 1;
      const ratio = entry.header.size / compressedSize;
      if (ratio > this.MAX_COMPRESSION_RATIO && entry.header.size > 10 * 1024 * 1024) {
        return {
          success: false,
          error: `Подозрительно высокий коэффициент сжатия файла ${entry.entryName} (Zip-Bomb)`,
          totalFiles: entries.length,
          totalBytes
        };
      }
    }

    // 2. Распаковка файлов
    fs.mkdirSync(destNormalized, { recursive: true });

    let entryPoint: string | undefined;

    for (const entry of entries) {
      const targetPath = path.resolve(destNormalized, entry.entryName);

      if (entry.isDirectory) {
        fs.mkdirSync(targetPath, { recursive: true });
        continue;
      }

      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, entry.getData());

      // Поиск точки входа index.html для WebGL
      const baseName = path.basename(entry.entryName).toLowerCase();
      if (baseName === 'index.html') {
        const relative = path.relative(destNormalized, targetPath).replace(/\\/g, '/');
        if (!entryPoint || relative.split('/').length < entryPoint.split('/').length) {
          entryPoint = relative;
        }
      }
    }

    return {
      success: true,
      entryPoint,
      totalFiles: entries.length,
      totalBytes
    };
  }
}
