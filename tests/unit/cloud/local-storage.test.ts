import * as fs from 'fs/promises';
import * as path from 'path';
import { LocalStorageProvider } from '../../../src/cloud/local/storage';

describe('LocalStorageProvider', () => {
  const testDir = path.join(__dirname, '../../.test-storage');
  let storage: LocalStorageProvider;

  beforeAll(async () => {
    storage = new LocalStorageProvider(testDir);
  });

  afterAll(async () => {
    // Cleanup
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('upload', () => {
    it('should upload a buffer successfully', async () => {
      const bucket = 'test-bucket';
      const key = 'test-file.txt';
      const data = Buffer.from('Hello, World!');

      const result = await storage.upload(bucket, key, data);

      expect(result).toContain('file://');
      expect(await storage.exists(bucket, key)).toBe(true);
    });

    it('should upload with metadata', async () => {
      const bucket = 'test-bucket';
      const key = 'test-with-meta.txt';
      const data = Buffer.from('Content');

      await storage.upload(bucket, key, data, {
        contentType: 'text/plain',
        metadata: { author: 'test' },
      });

      const result = await storage.download(bucket, key);
      expect(result.contentType).toBe('text/plain');
      expect(result.metadata?.author).toBe('test');
    });

    it('should create nested directories', async () => {
      const bucket = 'test-bucket';
      const key = 'nested/deep/path/file.txt';
      const data = Buffer.from('Nested content');

      await storage.upload(bucket, key, data);
      expect(await storage.exists(bucket, key)).toBe(true);
    });
  });

  describe('download', () => {
    it('should download an existing file', async () => {
      const bucket = 'test-bucket';
      const key = 'download-test.txt';
      const content = 'Download me!';
      await storage.upload(bucket, key, Buffer.from(content));

      const result = await storage.download(bucket, key);
      expect(result.data.toString()).toBe(content);
    });

    it('should throw for non-existent file', async () => {
      await expect(storage.download('test-bucket', 'non-existent.txt'))
        .rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('should delete an existing file', async () => {
      const bucket = 'test-bucket';
      const key = 'to-delete.txt';
      await storage.upload(bucket, key, Buffer.from('Delete me'));

      await storage.delete(bucket, key);
      expect(await storage.exists(bucket, key)).toBe(false);
    });

    it('should not throw for non-existent file', async () => {
      await expect(storage.delete('test-bucket', 'already-gone.txt'))
        .resolves.not.toThrow();
    });
  });

  describe('exists', () => {
    it('should return true for existing file', async () => {
      const bucket = 'test-bucket';
      const key = 'exists-check.txt';
      await storage.upload(bucket, key, Buffer.from('I exist'));

      expect(await storage.exists(bucket, key)).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      expect(await storage.exists('test-bucket', 'nope.txt')).toBe(false);
    });
  });

  describe('getSignedUrl', () => {
    it('should return file:// URL', async () => {
      const bucket = 'test-bucket';
      const key = 'signed-url-test.txt';
      await storage.upload(bucket, key, Buffer.from('Sign me'));

      const url = await storage.getSignedUrl(bucket, key, {
        expiresInSeconds: 3600,
        action: 'read',
      });

      expect(url).toContain('file://');
      expect(url).toContain(key);
    });
  });
});
