/**
 * Centralized constants for v2doc
 * Allows backward compatibility during migration period
 */

export const DEFAULT_QUEUE_NAME = 'yt2pdf-jobs'; // Keep during transition
export const DEFAULT_BUCKET_PREFIX = 'yt2pdf';
export const DEFAULT_BUCKET_SUFFIX = 'output';

export function getBucketName(projectId?: string): string {
  const bucketPrefix = process.env.BUCKET_PREFIX || DEFAULT_BUCKET_PREFIX;
  const bucketSuffix = process.env.BUCKET_SUFFIX || DEFAULT_BUCKET_SUFFIX;
  const suffix = projectId ? `-${projectId}` : '';
  return `${bucketPrefix}-${bucketSuffix}${suffix}`;
}

export function getQueueName(): string {
  return process.env.QUEUE_NAME || DEFAULT_QUEUE_NAME;
}
