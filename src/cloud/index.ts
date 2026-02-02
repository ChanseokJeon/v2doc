// Interfaces
export type {
  IStorageProvider,
  IQueueProvider,
  ICloudProvider,
  CloudProviderType,
  StorageUploadOptions,
  StorageDownloadResult,
  SignedUrlOptions,
  QueueMessage,
  QueueEnqueueOptions,
  QueueReceiveOptions,
} from './interfaces';

// Factory
export {
  createCloudProvider,
  getCloudProvider,
  setCloudProvider,
  resetCloudProvider,
} from './factory';

// Local implementations (always available)
export { LocalStorageProvider } from './local/storage';
export { LocalQueueProvider } from './local/queue';

// GCP implementations (requires @google-cloud/storage and @google-cloud/pubsub)
export { GcsStorageProvider, GCPStorageProvider } from './gcp/storage';
export { PubSubQueueProvider, GCPQueueProvider } from './gcp/queue';
export type { GCSStorage, GcsStorageConfig } from './gcp/storage';
export type { PubSubClient, PubSubQueueConfig } from './gcp/queue';

// AWS implementations (requires @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, @aws-sdk/client-sqs)
export { S3StorageProvider, AWSStorageProvider } from './aws/storage';
export { SqsQueueProvider, AWSQueueProvider } from './aws/queue';
export type { S3StorageConfig } from './aws/storage';
export type { SqsQueueConfig } from './aws/queue';
