import { Readable } from 'stream';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  IStorageProvider,
  StorageUploadOptions,
  StorageDownloadResult,
  SignedUrlOptions,
} from '../interfaces';

export interface S3StorageConfig {
  region?: string;
  endpoint?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

export class S3StorageProvider implements IStorageProvider {
  private client: S3Client;

  constructor(config?: S3StorageConfig) {
    this.client = new S3Client({
      region: config?.region || process.env.AWS_REGION || 'us-east-1',
      endpoint: config?.endpoint || process.env.AWS_S3_ENDPOINT,
      credentials: config?.credentials,
    });
  }

  async upload(
    bucket: string,
    key: string,
    data: Buffer | NodeJS.ReadableStream,
    options?: StorageUploadOptions
  ): Promise<string> {
    let body: Buffer;

    if (Buffer.isBuffer(data)) {
      body = data;
    } else {
      // Convert stream to buffer
      const chunks: Buffer[] = [];
      for await (const chunk of data as Readable) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as ArrayBufferLike));
      }
      body = Buffer.concat(chunks);
    }

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: options?.contentType,
      CacheControl: options?.cacheControl,
      Metadata: options?.metadata,
      ACL: options?.isPublic ? 'public-read' : undefined,
    });

    await this.client.send(command);

    // Return S3 URL
    const region = await this.client.config.region();
    return `https://${bucket}.s3.${region}.amazonaws.com/${encodeURIComponent(key)}`;
  }

  async download(bucket: string, key: string): Promise<StorageDownloadResult> {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await this.client.send(command);

    // Convert stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of response.Body as Readable) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as ArrayBufferLike));
    }

    return {
      data: Buffer.concat(chunks),
      contentType: response.ContentType || 'application/octet-stream',
      metadata: response.Metadata,
    };
  }

  async getSignedUrl(bucket: string, key: string, options: SignedUrlOptions): Promise<string> {
    const command =
      options.action === 'write'
        ? new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            ContentType: options.contentType,
          })
        : new GetObjectCommand({
            Bucket: bucket,
            Key: key,
          });

    return getSignedUrl(this.client, command, {
      expiresIn: options.expiresInSeconds,
    });
  }

  async delete(bucket: string, key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await this.client.send(command);
  }

  async exists(bucket: string, key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }
}

// Alias for backward compatibility with factory naming
export { S3StorageProvider as AWSStorageProvider };
