import { Readable } from 'stream';
import {
  IStorageProvider,
  StorageUploadOptions,
  StorageDownloadResult,
  SignedUrlOptions,
} from '../interfaces';

// Types for @google-cloud/storage
interface GCSBucket {
  file(name: string): GCSFile;
}

interface GCSFile {
  save(
    data: Buffer,
    options?: {
      contentType?: string;
      metadata?: { metadata?: Record<string, string> };
      cacheControl?: string;
      public?: boolean;
    }
  ): Promise<void>;
  createWriteStream(options?: {
    contentType?: string;
    metadata?: { metadata?: Record<string, string> };
    cacheControl?: string;
    public?: boolean;
    resumable?: boolean;
  }): NodeJS.WritableStream;
  download(): Promise<[Buffer]>;
  getMetadata(): Promise<
    [
      {
        contentType?: string;
        metadata?: Record<string, string>;
      },
    ]
  >;
  getSignedUrl(options: {
    version: 'v4';
    action: 'read' | 'write';
    expires: number;
    contentType?: string;
  }): Promise<[string]>;
  delete(options?: { ignoreNotFound?: boolean }): Promise<void>;
  exists(): Promise<[boolean]>;
}

export interface GCSStorage {
  bucket(name: string): GCSBucket;
}

export interface GcsStorageConfig {
  /** Injected storage client (for testing) */
  client?: GCSStorage;
}

export class GcsStorageProvider implements IStorageProvider {
  private storage: GCSStorage | null = null;
  private injectedClient?: GCSStorage;

  constructor(config?: GcsStorageConfig) {
    this.injectedClient = config?.client;
  }

  private async getStorage(): Promise<GCSStorage> {
    if (this.injectedClient) {
      return this.injectedClient;
    }
    if (!this.storage) {
      try {
        const { Storage } = await import('@google-cloud/storage');
        this.storage = new Storage() as unknown as GCSStorage;
      } catch (error) {
        throw new Error(
          'Failed to load @google-cloud/storage. Please install it: npm install @google-cloud/storage'
        );
      }
    }
    return this.storage;
  }

  async upload(
    bucket: string,
    key: string,
    data: Buffer | NodeJS.ReadableStream,
    options?: StorageUploadOptions
  ): Promise<string> {
    const storage = await this.getStorage();
    const gcsFile = storage.bucket(bucket).file(key);

    const uploadOptions = {
      contentType: options?.contentType,
      metadata: options?.metadata ? { metadata: options.metadata } : undefined,
      cacheControl: options?.cacheControl,
      public: options?.isPublic,
    };

    if (Buffer.isBuffer(data)) {
      await gcsFile.save(data, uploadOptions);
    } else {
      // Handle stream upload
      await new Promise<void>((resolve, reject) => {
        const writeStream = gcsFile.createWriteStream({
          ...uploadOptions,
          resumable: false,
        });

        const readable = data as Readable;
        readable.pipe(writeStream).on('finish', resolve).on('error', reject);
      });
    }

    return `gs://${bucket}/${key}`;
  }

  async download(bucket: string, key: string): Promise<StorageDownloadResult> {
    const storage = await this.getStorage();
    const gcsFile = storage.bucket(bucket).file(key);

    const [data] = await gcsFile.download();
    const [metadata] = await gcsFile.getMetadata();

    return {
      data,
      contentType: metadata.contentType || 'application/octet-stream',
      metadata: metadata.metadata,
    };
  }

  async getSignedUrl(bucket: string, key: string, options: SignedUrlOptions): Promise<string> {
    const storage = await this.getStorage();
    const gcsFile = storage.bucket(bucket).file(key);

    const [url] = await gcsFile.getSignedUrl({
      version: 'v4',
      action: options.action,
      expires: Date.now() + options.expiresInSeconds * 1000,
      contentType: options.contentType,
    });

    return url;
  }

  async delete(bucket: string, key: string): Promise<void> {
    const storage = await this.getStorage();
    const gcsFile = storage.bucket(bucket).file(key);

    try {
      await gcsFile.delete({ ignoreNotFound: true });
    } catch (error: unknown) {
      // GCS may throw even with ignoreNotFound in some cases
      const gcsError = error as { code?: number };
      if (gcsError.code !== 404) {
        throw error;
      }
    }
  }

  async exists(bucket: string, key: string): Promise<boolean> {
    const storage = await this.getStorage();
    const gcsFile = storage.bucket(bucket).file(key);

    const [exists] = await gcsFile.exists();
    return exists;
  }
}

// Alias for backward compatibility with factory
export { GcsStorageProvider as GCPStorageProvider };
