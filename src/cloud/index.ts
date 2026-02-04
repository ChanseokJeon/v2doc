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

// Factory (handles lazy loading of provider implementations)
export {
  createCloudProvider,
  getCloudProvider,
  setCloudProvider,
  resetCloudProvider,
} from './factory';

// Local implementations (always available, no external deps)
export { LocalStorageProvider } from './local/storage';
export { LocalQueueProvider } from './local/queue';

// Note: GCP and AWS providers are NOT exported here to avoid forcing
// their dependencies to be loaded. Use createCloudProvider() instead,
// which handles lazy loading based on CLOUD_PROVIDER env var.
