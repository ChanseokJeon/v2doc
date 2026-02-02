import { Readable } from 'stream';

// Mock AWS SDK before importing the provider
const mockSend = jest.fn();
const mockGetSignedUrl = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: mockSend,
    config: {
      region: jest.fn().mockResolvedValue('us-east-1'),
    },
  })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input, _type: 'PutObject' })),
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ input, _type: 'GetObject' })),
  DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ input, _type: 'DeleteObject' })),
  HeadObjectCommand: jest.fn().mockImplementation((input) => ({ input, _type: 'HeadObject' })),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl,
}));

import { S3StorageProvider } from '../../../src/cloud/aws/storage';

describe('S3StorageProvider', () => {
  let storage: S3StorageProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    storage = new S3StorageProvider({ region: 'us-east-1' });
  });

  describe('upload', () => {
    it('should upload a buffer successfully', async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await storage.upload(
        'test-bucket',
        'test-key.txt',
        Buffer.from('Hello, World!')
      );

      expect(result).toBe('https://test-bucket.s3.us-east-1.amazonaws.com/test-key.txt');
      expect(mockSend).toHaveBeenCalledTimes(1);

      const command = mockSend.mock.calls[0][0];
      expect(command.input).toMatchObject({
        Bucket: 'test-bucket',
        Key: 'test-key.txt',
      });
    });

    it('should upload with options', async () => {
      mockSend.mockResolvedValueOnce({});

      await storage.upload(
        'test-bucket',
        'test-key.txt',
        Buffer.from('Content'),
        {
          contentType: 'text/plain',
          cacheControl: 'max-age=3600',
          metadata: { author: 'test' },
          isPublic: true,
        }
      );

      const command = mockSend.mock.calls[0][0];
      expect(command.input).toMatchObject({
        ContentType: 'text/plain',
        CacheControl: 'max-age=3600',
        Metadata: { author: 'test' },
        ACL: 'public-read',
      });
    });

    it('should handle stream upload', async () => {
      mockSend.mockResolvedValueOnce({});

      const stream = Readable.from(['chunk1', 'chunk2']);
      await storage.upload('test-bucket', 'stream-key.txt', stream);

      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should URL-encode special characters in key', async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await storage.upload(
        'test-bucket',
        'path/to/file with spaces.txt',
        Buffer.from('Content')
      );

      expect(result).toContain('path%2Fto%2Ffile%20with%20spaces.txt');
    });
  });

  describe('download', () => {
    it('should download a file successfully', async () => {
      const mockStream = Readable.from([Buffer.from('Downloaded content')]);
      mockSend.mockResolvedValueOnce({
        Body: mockStream,
        ContentType: 'text/plain',
        Metadata: { version: '1' },
      });

      const result = await storage.download('test-bucket', 'test-key.txt');

      expect(result.data.toString()).toBe('Downloaded content');
      expect(result.contentType).toBe('text/plain');
      expect(result.metadata).toEqual({ version: '1' });
    });

    it('should use default content type when not provided', async () => {
      const mockStream = Readable.from([Buffer.from('Binary data')]);
      mockSend.mockResolvedValueOnce({
        Body: mockStream,
      });

      const result = await storage.download('test-bucket', 'binary-file');

      expect(result.contentType).toBe('application/octet-stream');
    });
  });

  describe('getSignedUrl', () => {
    it('should generate signed URL for read', async () => {
      mockGetSignedUrl.mockResolvedValueOnce('https://signed-url.example.com/read');

      const url = await storage.getSignedUrl('test-bucket', 'test-key.txt', {
        expiresInSeconds: 3600,
        action: 'read',
      });

      expect(url).toBe('https://signed-url.example.com/read');
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ _type: 'GetObject' }),
        { expiresIn: 3600 }
      );
    });

    it('should generate signed URL for write', async () => {
      mockGetSignedUrl.mockResolvedValueOnce('https://signed-url.example.com/write');

      const url = await storage.getSignedUrl('test-bucket', 'test-key.txt', {
        expiresInSeconds: 3600,
        action: 'write',
        contentType: 'application/json',
      });

      expect(url).toBe('https://signed-url.example.com/write');
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ _type: 'PutObject' }),
        { expiresIn: 3600 }
      );
    });
  });

  describe('delete', () => {
    it('should delete a file successfully', async () => {
      mockSend.mockResolvedValueOnce({});

      await storage.delete('test-bucket', 'test-key.txt');

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command.input).toMatchObject({
        Bucket: 'test-bucket',
        Key: 'test-key.txt',
      });
    });
  });

  describe('exists', () => {
    it('should return true when file exists', async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await storage.exists('test-bucket', 'existing-key.txt');

      expect(result).toBe(true);
    });

    it('should return false when file does not exist (NotFound)', async () => {
      mockSend.mockRejectedValueOnce({ name: 'NotFound' });

      const result = await storage.exists('test-bucket', 'non-existent.txt');

      expect(result).toBe(false);
    });

    it('should return false when file does not exist (404)', async () => {
      mockSend.mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } });

      const result = await storage.exists('test-bucket', 'non-existent.txt');

      expect(result).toBe(false);
    });

    it('should throw on other errors', async () => {
      mockSend.mockRejectedValueOnce(new Error('Network error'));

      await expect(storage.exists('test-bucket', 'test.txt')).rejects.toThrow(
        'Network error'
      );
    });
  });

  describe('configuration', () => {
    it('should use default region when not provided', () => {
      const defaultStorage = new S3StorageProvider();
      expect(defaultStorage).toBeDefined();
    });

    it('should accept custom endpoint', () => {
      const localstackStorage = new S3StorageProvider({
        endpoint: 'http://localhost:4566',
        region: 'us-east-1',
      });
      expect(localstackStorage).toBeDefined();
    });

    it('should accept credentials', () => {
      const credentialedStorage = new S3StorageProvider({
        credentials: {
          accessKeyId: 'test-key',
          secretAccessKey: 'test-secret',
        },
      });
      expect(credentialedStorage).toBeDefined();
    });
  });
});
