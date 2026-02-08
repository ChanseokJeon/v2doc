/**
 * YouTube Provider - Proxy fallback tests
 * Tests the execWithProxyFallback mechanism via public methods (getMetadata)
 */

// Mock child_process/util BEFORE imports
const mockExecFile = jest.fn();

jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));

jest.mock('util', () => ({
  promisify: jest.fn(() => mockExecFile),
}));

// Mock fs/promises
const mockMkdir = jest.fn().mockResolvedValue(undefined);
const mockReaddir = jest.fn();
const mockReadFile = jest.fn();
const mockRm = jest.fn().mockResolvedValue(undefined);
const mockWriteFile = jest.fn().mockResolvedValue(undefined);
const mockUnlink = jest.fn().mockResolvedValue(undefined);
const mockRename = jest.fn().mockResolvedValue(undefined);

jest.mock('fs/promises', () => ({
  mkdir: mockMkdir,
  readdir: mockReaddir,
  readFile: mockReadFile,
  rm: mockRm,
  writeFile: mockWriteFile,
  unlink: mockUnlink,
  rename: mockRename,
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    setLevel: jest.fn(),
  },
}));

// Mock url util
jest.mock('../../../src/utils/url', () => ({
  isValidYouTubeUrl: jest.fn().mockReturnValue(true),
  buildVideoUrl: jest.fn((id: string) => `https://youtube.com/watch?v=${id}`),
}));

import { YouTubeProvider } from '../../../src/providers/youtube';
import { logger } from '../../../src/utils/logger';

describe('YouTubeProvider - Proxy Fallback', () => {
  let originalEnv: NodeJS.ProcessEnv;

  // Mock successful yt-dlp metadata response
  const mockMetadataResponse = {
    id: 'test123',
    title: 'Test Video',
    description: 'Test description',
    duration: 120,
    thumbnail: 'https://i.ytimg.com/vi/test123/hqdefault.jpg',
    uploader: 'Test Channel',
    upload_date: '20240101',
    view_count: 1000,
    subtitles: {},
    automatic_captions: {},
  };

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Reset all mocks
    jest.clearAllMocks();
    mockExecFile.mockReset();
    mockMkdir.mockReset().mockResolvedValue(undefined);
    mockReaddir.mockReset();
    mockReadFile.mockReset();
    mockRm.mockReset().mockResolvedValue(undefined);
    mockWriteFile.mockReset().mockResolvedValue(undefined);
    mockUnlink.mockReset().mockResolvedValue(undefined);
    mockRename.mockReset().mockResolvedValue(undefined);

    // Clean environment
    delete process.env.YT_DLP_PROXY;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Success without proxy', () => {
    it('should succeed on first attempt when no IP block occurs', async () => {
      const provider = new YouTubeProvider();

      mockExecFile.mockResolvedValueOnce({
        stdout: JSON.stringify(mockMetadataResponse),
        stderr: '',
      });

      const result = await provider.getMetadata('https://www.youtube.com/watch?v=test123');

      expect(result.id).toBe('test123');
      expect(result.title).toBe('Test Video');
      expect(mockExecFile).toHaveBeenCalledTimes(1);

      // Verify no proxy args in the call
      const callArgs = mockExecFile.mock.calls[0][1];
      expect(callArgs).not.toContain('--proxy');
    });

    it('should not use proxy even when configured if first attempt succeeds', async () => {
      process.env.YT_DLP_PROXY = 'http://proxy.example.com:8080';
      const provider = new YouTubeProvider();

      mockExecFile.mockResolvedValueOnce({
        stdout: JSON.stringify(mockMetadataResponse),
        stderr: '',
      });

      const result = await provider.getMetadata('https://www.youtube.com/watch?v=test123');

      expect(result.id).toBe('test123');
      expect(mockExecFile).toHaveBeenCalledTimes(1);

      // First attempt should not include proxy
      const callArgs = mockExecFile.mock.calls[0][1];
      expect(callArgs).not.toContain('--proxy');
    });
  });

  describe('IP block detected, proxy retry succeeds', () => {
    it('should retry with proxy on "Sign in to confirm you\'re not a bot" error', async () => {
      process.env.YT_DLP_PROXY = 'http://proxy.example.com:8080';
      const provider = new YouTubeProvider();

      const ipBlockError = new Error("Sign in to confirm you're not a bot");

      mockExecFile
        .mockRejectedValueOnce(ipBlockError)
        .mockResolvedValueOnce({
          stdout: JSON.stringify(mockMetadataResponse),
          stderr: '',
        });

      const result = await provider.getMetadata('https://www.youtube.com/watch?v=test123');

      expect(result.id).toBe('test123');
      expect(result.title).toBe('Test Video');
      expect(mockExecFile).toHaveBeenCalledTimes(2);

      // Verify first call has no proxy
      const firstCallArgs = mockExecFile.mock.calls[0][1];
      expect(firstCallArgs).not.toContain('--proxy');

      // Verify second call includes proxy
      const secondCallArgs = mockExecFile.mock.calls[1][1];
      expect(secondCallArgs).toContain('--proxy');
      expect(secondCallArgs).toContain('http://proxy.example.com:8080');

      // Verify warning was logged
      expect(logger.warn).toHaveBeenCalledWith('YouTube IP 차단 감지, 프록시로 재시도 중...');
    });

    it('should retry with proxy on HTTP 403 error', async () => {
      process.env.YT_DLP_PROXY = 'http://proxy.example.com:8080';
      const provider = new YouTubeProvider();

      const http403Error = new Error('HTTP Error 403: Forbidden');

      mockExecFile
        .mockRejectedValueOnce(http403Error)
        .mockResolvedValueOnce({
          stdout: JSON.stringify(mockMetadataResponse),
          stderr: '',
        });

      const result = await provider.getMetadata('https://www.youtube.com/watch?v=test123');

      expect(result.id).toBe('test123');
      expect(mockExecFile).toHaveBeenCalledTimes(2);

      const secondCallArgs = mockExecFile.mock.calls[1][1];
      expect(secondCallArgs).toContain('--proxy');
    });

    it('should retry with proxy on HTTP 429 error', async () => {
      process.env.YT_DLP_PROXY = 'http://proxy.example.com:8080';
      const provider = new YouTubeProvider();

      const http429Error = new Error('HTTP Error 429: Too Many Requests');

      mockExecFile
        .mockRejectedValueOnce(http429Error)
        .mockResolvedValueOnce({
          stdout: JSON.stringify(mockMetadataResponse),
          stderr: '',
        });

      const result = await provider.getMetadata('https://www.youtube.com/watch?v=test123');

      expect(result.id).toBe('test123');
      expect(mockExecFile).toHaveBeenCalledTimes(2);
    });

    it('should detect IP block from err.stderr even if err.message differs', async () => {
      process.env.YT_DLP_PROXY = 'http://proxy.example.com:8080';
      const provider = new YouTubeProvider();

      // Error with IP block pattern in stderr, not in message
      const error = new Error('Command failed with exit code 1');
      (error as any).stderr = "ERROR: Sign in to confirm you're not a bot";

      mockExecFile
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          stdout: JSON.stringify(mockMetadataResponse),
          stderr: '',
        });

      const result = await provider.getMetadata('https://www.youtube.com/watch?v=test123');

      expect(result.id).toBe('test123');
      expect(mockExecFile).toHaveBeenCalledTimes(2);
    });

    it('should handle case-insensitive IP block detection', async () => {
      process.env.YT_DLP_PROXY = 'http://proxy.example.com:8080';
      const provider = new YouTubeProvider();

      const error = new Error('SIGN IN TO CONFIRM YOU\'RE NOT A BOT');

      mockExecFile
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          stdout: JSON.stringify(mockMetadataResponse),
          stderr: '',
        });

      const result = await provider.getMetadata('https://www.youtube.com/watch?v=test123');

      expect(result.id).toBe('test123');
      expect(mockExecFile).toHaveBeenCalledTimes(2);
    });

    it('should detect "detected as a bot" pattern', async () => {
      process.env.YT_DLP_PROXY = 'http://proxy.example.com:8080';
      const provider = new YouTubeProvider();

      const error = new Error('This request was detected as a bot');

      mockExecFile
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          stdout: JSON.stringify(mockMetadataResponse),
          stderr: '',
        });

      const result = await provider.getMetadata('https://www.youtube.com/watch?v=test123');

      expect(result.id).toBe('test123');
      expect(mockExecFile).toHaveBeenCalledTimes(2);
    });

    it('should detect "please sign in" pattern', async () => {
      process.env.YT_DLP_PROXY = 'http://proxy.example.com:8080';
      const provider = new YouTubeProvider();

      const error = new Error('Please sign in to continue');

      mockExecFile
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          stdout: JSON.stringify(mockMetadataResponse),
          stderr: '',
        });

      const result = await provider.getMetadata('https://www.youtube.com/watch?v=test123');

      expect(result.id).toBe('test123');
      expect(mockExecFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('IP block detected, no proxy configured', () => {
    it('should throw error immediately when no proxy is configured', async () => {
      delete process.env.YT_DLP_PROXY;
      const provider = new YouTubeProvider();

      const ipBlockError = new Error("Sign in to confirm you're not a bot");

      mockExecFile.mockRejectedValueOnce(ipBlockError);

      await expect(
        provider.getMetadata('https://www.youtube.com/watch?v=test123')
      ).rejects.toThrow("Sign in to confirm you're not a bot");

      expect(mockExecFile).toHaveBeenCalledTimes(1);
    });

    it('should throw error when proxy URL is invalid', async () => {
      process.env.YT_DLP_PROXY = 'not-a-valid-url';
      const provider = new YouTubeProvider();

      const ipBlockError = new Error('HTTP Error 403: Forbidden');

      mockExecFile.mockRejectedValueOnce(ipBlockError);

      await expect(
        provider.getMetadata('https://www.youtube.com/watch?v=test123')
      ).rejects.toThrow('HTTP Error 403: Forbidden');

      // Should not retry because proxy is invalid
      expect(mockExecFile).toHaveBeenCalledTimes(1);
    });

    it('should throw error when proxy URL is empty string', async () => {
      process.env.YT_DLP_PROXY = '';
      const provider = new YouTubeProvider();

      const ipBlockError = new Error('HTTP Error 429: Too Many Requests');

      mockExecFile.mockRejectedValueOnce(ipBlockError);

      await expect(
        provider.getMetadata('https://www.youtube.com/watch?v=test123')
      ).rejects.toThrow('HTTP Error 429: Too Many Requests');

      expect(mockExecFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('IP block detected, proxy retry also fails', () => {
    it('should throw the proxy retry error when both attempts fail', async () => {
      process.env.YT_DLP_PROXY = 'http://proxy.example.com:8080';
      const provider = new YouTubeProvider();

      const ipBlockError = new Error("Sign in to confirm you're not a bot");
      const proxyError = new Error('Proxy connection failed');

      mockExecFile
        .mockRejectedValueOnce(ipBlockError)
        .mockRejectedValueOnce(proxyError);

      await expect(
        provider.getMetadata('https://www.youtube.com/watch?v=test123')
      ).rejects.toThrow('Proxy connection failed');

      expect(mockExecFile).toHaveBeenCalledTimes(2);
    });

    it('should throw when proxy retry also encounters IP block', async () => {
      process.env.YT_DLP_PROXY = 'http://proxy.example.com:8080';
      const provider = new YouTubeProvider();

      const ipBlockError = new Error('HTTP Error 403: Forbidden');

      mockExecFile
        .mockRejectedValueOnce(ipBlockError)
        .mockRejectedValueOnce(ipBlockError);

      await expect(
        provider.getMetadata('https://www.youtube.com/watch?v=test123')
      ).rejects.toThrow('HTTP Error 403: Forbidden');

      expect(mockExecFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('Non-IP-block error, proxy configured', () => {
    it('should not retry for "Video unavailable" error', async () => {
      process.env.YT_DLP_PROXY = 'http://proxy.example.com:8080';
      const provider = new YouTubeProvider();

      const videoError = new Error('Video unavailable');

      mockExecFile.mockRejectedValueOnce(videoError);

      await expect(
        provider.getMetadata('https://www.youtube.com/watch?v=test123')
      ).rejects.toThrow('비공개 또는 삭제된 영상입니다.');

      // Should not retry - only called once
      expect(mockExecFile).toHaveBeenCalledTimes(1);
    });

    it('should not retry for "Private video" error', async () => {
      process.env.YT_DLP_PROXY = 'http://proxy.example.com:8080';
      const provider = new YouTubeProvider();

      const privateError = new Error('Private video');

      mockExecFile.mockRejectedValueOnce(privateError);

      await expect(
        provider.getMetadata('https://www.youtube.com/watch?v=test123')
      ).rejects.toThrow('비공개 또는 삭제된 영상입니다.');

      expect(mockExecFile).toHaveBeenCalledTimes(1);
    });

    it('should not retry for network timeout error', async () => {
      process.env.YT_DLP_PROXY = 'http://proxy.example.com:8080';
      const provider = new YouTubeProvider();

      const timeoutError = new Error('Network timeout');

      mockExecFile.mockRejectedValueOnce(timeoutError);

      await expect(
        provider.getMetadata('https://www.youtube.com/watch?v=test123')
      ).rejects.toThrow('Network timeout');

      expect(mockExecFile).toHaveBeenCalledTimes(1);
    });

    it('should not retry for HTTP 404 error', async () => {
      process.env.YT_DLP_PROXY = 'http://proxy.example.com:8080';
      const provider = new YouTubeProvider();

      const notFoundError = new Error('HTTP Error 404: Not Found');

      mockExecFile.mockRejectedValueOnce(notFoundError);

      await expect(
        provider.getMetadata('https://www.youtube.com/watch?v=test123')
      ).rejects.toThrow('HTTP Error 404: Not Found');

      expect(mockExecFile).toHaveBeenCalledTimes(1);
    });

    it('should not retry for "command not found" error', async () => {
      process.env.YT_DLP_PROXY = 'http://proxy.example.com:8080';
      const provider = new YouTubeProvider();

      const commandError = new Error('command not found: yt-dlp');

      mockExecFile.mockRejectedValueOnce(commandError);

      await expect(
        provider.getMetadata('https://www.youtube.com/watch?v=test123')
      ).rejects.toThrow('command not found: yt-dlp');

      expect(mockExecFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('Proxy args verification', () => {
    it('should pass correct proxy args format in retry', async () => {
      process.env.YT_DLP_PROXY = 'http://proxy.example.com:8080';
      const provider = new YouTubeProvider();

      const ipBlockError = new Error('HTTP Error 403: Forbidden');

      mockExecFile
        .mockRejectedValueOnce(ipBlockError)
        .mockResolvedValueOnce({
          stdout: JSON.stringify(mockMetadataResponse),
          stderr: '',
        });

      await provider.getMetadata('https://www.youtube.com/watch?v=test123');

      const secondCallArgs = mockExecFile.mock.calls[1][1] as string[];

      // Find the proxy flag and verify the next arg is the URL
      const proxyIndex = secondCallArgs.indexOf('--proxy');
      expect(proxyIndex).toBeGreaterThanOrEqual(0);
      expect(secondCallArgs[proxyIndex + 1]).toBe('http://proxy.example.com:8080');
    });

    it('should support socks5 proxy URLs', async () => {
      process.env.YT_DLP_PROXY = 'socks5://proxy.example.com:1080';
      const provider = new YouTubeProvider();

      const ipBlockError = new Error("Sign in to confirm you're not a bot");

      mockExecFile
        .mockRejectedValueOnce(ipBlockError)
        .mockResolvedValueOnce({
          stdout: JSON.stringify(mockMetadataResponse),
          stderr: '',
        });

      await provider.getMetadata('https://www.youtube.com/watch?v=test123');

      const secondCallArgs = mockExecFile.mock.calls[1][1] as string[];
      expect(secondCallArgs).toContain('--proxy');
      expect(secondCallArgs).toContain('socks5://proxy.example.com:1080');
    });

    it('should support proxy with authentication', async () => {
      process.env.YT_DLP_PROXY = 'http://user:pass@proxy.example.com:8080';
      const provider = new YouTubeProvider();

      const ipBlockError = new Error('HTTP Error 403: Forbidden');

      mockExecFile
        .mockRejectedValueOnce(ipBlockError)
        .mockResolvedValueOnce({
          stdout: JSON.stringify(mockMetadataResponse),
          stderr: '',
        });

      await provider.getMetadata('https://www.youtube.com/watch?v=test123');

      const secondCallArgs = mockExecFile.mock.calls[1][1] as string[];
      expect(secondCallArgs).toContain('--proxy');
      expect(secondCallArgs).toContain('http://user:pass@proxy.example.com:8080');
    });
  });

  describe('Proxy fallback in other methods', () => {
    it('should work for getPlaylistVideos', async () => {
      process.env.YT_DLP_PROXY = 'http://proxy.example.com:8080';
      const provider = new YouTubeProvider();

      const ipBlockError = new Error("Sign in to confirm you're not a bot");
      const playlistData = JSON.stringify({ id: 'video1' });

      mockExecFile
        .mockRejectedValueOnce(ipBlockError) // flat-playlist fails
        .mockResolvedValueOnce({ stdout: playlistData, stderr: '' }) // retry succeeds
        .mockResolvedValueOnce({
          stdout: JSON.stringify({ id: 'video1', title: 'Video 1' }),
          stderr: '',
        }); // getMetadata for video1

      const result = await provider.getPlaylistVideos(
        'https://www.youtube.com/playlist?list=PLtest'
      );

      expect(result).toHaveLength(1);
      expect(mockExecFile).toHaveBeenCalledTimes(3);

      // Second call should have proxy
      const secondCallArgs = mockExecFile.mock.calls[1][1] as string[];
      expect(secondCallArgs).toContain('--proxy');
    });

    it('should work for getCaptions', async () => {
      process.env.YT_DLP_PROXY = 'http://proxy.example.com:8080';
      const provider = new YouTubeProvider();

      const ipBlockError = new Error('HTTP Error 403: Forbidden');

      mockExecFile
        .mockRejectedValueOnce(ipBlockError)
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      mockReaddir.mockResolvedValueOnce([]);

      const result = await provider.getCaptions('test123', 'en');

      expect(result).toEqual([]);
      expect(mockExecFile).toHaveBeenCalledTimes(2);

      const secondCallArgs = mockExecFile.mock.calls[1][1] as string[];
      expect(secondCallArgs).toContain('--proxy');
    });

    it('should work for downloadAudio', async () => {
      process.env.YT_DLP_PROXY = 'http://proxy.example.com:8080';
      const provider = new YouTubeProvider();

      const ipBlockError = new Error('HTTP Error 429: Too Many Requests');

      mockExecFile
        .mockRejectedValueOnce(ipBlockError)
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await provider.downloadAudio('test123', '/tmp/output');

      expect(result).toBe('/tmp/output/test123.mp3');
      expect(mockExecFile).toHaveBeenCalledTimes(2);

      const secondCallArgs = mockExecFile.mock.calls[1][1] as string[];
      expect(secondCallArgs).toContain('--proxy');
    });

    it('should work for downloadVideo', async () => {
      process.env.YT_DLP_PROXY = 'http://proxy.example.com:8080';
      const provider = new YouTubeProvider();

      const ipBlockError = new Error("Sign in to confirm you're not a bot");

      mockExecFile
        .mockRejectedValueOnce(ipBlockError)
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await provider.downloadVideo('test123', '/tmp/output');

      expect(result).toBe('/tmp/output/test123.mp4');
      expect(mockExecFile).toHaveBeenCalledTimes(2);

      const secondCallArgs = mockExecFile.mock.calls[1][1] as string[];
      expect(secondCallArgs).toContain('--proxy');
    });
  });

  describe('Edge cases', () => {
    it('should handle error with both message and stderr containing IP block pattern', async () => {
      process.env.YT_DLP_PROXY = 'http://proxy.example.com:8080';
      const provider = new YouTubeProvider();

      const error = new Error("Sign in to confirm you're not a bot");
      (error as any).stderr = 'Additional stderr: HTTP Error 403: Forbidden';

      mockExecFile
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          stdout: JSON.stringify(mockMetadataResponse),
          stderr: '',
        });

      const result = await provider.getMetadata('https://www.youtube.com/watch?v=test123');

      expect(result.id).toBe('test123');
      expect(mockExecFile).toHaveBeenCalledTimes(2);
    });

    it('should handle error with empty stderr', async () => {
      process.env.YT_DLP_PROXY = 'http://proxy.example.com:8080';
      const provider = new YouTubeProvider();

      const error = new Error('HTTP Error 403: Forbidden');
      (error as any).stderr = '';

      mockExecFile
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          stdout: JSON.stringify(mockMetadataResponse),
          stderr: '',
        });

      const result = await provider.getMetadata('https://www.youtube.com/watch?v=test123');

      expect(result.id).toBe('test123');
      expect(mockExecFile).toHaveBeenCalledTimes(2);
    });

    it('should handle error with undefined stderr', async () => {
      process.env.YT_DLP_PROXY = 'http://proxy.example.com:8080';
      const provider = new YouTubeProvider();

      const error = new Error('HTTP Error 429: Too Many Requests');
      // stderr is undefined

      mockExecFile
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          stdout: JSON.stringify(mockMetadataResponse),
          stderr: '',
        });

      const result = await provider.getMetadata('https://www.youtube.com/watch?v=test123');

      expect(result.id).toBe('test123');
      expect(mockExecFile).toHaveBeenCalledTimes(2);
    });

    it('should handle Buffer stdout in successful response', async () => {
      process.env.YT_DLP_PROXY = 'http://proxy.example.com:8080';
      const provider = new YouTubeProvider();

      const ipBlockError = new Error('HTTP Error 403: Forbidden');

      mockExecFile
        .mockRejectedValueOnce(ipBlockError)
        .mockResolvedValueOnce({
          stdout: Buffer.from(JSON.stringify(mockMetadataResponse)),
          stderr: '',
        });

      const result = await provider.getMetadata('https://www.youtube.com/watch?v=test123');

      expect(result.id).toBe('test123');
      expect(mockExecFile).toHaveBeenCalledTimes(2);
    });

    it('should handle trimmed proxy URL with spaces', async () => {
      process.env.YT_DLP_PROXY = '  http://proxy.example.com:8080  ';
      const provider = new YouTubeProvider();

      const ipBlockError = new Error("Sign in to confirm you're not a bot");

      mockExecFile
        .mockRejectedValueOnce(ipBlockError)
        .mockResolvedValueOnce({
          stdout: JSON.stringify(mockMetadataResponse),
          stderr: '',
        });

      await provider.getMetadata('https://www.youtube.com/watch?v=test123');

      const secondCallArgs = mockExecFile.mock.calls[1][1] as string[];
      expect(secondCallArgs).toContain('http://proxy.example.com:8080');
    });
  });
});
