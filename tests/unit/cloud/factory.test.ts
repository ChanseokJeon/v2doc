import {
  createCloudProvider,
  getCloudProvider,
  setCloudProvider,
  resetCloudProvider,
} from '../../../src/cloud/factory';
import { LocalStorageProvider } from '../../../src/cloud/local/storage';
import { LocalQueueProvider } from '../../../src/cloud/local/queue';
import * as envValidator from '../../../src/utils/env-validator';

// Mock AWS and GCP modules
jest.mock('../../../src/cloud/aws/storage', () => ({
  AWSStorageProvider: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    uploadFile: jest.fn(),
  })),
}));

jest.mock('../../../src/cloud/aws/queue', () => ({
  AWSQueueProvider: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    sendMessage: jest.fn(),
  })),
}));

jest.mock('../../../src/cloud/gcp/storage', () => ({
  GCPStorageProvider: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    uploadFile: jest.fn(),
  })),
}));

jest.mock('../../../src/cloud/gcp/queue', () => ({
  GCPQueueProvider: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    sendMessage: jest.fn(),
  })),
}));

describe('CloudProvider Factory', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Mock console.warn globally to suppress output during tests
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    // Reset factory state
    resetCloudProvider();

    // Clear cloud-related env vars
    delete process.env.CLOUD_PROVIDER;
    delete process.env.AWS_REGION;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_S3_ENDPOINT;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.GCLOUD_PROJECT;
  });

  afterEach(() => {
    // Restore console.warn
    consoleWarnSpy.mockRestore();

    // Restore original environment
    process.env = originalEnv;
    resetCloudProvider();

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('createCloudProvider', () => {
    it('should create local provider by default', async () => {
      const provider = await createCloudProvider();
      expect(provider.type).toBe('local');
      expect(provider.storage).toBeInstanceOf(LocalStorageProvider);
      expect(provider.queue).toBeInstanceOf(LocalQueueProvider);
    });

    it('should create local provider when explicitly specified', async () => {
      const provider = await createCloudProvider('local');
      expect(provider.type).toBe('local');
    });

    it('should create local provider when CLOUD_PROVIDER=local', async () => {
      process.env.CLOUD_PROVIDER = 'local';
      const provider = await createCloudProvider();
      expect(provider.type).toBe('local');
    });

    it('should throw error when AWS credentials are incomplete (only ACCESS_KEY)', async () => {
      process.env.CLOUD_PROVIDER = 'aws';
      process.env.AWS_ACCESS_KEY_ID = 'test-key-id';
      // Missing AWS_SECRET_ACCESS_KEY

      await expect(createCloudProvider()).rejects.toThrow(/AWS_SECRET_ACCESS_KEY is missing/);
    });

    it('should throw error when AWS credentials are incomplete (only SECRET)', async () => {
      process.env.CLOUD_PROVIDER = 'aws';
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
      // Missing AWS_ACCESS_KEY_ID

      await expect(createCloudProvider()).rejects.toThrow(/AWS_ACCESS_KEY_ID is missing/);
    });

    it('should validate environment before creating provider', async () => {
      const validateSpy = jest.spyOn(envValidator, 'validateAndLogEnvironment');

      await createCloudProvider('local');

      expect(validateSpy).toHaveBeenCalledWith('local');
      validateSpy.mockRestore();
    });

    it('should fail fast on invalid AWS configuration', async () => {
      process.env.CLOUD_PROVIDER = 'aws';
      process.env.AWS_ACCESS_KEY_ID = 'test-key';
      // Missing AWS_SECRET_ACCESS_KEY - should fail before creating provider

      await expect(createCloudProvider()).rejects.toThrow();
    });
  });

  describe('getCloudProvider singleton', () => {
    it('should return same instance on multiple calls', async () => {
      const provider1 = await getCloudProvider();
      const provider2 = await getCloudProvider();
      expect(provider1).toBe(provider2);
    });

    it('should return new instance after reset', async () => {
      const provider1 = await getCloudProvider();
      resetCloudProvider();
      const provider2 = await getCloudProvider();
      expect(provider1).not.toBe(provider2);
    });

    it('should validate environment only once for singleton', async () => {
      const validateSpy = jest.spyOn(envValidator, 'validateAndLogEnvironment');

      // Make multiple calls
      await getCloudProvider();
      await getCloudProvider();
      await getCloudProvider();

      // Validation should only happen once
      expect(validateSpy).toHaveBeenCalledTimes(1);

      validateSpy.mockRestore();
    });
  });

  describe('setCloudProvider injection', () => {
    it('should allow injection of custom provider', async () => {
      const mockProvider = {
        type: 'local' as const,
        storage: new LocalStorageProvider(),
        queue: new LocalQueueProvider(),
      };

      setCloudProvider(mockProvider);
      expect(await getCloudProvider()).toBe(mockProvider);
    });

    it('should allow setting null provider', async () => {
      const mockProvider = {
        type: 'local' as const,
        storage: new LocalStorageProvider(),
        queue: new LocalQueueProvider(),
      };
      setCloudProvider(mockProvider);
      setCloudProvider(null);

      // After setting null, getCloudProvider should create new one
      const newProvider = await getCloudProvider();
      expect(newProvider).not.toBe(mockProvider);
    });

    it('should allow replacing provider for testing', async () => {
      const provider1 = await getCloudProvider();

      const mockProvider = {
        type: 'local' as const,
        storage: new LocalStorageProvider(),
        queue: new LocalQueueProvider(),
      };

      setCloudProvider(mockProvider);
      const provider2 = await getCloudProvider();

      expect(provider1).not.toBe(provider2);
      expect(provider2).toBe(mockProvider);
    });
  });

  describe('resetCloudProvider', () => {
    it('should clear singleton correctly', async () => {
      const provider1 = await getCloudProvider();

      resetCloudProvider();

      const provider2 = await getCloudProvider();
      expect(provider1).not.toBe(provider2);
    });

    it('should allow fresh provider creation after reset', async () => {
      await getCloudProvider();
      resetCloudProvider();

      // Should not throw
      const newProvider = await getCloudProvider();
      expect(newProvider).toBeDefined();
    });
  });

  describe('environment validation integration', () => {
    it('should call validation with correct provider type', async () => {
      const validateSpy = jest.spyOn(envValidator, 'validateAndLogEnvironment');

      await createCloudProvider('local');

      expect(validateSpy).toHaveBeenCalledWith('local');
      validateSpy.mockRestore();
    });

    it('should validate with default provider type from env', async () => {
      const validateSpy = jest.spyOn(envValidator, 'validateAndLogEnvironment');

      process.env.CLOUD_PROVIDER = 'local';
      await createCloudProvider();

      expect(validateSpy).toHaveBeenCalledWith('local');
      validateSpy.mockRestore();
    });

    it('should not warn for local provider', async () => {
      consoleWarnSpy.mockClear();

      await createCloudProvider('local');

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should fail early on validation errors', async () => {
      process.env.CLOUD_PROVIDER = 'aws';
      process.env.AWS_ACCESS_KEY_ID = 'incomplete';
      // Missing AWS_SECRET_ACCESS_KEY

      await expect(createCloudProvider()).rejects.toThrow(/AWS_SECRET_ACCESS_KEY is missing/);
    });
  });

  describe('environment validation warnings', () => {
    it('should warn about AWS IAM role when no credentials provided', () => {
      consoleWarnSpy.mockClear();

      const result = envValidator.validateEnvironment('aws');

      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.stringContaining('Assuming IAM role or instance profile authentication')
      );
    });

    it('should warn about AWS default region', () => {
      consoleWarnSpy.mockClear();
      process.env.AWS_ACCESS_KEY_ID = 'test-key';
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';

      const result = envValidator.validateEnvironment('aws');

      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.stringContaining('AWS_REGION not set, defaulting to us-east-1')
      );
    });

    it('should warn about GCP ADC when no credentials provided', () => {
      consoleWarnSpy.mockClear();

      const result = envValidator.validateEnvironment('gcp');

      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.stringContaining('Attempting to use Application Default Credentials')
      );
    });

    it('should warn about GCP project auto-detection', () => {
      consoleWarnSpy.mockClear();
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/path/to/creds.json';

      const result = envValidator.validateEnvironment('gcp');

      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.stringContaining('GOOGLE_CLOUD_PROJECT or GCLOUD_PROJECT not set')
      );
    });

    it('should have no warnings for properly configured AWS', () => {
      consoleWarnSpy.mockClear();
      process.env.AWS_ACCESS_KEY_ID = 'test-key';
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
      process.env.AWS_REGION = 'us-west-2';

      const result = envValidator.validateEnvironment('aws');

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should have no warnings for properly configured GCP', () => {
      consoleWarnSpy.mockClear();
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/path/to/creds.json';
      process.env.GOOGLE_CLOUD_PROJECT = 'test-project';

      const result = envValidator.validateEnvironment('gcp');

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });
});
