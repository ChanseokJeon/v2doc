import { Readable, Writable } from 'stream';
import { GcsStorageProvider, GCSStorage } from '../../../src/cloud/gcp/storage';

describe('GcsStorageProvider', () => {
  // Mock functions
  const mockSave = jest.fn().mockResolvedValue(undefined);
  const mockCreateWriteStream = jest.fn();
  const mockDownload = jest.fn();
  const mockGetMetadata = jest.fn();
  const mockGetSignedUrl = jest.fn();
  const mockDelete = jest.fn();
  const mockExists = jest.fn();

  const mockFile = jest.fn(() => ({
    save: mockSave,
    createWriteStream: mockCreateWriteStream,
    download: mockDownload,
    getMetadata: mockGetMetadata,
    getSignedUrl: mockGetSignedUrl,
    delete: mockDelete,
    exists: mockExists,
  }));

  const mockBucket = jest.fn(() => ({
    file: mockFile,
  }));

  const mockClient: GCSStorage = {
    bucket: mockBucket,
  };

  let storage: GcsStorageProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSave.mockResolvedValue(undefined);
    storage = new GcsStorageProvider({ client: mockClient });
  });

  describe('upload', () => {
    it('should upload a buffer successfully', async () => {
      const bucket = 'test-bucket';
      const key = 'test-file.txt';
      const data = Buffer.from('Hello, World!');

      const result = await storage.upload(bucket, key, data);

      expect(result).toBe(`gs://${bucket}/${key}`);
      expect(mockBucket).toHaveBeenCalledWith(bucket);
      expect(mockFile).toHaveBeenCalledWith(key);
      expect(mockSave).toHaveBeenCalledWith(data, {
        contentType: undefined,
        metadata: undefined,
        cacheControl: undefined,
        public: undefined,
      });
    });

    it('should upload with options', async () => {
      const bucket = 'test-bucket';
      const key = 'test-file.txt';
      const data = Buffer.from('Content');
      const options = {
        contentType: 'text/plain',
        metadata: { author: 'test' },
        cacheControl: 'max-age=3600',
        isPublic: true,
      };

      await storage.upload(bucket, key, data, options);

      expect(mockSave).toHaveBeenCalledWith(data, {
        contentType: 'text/plain',
        metadata: { metadata: { author: 'test' } },
        cacheControl: 'max-age=3600',
        public: true,
      });
    });

    it('should upload a stream successfully', async () => {
      const bucket = 'test-bucket';
      const key = 'stream-file.txt';
      const readable = Readable.from(['Hello, ', 'Stream!']);

      // Create a proper writable mock that works with pipe
      const writableStream = new Writable({
        write(_chunk: Buffer, _encoding: BufferEncoding, callback: () => void) {
          callback();
        },
      });

      // Emit finish after a tick
      setTimeout(() => writableStream.emit('finish'), 10);

      mockCreateWriteStream.mockReturnValue(writableStream);

      const result = await storage.upload(bucket, key, readable);

      expect(result).toBe(`gs://${bucket}/${key}`);
      expect(mockCreateWriteStream).toHaveBeenCalled();
    });
  });

  describe('download', () => {
    it('should download a file successfully', async () => {
      const bucket = 'test-bucket';
      const key = 'download-test.txt';
      const content = Buffer.from('Downloaded content');

      mockDownload.mockResolvedValue([content]);
      mockGetMetadata.mockResolvedValue([{
        contentType: 'text/plain',
        metadata: { author: 'test' },
      }]);

      const result = await storage.download(bucket, key);

      expect(result.data).toEqual(content);
      expect(result.contentType).toBe('text/plain');
      expect(result.metadata).toEqual({ author: 'test' });
    });

    it('should use default content type when not provided', async () => {
      mockDownload.mockResolvedValue([Buffer.from('data')]);
      mockGetMetadata.mockResolvedValue([{}]);

      const result = await storage.download('bucket', 'key');

      expect(result.contentType).toBe('application/octet-stream');
    });
  });

  describe('getSignedUrl', () => {
    it('should generate a signed URL for reading', async () => {
      const bucket = 'test-bucket';
      const key = 'signed-file.txt';
      const expectedUrl = 'https://storage.googleapis.com/signed-url';

      mockGetSignedUrl.mockResolvedValue([expectedUrl]);

      const result = await storage.getSignedUrl(bucket, key, {
        expiresInSeconds: 3600,
        action: 'read',
      });

      expect(result).toBe(expectedUrl);
      expect(mockGetSignedUrl).toHaveBeenCalledWith(expect.objectContaining({
        version: 'v4',
        action: 'read',
      }));
    });

    it('should generate a signed URL for writing with content type', async () => {
      const expectedUrl = 'https://storage.googleapis.com/write-url';
      mockGetSignedUrl.mockResolvedValue([expectedUrl]);

      const result = await storage.getSignedUrl('bucket', 'key', {
        expiresInSeconds: 3600,
        action: 'write',
        contentType: 'application/pdf',
      });

      expect(result).toBe(expectedUrl);
      expect(mockGetSignedUrl).toHaveBeenCalledWith(expect.objectContaining({
        action: 'write',
        contentType: 'application/pdf',
      }));
    });
  });

  describe('delete', () => {
    it('should delete a file successfully', async () => {
      mockDelete.mockResolvedValue(undefined);

      await storage.delete('test-bucket', 'to-delete.txt');

      expect(mockDelete).toHaveBeenCalledWith({ ignoreNotFound: true });
    });

    it('should not throw for non-existent file (404)', async () => {
      const error = new Error('Not Found') as Error & { code: number };
      error.code = 404;
      mockDelete.mockRejectedValue(error);

      await expect(storage.delete('bucket', 'missing.txt'))
        .resolves.not.toThrow();
    });

    it('should throw for other errors', async () => {
      const error = new Error('Permission denied') as Error & { code: number };
      error.code = 403;
      mockDelete.mockRejectedValue(error);

      await expect(storage.delete('bucket', 'forbidden.txt'))
        .rejects.toThrow('Permission denied');
    });
  });

  describe('exists', () => {
    it('should return true for existing file', async () => {
      mockExists.mockResolvedValue([true]);

      const result = await storage.exists('bucket', 'exists.txt');

      expect(result).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      mockExists.mockResolvedValue([false]);

      const result = await storage.exists('bucket', 'missing.txt');

      expect(result).toBe(false);
    });
  });
});
