import {
  ICloudProvider,
  CloudProviderType,
} from './interfaces';
import { LocalStorageProvider } from './local/storage';
import { LocalQueueProvider } from './local/queue';
import { validateAndLogEnvironment } from '../utils/env-validator.js';

export async function createCloudProvider(
  type?: CloudProviderType
): Promise<ICloudProvider> {
  const providerType = type || (process.env.CLOUD_PROVIDER as CloudProviderType) || 'local';

  // Validate environment variables before creating provider
  validateAndLogEnvironment(providerType);

  switch (providerType) {
    case 'gcp': {
      // Lazy load to avoid requiring GCP dependencies when not used
      const { GCPStorageProvider } = await import('./gcp/storage.js');
      const { GCPQueueProvider } = await import('./gcp/queue.js');
      return {
        type: 'gcp',
        storage: new GCPStorageProvider(),
        queue: new GCPQueueProvider(),
      };
    }

    case 'aws': {
      // Lazy load to avoid requiring AWS dependencies when not used
      const { AWSStorageProvider } = await import('./aws/storage.js');
      const { AWSQueueProvider } = await import('./aws/queue.js');
      return {
        type: 'aws',
        storage: new AWSStorageProvider(),
        queue: new AWSQueueProvider(),
      };
    }

    case 'local':
    default:
      return {
        type: 'local',
        storage: new LocalStorageProvider(),
        queue: new LocalQueueProvider(),
      };
  }
}

// Singleton for application-wide use
let defaultProvider: ICloudProvider | null = null;
let providerPromise: Promise<ICloudProvider> | null = null;

export async function getCloudProvider(): Promise<ICloudProvider> {
  if (defaultProvider) {
    return defaultProvider;
  }

  if (!providerPromise) {
    providerPromise = createCloudProvider().then(provider => {
      defaultProvider = provider;
      return provider;
    });
  }

  return providerPromise;
}

// For testing - allows provider injection
export function setCloudProvider(provider: ICloudProvider | null): void {
  defaultProvider = provider;
  providerPromise = null;
}

// Reset provider (useful for tests)
export function resetCloudProvider(): void {
  defaultProvider = null;
  providerPromise = null;
}
