/**
 * Cloud provider abstraction interfaces
 * Supports GCP, AWS, and local implementations
 */

// Storage Provider Types
export interface StorageUploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  cacheControl?: string;
  isPublic?: boolean;
}

export interface StorageDownloadResult {
  data: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface SignedUrlOptions {
  expiresInSeconds: number;
  action: 'read' | 'write';
  contentType?: string;
}

export interface IStorageProvider {
  upload(
    bucket: string,
    key: string,
    data: Buffer | NodeJS.ReadableStream,
    options?: StorageUploadOptions
  ): Promise<string>;

  download(bucket: string, key: string): Promise<StorageDownloadResult>;

  getSignedUrl(
    bucket: string,
    key: string,
    options: SignedUrlOptions
  ): Promise<string>;

  delete(bucket: string, key: string): Promise<void>;

  exists(bucket: string, key: string): Promise<boolean>;
}

// Queue Provider Types
export interface QueueMessage<T = unknown> {
  id: string;
  body: T;
  receiptHandle?: string;
  attributes?: Record<string, string>;
  enqueuedAt: Date;
  retryCount?: number;
}

export interface QueueEnqueueOptions {
  delaySeconds?: number;
  priority?: 'high' | 'normal' | 'low';
  deduplicationId?: string;
  groupId?: string;
}

export interface QueueReceiveOptions {
  maxMessages?: number;
  visibilityTimeoutSeconds?: number;
  waitTimeSeconds?: number;
}

export interface IQueueProvider {
  enqueue<T>(
    queueName: string,
    message: T,
    options?: QueueEnqueueOptions
  ): Promise<string>;

  receive<T>(
    queueName: string,
    options?: QueueReceiveOptions
  ): Promise<QueueMessage<T>[]>;

  ack(queueName: string, receiptHandle: string): Promise<void>;

  nack(
    queueName: string,
    receiptHandle: string,
    delaySeconds?: number
  ): Promise<void>;

  moveToDLQ(queueName: string, message: QueueMessage): Promise<void>;
}

// Unified Cloud Provider
export type CloudProviderType = 'gcp' | 'aws' | 'local';

export interface ICloudProvider {
  readonly type: CloudProviderType;
  readonly storage: IStorageProvider;
  readonly queue: IQueueProvider;
}
