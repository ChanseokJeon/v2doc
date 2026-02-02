import * as fs from 'fs/promises';
import * as path from 'path';
import { Readable } from 'stream';
import {
  IStorageProvider,
  StorageUploadOptions,
  StorageDownloadResult,
  SignedUrlOptions,
} from '../interfaces';

export class LocalStorageProvider implements IStorageProvider {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.join(process.cwd(), '.local-storage');
  }

  private getFilePath(bucket: string, key: string): string {
    const resolved = path.resolve(this.baseDir, bucket, key);
    const baseResolved = path.resolve(this.baseDir);
    if (!resolved.startsWith(baseResolved + path.sep) && resolved !== baseResolved) {
      throw new Error('Path traversal detected');
    }
    return resolved;
  }

  async upload(
    bucket: string,
    key: string,
    data: Buffer | NodeJS.ReadableStream,
    options?: StorageUploadOptions
  ): Promise<string> {
    const filePath = this.getFilePath(bucket, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    if (Buffer.isBuffer(data)) {
      await fs.writeFile(filePath, data);
    } else {
      // Handle stream
      const chunks: Buffer[] = [];
      for await (const chunk of data as Readable) {
        chunks.push(Buffer.from(chunk));
      }
      await fs.writeFile(filePath, Buffer.concat(chunks));
    }

    // Save metadata if provided
    if (options?.metadata || options?.contentType) {
      const metaPath = filePath + '.meta.json';
      await fs.writeFile(metaPath, JSON.stringify({
        contentType: options?.contentType,
        metadata: options?.metadata,
        cacheControl: options?.cacheControl,
      }));
    }

    return `file://${filePath}`;
  }

  async download(bucket: string, key: string): Promise<StorageDownloadResult> {
    const filePath = this.getFilePath(bucket, key);
    const data = await fs.readFile(filePath);

    let contentType = 'application/octet-stream';
    let metadata: Record<string, string> | undefined;

    try {
      const metaPath = filePath + '.meta.json';
      const metaContent = await fs.readFile(metaPath, 'utf-8');
      const meta = JSON.parse(metaContent);
      contentType = meta.contentType || contentType;
      metadata = meta.metadata;
    } catch {
      // No metadata file
    }

    return { data, contentType, metadata };
  }

  async getSignedUrl(
    bucket: string,
    key: string,
    _options: SignedUrlOptions
  ): Promise<string> {
    // For local, just return file path
    const filePath = this.getFilePath(bucket, key);
    return `file://${filePath}`;
  }

  async delete(bucket: string, key: string): Promise<void> {
    const filePath = this.getFilePath(bucket, key);
    try {
      await fs.unlink(filePath);
      await fs.unlink(filePath + '.meta.json').catch(() => {});
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  async exists(bucket: string, key: string): Promise<boolean> {
    const filePath = this.getFilePath(bucket, key);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
