/**
 * Unit tests for environment variable validation
 * Tests all cloud providers and validation scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { validateEnvironment, validateAndLogEnvironment } from '../../../src/utils/env-validator.js';

describe('Environment Validator', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment to avoid test pollution
    process.env = originalEnv;
  });

  describe('Local Provider', () => {
    it('should return valid with no errors or warnings', () => {
      // Clear all env vars
      process.env = {};

      const result = validateEnvironment('local');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should return valid even with other env vars present', () => {
      process.env = {
        AWS_ACCESS_KEY_ID: 'test-key',
        GOOGLE_APPLICATION_CREDENTIALS: '/path/to/creds.json',
      };

      const result = validateEnvironment('local');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('AWS Provider', () => {
    it('should return valid when both credentials are set', () => {
      process.env = {
        AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
        AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        AWS_REGION: 'us-west-2',
      };

      const result = validateEnvironment('aws');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should return error when only AWS_ACCESS_KEY_ID is set', () => {
      process.env = {
        AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
      };

      const result = validateEnvironment('aws');

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('AWS_ACCESS_KEY_ID is set but AWS_SECRET_ACCESS_KEY is missing');
      expect(result.errors[0]).toContain('Both credentials must be provided together');
    });

    it('should return error when only AWS_SECRET_ACCESS_KEY is set', () => {
      process.env = {
        AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      };

      const result = validateEnvironment('aws');

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('AWS_SECRET_ACCESS_KEY is set but AWS_ACCESS_KEY_ID is missing');
      expect(result.errors[0]).toContain('Both credentials must be provided together');
    });

    it('should return warning when no credentials are set (IAM role assumption)', () => {
      process.env = {
        AWS_REGION: 'us-west-2',
      };

      const result = validateEnvironment('aws');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('No AWS credentials found');
      expect(result.warnings[0]).toContain('Assuming IAM role or instance profile authentication');
    });

    it('should return warning when AWS_REGION not set (defaults to us-east-1)', () => {
      process.env = {
        AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
        AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      };

      const result = validateEnvironment('aws');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('AWS_REGION not set');
      expect(result.warnings[0]).toContain('defaulting to us-east-1');
    });

    it('should return valid with no warnings when all env vars are set', () => {
      process.env = {
        AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
        AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        AWS_REGION: 'us-west-2',
      };

      const result = validateEnvironment('aws');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should return multiple warnings when neither credentials nor region are set', () => {
      process.env = {};

      const result = validateEnvironment('aws');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(2);
      expect(result.warnings[0]).toContain('No AWS credentials found');
      expect(result.warnings[1]).toContain('AWS_REGION not set');
    });
  });

  describe('GCP Provider', () => {
    it('should return valid when GOOGLE_APPLICATION_CREDENTIALS is set', () => {
      process.env = {
        GOOGLE_APPLICATION_CREDENTIALS: '/path/to/service-account.json',
        GOOGLE_CLOUD_PROJECT: 'my-project-id',
      };

      const result = validateEnvironment('gcp');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should return warning when GOOGLE_APPLICATION_CREDENTIALS not set (ADC)', () => {
      process.env = {
        GOOGLE_CLOUD_PROJECT: 'my-project-id',
      };

      const result = validateEnvironment('gcp');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('GOOGLE_APPLICATION_CREDENTIALS not set');
      expect(result.warnings[0]).toContain('Application Default Credentials (ADC)');
      expect(result.warnings[0]).toContain('gcloud auth application-default login');
    });

    it('should return warning when GOOGLE_CLOUD_PROJECT not set', () => {
      process.env = {
        GOOGLE_APPLICATION_CREDENTIALS: '/path/to/service-account.json',
      };

      const result = validateEnvironment('gcp');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('GOOGLE_CLOUD_PROJECT or GCLOUD_PROJECT not set');
      expect(result.warnings[0]).toContain('auto-detect the project');
    });

    it('should return valid with no warnings when all env vars are set', () => {
      process.env = {
        GOOGLE_APPLICATION_CREDENTIALS: '/path/to/service-account.json',
        GOOGLE_CLOUD_PROJECT: 'my-project-id',
      };

      const result = validateEnvironment('gcp');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should accept GCLOUD_PROJECT as alternative to GOOGLE_CLOUD_PROJECT', () => {
      process.env = {
        GOOGLE_APPLICATION_CREDENTIALS: '/path/to/service-account.json',
        GCLOUD_PROJECT: 'my-project-id',
      };

      const result = validateEnvironment('gcp');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should return multiple warnings when no env vars are set', () => {
      process.env = {};

      const result = validateEnvironment('gcp');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(2);
      expect(result.warnings[0]).toContain('GOOGLE_APPLICATION_CREDENTIALS not set');
      expect(result.warnings[1]).toContain('GOOGLE_CLOUD_PROJECT or GCLOUD_PROJECT not set');
    });
  });

  describe('validateAndLogEnvironment', () => {
    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    it('should throw error when validation fails', () => {
      process.env = {
        AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
        // Missing AWS_SECRET_ACCESS_KEY - should cause validation error
      };

      expect(() => {
        validateAndLogEnvironment('aws');
      }).toThrow('Environment validation failed');
    });

    it('should include provider name in error message', () => {
      process.env = {
        AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
      };

      expect(() => {
        validateAndLogEnvironment('aws');
      }).toThrow("'aws' provider");
    });

    it('should include error details in error message', () => {
      process.env = {
        AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      };

      expect(() => {
        validateAndLogEnvironment('aws');
      }).toThrow('AWS_SECRET_ACCESS_KEY is set but AWS_ACCESS_KEY_ID is missing');
    });

    it('should not throw when validation passes with no warnings', () => {
      process.env = {
        AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
        AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        AWS_REGION: 'us-west-2',
      };

      expect(() => {
        validateAndLogEnvironment('aws');
      }).not.toThrow();

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should log warnings but not throw when validation passes with warnings', () => {
      process.env = {
        AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
        AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        // Missing AWS_REGION - should cause warning
      };

      expect(() => {
        validateAndLogEnvironment('aws');
      }).not.toThrow();

      expect(consoleWarnSpy).toHaveBeenCalled();
      const warnCalls = consoleWarnSpy.mock.calls.flat().join('\n');
      expect(warnCalls).toContain('Environment validation warnings');
      expect(warnCalls).toContain('aws');
      expect(warnCalls).toContain('AWS_REGION not set');
    });

    it('should not throw for local provider', () => {
      process.env = {};

      expect(() => {
        validateAndLogEnvironment('local');
      }).not.toThrow();

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should use CLOUD_PROVIDER env var when no provider specified', () => {
      process.env = {
        CLOUD_PROVIDER: 'aws',
        AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
      };

      expect(() => {
        validateAndLogEnvironment();
      }).toThrow("'aws' provider");
    });

    it('should default to local when no provider specified and no CLOUD_PROVIDER env var', () => {
      process.env = {};

      expect(() => {
        validateAndLogEnvironment();
      }).not.toThrow();

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined process.env values', () => {
      process.env = {
        AWS_ACCESS_KEY_ID: undefined,
        AWS_SECRET_ACCESS_KEY: undefined,
      };

      const result = validateEnvironment('aws');

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(2);
      expect(result.warnings[0]).toContain('No AWS credentials found');
      expect(result.warnings[1]).toContain('AWS_REGION not set');
    });

    it('should handle empty string values as missing', () => {
      process.env = {
        AWS_ACCESS_KEY_ID: '',
        AWS_SECRET_ACCESS_KEY: '',
      };

      const result = validateEnvironment('aws');

      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('No AWS credentials found'))).toBe(true);
    });

    it('should treat whitespace-only values as missing', () => {
      process.env = {
        AWS_ACCESS_KEY_ID: '   ',
        AWS_SECRET_ACCESS_KEY: '   ',
        AWS_REGION: '   ',
      };

      const result = validateEnvironment('aws');

      // Whitespace values are now treated as missing (trimmed)
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      // Should warn about missing credentials and region
      expect(result.warnings).toHaveLength(2);
    });
  });
});
