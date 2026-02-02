/**
 * Environment variable validation for cloud providers
 * Validates required credentials before provider initialization
 */

import { CloudProviderType } from '../cloud/interfaces.js';

export interface EnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface ProviderRequirements {
  required: string[];
  optional: string[];
  defaults: Record<string, string>;
}

const PROVIDER_REQUIREMENTS: Record<CloudProviderType, ProviderRequirements> = {
  local: {
    required: [],
    optional: [],
    defaults: {},
  },

  aws: {
    required: [],
    optional: ['AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_S3_ENDPOINT'],
    defaults: {
      AWS_REGION: 'us-east-1',
    },
  },

  gcp: {
    required: [],
    optional: ['GOOGLE_APPLICATION_CREDENTIALS', 'GOOGLE_CLOUD_PROJECT', 'GCLOUD_PROJECT'],
    defaults: {},
  },
};

/**
 * Validate environment variables for a cloud provider
 * @param cloudProvider - Cloud provider type (local, aws, gcp)
 * @returns Validation result with errors and warnings
 */
export function validateEnvironment(
  cloudProvider?: CloudProviderType
): EnvValidationResult {
  const provider = cloudProvider || (process.env.CLOUD_PROVIDER as CloudProviderType) || 'local';
  const requirements = PROVIDER_REQUIREMENTS[provider];

  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate required variables
  for (const envVar of requirements.required) {
    if (!process.env[envVar]) {
      errors.push(`Missing required environment variable: ${envVar}`);
    }
  }

  // Check for optional variables and warn about defaults
  switch (provider) {
    case 'aws': {
      validateAWS(errors, warnings);
      break;
    }

    case 'gcp': {
      validateGCP(errors, warnings);
      break;
    }

    case 'local':
    default:
      // Local provider has no requirements
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate AWS-specific environment variables
 */
function validateAWS(errors: string[], warnings: string[]): void {
  const hasAccessKeyId = (process.env.AWS_ACCESS_KEY_ID || '').trim() !== '';
  const hasSecretAccessKey = (process.env.AWS_SECRET_ACCESS_KEY || '').trim() !== '';
  const hasRegion = (process.env.AWS_REGION || '').trim() !== '';

  // Check for credential configuration
  if (!hasAccessKeyId && !hasSecretAccessKey) {
    warnings.push(
      'No AWS credentials found (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY). ' +
      'Assuming IAM role or instance profile authentication.'
    );
  } else if (hasAccessKeyId && !hasSecretAccessKey) {
    errors.push(
      'AWS_ACCESS_KEY_ID is set but AWS_SECRET_ACCESS_KEY is missing. ' +
      'Both credentials must be provided together.'
    );
  } else if (!hasAccessKeyId && hasSecretAccessKey) {
    errors.push(
      'AWS_SECRET_ACCESS_KEY is set but AWS_ACCESS_KEY_ID is missing. ' +
      'Both credentials must be provided together.'
    );
  }

  // Check for region configuration
  if (!hasRegion) {
    warnings.push(
      'AWS_REGION not set, defaulting to us-east-1. ' +
      'Set AWS_REGION to specify a different region.'
    );
  }
}

/**
 * Validate GCP-specific environment variables
 */
function validateGCP(_errors: string[], warnings: string[]): void {
  const hasApplicationCredentials = (process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim() !== '';
  const hasCloudProject = (process.env.GOOGLE_CLOUD_PROJECT || '').trim() !== '';
  const hasGcloudProject = (process.env.GCLOUD_PROJECT || '').trim() !== '';

  // Check for authentication
  if (!hasApplicationCredentials) {
    warnings.push(
      'GOOGLE_APPLICATION_CREDENTIALS not set. ' +
      'Attempting to use Application Default Credentials (ADC). ' +
      'Ensure you have run "gcloud auth application-default login" or are running on GCP.'
    );
  }

  // Check for project configuration
  if (!hasCloudProject && !hasGcloudProject) {
    warnings.push(
      'GOOGLE_CLOUD_PROJECT or GCLOUD_PROJECT not set. ' +
      'The GCP client will attempt to auto-detect the project. ' +
      'Set GOOGLE_CLOUD_PROJECT to explicitly specify the project.'
    );
  }
}

/**
 * Validate and log environment variables, throwing on errors
 * @param cloudProvider - Cloud provider type
 * @throws Error if validation fails
 */
export function validateAndLogEnvironment(
  cloudProvider?: CloudProviderType
): void {
  const result = validateEnvironment(cloudProvider);
  const provider = cloudProvider || (process.env.CLOUD_PROVIDER as CloudProviderType) || 'local';

  // Log warnings
  if (result.warnings.length > 0) {
    console.warn(`\n⚠️  Environment validation warnings for '${provider}' provider:`);
    for (const warning of result.warnings) {
      console.warn(`   - ${warning}`);
    }
    console.warn('');
  }

  // Throw on errors
  if (!result.valid) {
    const errorMessage = [
      `\n❌ Environment validation failed for '${provider}' provider:`,
      ...result.errors.map(err => `   - ${err}`),
      '',
    ].join('\n');
    throw new Error(errorMessage);
  }
}
