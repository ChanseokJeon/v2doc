/**
 * YouTube Provider 테스트
 */

// Mock child_process before imports
const mockExecAsync = jest.fn();
jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

jest.mock('util', () => ({
  promisify: () => mockExecAsync,
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
  },
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

import { YouTubeProvider } from '../../../src/providers/youtube';
import { ErrorCode } from '../../../src/types/index';

describe('YouTubeProvider', () => {
  let provider: YouTubeProvider;

  beforeEach(() => {
    jest.resetAllMocks();
    mockExecAsync.mockReset();
    mockMkdir.mockReset().mockResolvedValue(undefined);
    mockReaddir.mockReset();
    mockReadFile.mockReset();
    mockRm.mockReset().mockResolvedValue(undefined);
    mockWriteFile.mockReset().mockResolvedValue(undefined);
    mockUnlink.mockReset().mockResolvedValue(undefined);
    mockRename.mockReset().mockResolvedValue(undefined);
    mockFetch.mockReset();
    provider = new YouTubeProvider();
  });

  describe('constructor', () => {
    it('should create instance with default yt-dlp path', () => {
      const p = new YouTubeProvider();
      expect(p).toBeInstanceOf(YouTubeProvider);
    });

    it('should create instance with custom yt-dlp path', () => {
      const p = new YouTubeProvider('/custom/path/yt-dlp');
      expect(p).toBeInstanceOf(YouTubeProvider);
    });

    it('should use environment variable for yt-dlp path', () => {
      process.env.YT_DLP_PATH = '/env/yt-dlp';
      const p = new YouTubeProvider();
      expect(p).toBeInstanceOf(YouTubeProvider);
      delete process.env.YT_DLP_PATH;
    });
  });

  describe('checkInstallation', () => {
    it('should return true when yt-dlp is installed', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '2023.11.16' });
      const result = await YouTubeProvider.checkInstallation();
      expect(result).toBe(true);
    });

    it('should return false when yt-dlp is not installed', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('command not found'));
      const result = await YouTubeProvider.checkInstallation();
      expect(result).toBe(false);
    });
  });

  describe('getMetadata', () => {
    const validMetadata = {
      id: 'dQw4w9WgXcQ',
      title: 'Test Video',
      description: 'Test Description',
      duration: 300,
      thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
      uploader: 'Test Channel',
      upload_date: '20231115',
      view_count: 1000000,
      subtitles: { en: [] },
      automatic_captions: { ko: [] },
      chapters: [
        { title: 'Intro', start_time: 0, end_time: 60 },
        { title: 'Main', start_time: 60, end_time: 240 },
      ],
    };

    it('should fetch video metadata successfully', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: JSON.stringify(validMetadata) });

      const result = await provider.getMetadata('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

      expect(result.id).toBe('dQw4w9WgXcQ');
      expect(result.title).toBe('Test Video');
      expect(result.duration).toBe(300);
      expect(result.channel).toBe('Test Channel');
      expect(result.availableCaptions).toHaveLength(2);
      expect(result.chapters).toHaveLength(2);
    });

    it('should throw error for invalid URL', async () => {
      await expect(provider.getMetadata('https://example.com/invalid')).rejects.toThrow();
    });

    it('should handle private video error', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('Video unavailable'));

      await expect(
        provider.getMetadata('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
      ).rejects.toMatchObject({
        code: ErrorCode.VIDEO_PRIVATE,
      });
    });

    it('should handle video not found error', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        provider.getMetadata('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
      ).rejects.toMatchObject({
        code: ErrorCode.VIDEO_NOT_FOUND,
      });
    });

    it('should handle metadata with missing fields', async () => {
      const minimalMetadata = {
        id: 'test123',
      };
      mockExecAsync.mockResolvedValueOnce({ stdout: JSON.stringify(minimalMetadata) });

      const result = await provider.getMetadata('https://www.youtube.com/watch?v=test1234567');

      expect(result.id).toBe('test123');
      expect(result.title).toBe('Untitled');
      expect(result.duration).toBe(0);
      expect(result.channel).toBe('Unknown');
    });

    it('should use channel field when uploader is not available', async () => {
      const metadata = {
        ...validMetadata,
        uploader: undefined,
        channel: 'Fallback Channel',
      };
      mockExecAsync.mockResolvedValueOnce({ stdout: JSON.stringify(metadata) });

      const result = await provider.getMetadata('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(result.channel).toBe('Fallback Channel');
    });

    it('should parse chapters with missing end_time', async () => {
      const metadata = {
        ...validMetadata,
        chapters: [
          { title: 'Chapter 1', start_time: 0 },
          { title: 'Chapter 2', start_time: 60 },
        ],
      };
      mockExecAsync.mockResolvedValueOnce({ stdout: JSON.stringify(metadata) });

      const result = await provider.getMetadata('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(result.chapters).toHaveLength(2);
      expect(result.chapters![0].endTime).toBe(60);
      expect(result.chapters![1].endTime).toBe(300); // uses duration
    });

    it('should handle chapters with no end_time and no duration', async () => {
      const metadata = {
        id: 'test',
        title: 'Test',
        chapters: [{ title: 'Solo', start_time: 0 }],
      };
      mockExecAsync.mockResolvedValueOnce({ stdout: JSON.stringify(metadata) });

      const result = await provider.getMetadata('https://www.youtube.com/watch?v=test1234567');
      expect(result.chapters![0].endTime).toBe(60); // fallback 60 seconds
    });

    it('should return empty chapters when none exist', async () => {
      const metadata = { ...validMetadata, chapters: undefined };
      mockExecAsync.mockResolvedValueOnce({ stdout: JSON.stringify(metadata) });

      const result = await provider.getMetadata('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(result.chapters).toBeUndefined();
    });

    it('should filter duplicate captions between manual and auto', async () => {
      const metadata = {
        ...validMetadata,
        subtitles: { en: [] },
        automatic_captions: { en: [], ko: [] },
      };
      mockExecAsync.mockResolvedValueOnce({ stdout: JSON.stringify(metadata) });

      const result = await provider.getMetadata('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      // Should have en (manual), ko (auto) - en auto is filtered out
      expect(result.availableCaptions).toHaveLength(2);
      expect(result.availableCaptions.find((c) => c.languageCode === 'en')?.isAutoGenerated).toBe(
        false
      );
    });
  });

  describe('getPlaylistVideos', () => {
    it('should fetch playlist videos', async () => {
      // First call: flat playlist
      const playlistOutput = [{ id: 'dQw4w9WgXcQ' }, { id: 'jNQXAC9IVRw' }]
        .map((v) => JSON.stringify(v))
        .join('\n');

      mockExecAsync
        .mockResolvedValueOnce({ stdout: playlistOutput })
        // Second call: getMetadata for video1 (uses buildVideoUrl which creates youtube.com URL)
        .mockResolvedValueOnce({
          stdout: JSON.stringify({ id: 'dQw4w9WgXcQ', title: 'Video 1', duration: 100 }),
        })
        // Third call: getMetadata for video2
        .mockResolvedValueOnce({
          stdout: JSON.stringify({ id: 'jNQXAC9IVRw', title: 'Video 2', duration: 200 }),
        });

      const result = await provider.getPlaylistVideos(
        'https://www.youtube.com/playlist?list=PLtest'
      );

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Video 1');
      expect(result[1].title).toBe('Video 2');
    });

    it('should throw error for empty playlist', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '' });

      await expect(
        provider.getPlaylistVideos('https://www.youtube.com/playlist?list=PLempty')
      ).rejects.toMatchObject({
        code: ErrorCode.PLAYLIST_EMPTY,
      });
    });

    it('should handle failed individual video fetches', async () => {
      const playlistOutput = [{ id: 'dQw4w9WgXcQ' }, { id: 'jNQXAC9IVRw' }]
        .map((v) => JSON.stringify(v))
        .join('\n');

      mockExecAsync
        .mockResolvedValueOnce({ stdout: playlistOutput })
        .mockResolvedValueOnce({
          stdout: JSON.stringify({ id: 'dQw4w9WgXcQ', title: 'Video 1', duration: 100 }),
        })
        .mockRejectedValueOnce(new Error('Video unavailable'));

      const result = await provider.getPlaylistVideos(
        'https://www.youtube.com/playlist?list=PLtest'
      );

      expect(result).toHaveLength(1);
    });

    it('should handle playlist fetch error', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        provider.getPlaylistVideos('https://www.youtube.com/playlist?list=PLtest')
      ).rejects.toMatchObject({
        code: ErrorCode.PLAYLIST_EMPTY,
      });
    });

    it('should rethrow Yt2PdfError', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '' }); // Empty playlist

      await expect(
        provider.getPlaylistVideos('https://www.youtube.com/playlist?list=PLtest')
      ).rejects.toMatchObject({
        code: ErrorCode.PLAYLIST_EMPTY,
      });
    });
  });

  describe('getCaptions', () => {
    const vttContent = `WEBVTT

00:00:00.000 --> 00:00:05.000
Hello world

00:00:05.000 --> 00:00:10.000
This is a test`;

    it('should download and parse VTT captions', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '' });
      mockReaddir.mockResolvedValueOnce(['video.en.vtt']);
      mockReadFile.mockResolvedValueOnce(vttContent);

      const result = await provider.getCaptions('dQw4w9WgXcQ', 'en');

      expect(result).toHaveLength(2);
      expect(result[0].text).toBe('Hello world');
      expect(result[0].start).toBe(0);
      expect(result[0].end).toBe(5);
    });

    it('should return empty array when no VTT file found', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '' });
      mockReaddir.mockResolvedValueOnce(['video.mp4']);

      const result = await provider.getCaptions('dQw4w9WgXcQ', 'en');
      expect(result).toHaveLength(0);
    });

    it('should return empty array on download error', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('Download failed'));

      const result = await provider.getCaptions('dQw4w9WgXcQ', 'en');
      expect(result).toHaveLength(0);
    });

    it('should parse VTT with timestamp format HH:MM:SS.mmm', async () => {
      const vtt = `WEBVTT

01:02:03.456 --> 01:02:08.789
Long video caption`;

      mockExecAsync.mockResolvedValueOnce({ stdout: '' });
      mockReaddir.mockResolvedValueOnce(['video.vtt']);
      mockReadFile.mockResolvedValueOnce(vtt);

      const result = await provider.getCaptions('test', 'en');

      expect(result[0].start).toBe(3723.456);
      expect(result[0].end).toBe(3728.789);
    });

    it('should parse VTT with timestamp format MM:SS.mmm', async () => {
      const vtt = `WEBVTT

02:30.000 --> 02:35.500
Short format`;

      mockExecAsync.mockResolvedValueOnce({ stdout: '' });
      mockReaddir.mockResolvedValueOnce(['video.vtt']);
      mockReadFile.mockResolvedValueOnce(vtt);

      const result = await provider.getCaptions('test', 'en');

      expect(result[0].start).toBe(150);
      expect(result[0].end).toBe(155.5);
    });

    it('should strip VTT tags from text', async () => {
      const vtt = `WEBVTT

00:00:00.000 --> 00:00:05.000
<c.colorWhite>Hello</c> <b>world</b>`;

      mockExecAsync.mockResolvedValueOnce({ stdout: '' });
      mockReaddir.mockResolvedValueOnce(['video.vtt']);
      mockReadFile.mockResolvedValueOnce(vtt);

      const result = await provider.getCaptions('test', 'en');

      expect(result[0].text).toBe('Hello world');
    });

    it('should handle multi-line captions', async () => {
      const vtt = `WEBVTT

00:00:00.000 --> 00:00:05.000
Line one
Line two`;

      mockExecAsync.mockResolvedValueOnce({ stdout: '' });
      mockReaddir.mockResolvedValueOnce(['video.vtt']);
      mockReadFile.mockResolvedValueOnce(vtt);

      const result = await provider.getCaptions('test', 'en');

      expect(result[0].text).toBe('Line one Line two');
    });

    it('should replace &nbsp; with space', async () => {
      const vtt = `WEBVTT

00:00:00.000 --> 00:00:05.000
Hello&nbsp;world`;

      mockExecAsync.mockResolvedValueOnce({ stdout: '' });
      mockReaddir.mockResolvedValueOnce(['video.vtt']);
      mockReadFile.mockResolvedValueOnce(vtt);

      const result = await provider.getCaptions('test', 'en');

      expect(result[0].text).toBe('Hello world');
    });
  });

  describe('downloadAudio', () => {
    it('should download audio successfully', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '' });

      const result = await provider.downloadAudio('dQw4w9WgXcQ', '/tmp/output');

      expect(result).toBe('/tmp/output/dQw4w9WgXcQ.mp3');
    });

    it('should throw error on download failure', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('Download failed'));

      await expect(provider.downloadAudio('dQw4w9WgXcQ', '/tmp/output')).rejects.toMatchObject({
        code: ErrorCode.VIDEO_DOWNLOAD_FAILED,
      });
    });
  });

  describe('downloadVideo', () => {
    it('should download video with default format', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '' });

      const result = await provider.downloadVideo('dQw4w9WgXcQ', '/tmp/output');

      expect(result).toBe('/tmp/output/dQw4w9WgXcQ.mp4');
    });

    it('should download video with custom format', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '' });

      const result = await provider.downloadVideo('dQw4w9WgXcQ', '/tmp/output', 'best');

      expect(result).toBe('/tmp/output/dQw4w9WgXcQ.mp4');
    });

    it('should throw error on download failure', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('Download failed'));

      await expect(provider.downloadVideo('dQw4w9WgXcQ', '/tmp/output')).rejects.toMatchObject({
        code: ErrorCode.VIDEO_DOWNLOAD_FAILED,
      });
    });
  });

  describe('downloadThumbnail', () => {
    it('should download and convert thumbnail', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
      });
      mockExecAsync.mockResolvedValueOnce({ stdout: '' }); // ffmpeg conversion

      const result = await provider.downloadThumbnail(
        'https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg',
        '/tmp/thumb.jpg'
      );

      expect(result).toBe('/tmp/thumb.jpg');
    });

    it('should try higher quality thumbnail first', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
      });
      mockExecAsync.mockResolvedValueOnce({ stdout: '' });

      await provider.downloadThumbnail(
        'https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg',
        '/tmp/thumb.jpg'
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'
      );
    });

    it('should fallback to original URL if maxres fails', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
        });
      mockExecAsync.mockResolvedValueOnce({ stdout: '' });

      await provider.downloadThumbnail(
        'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        '/tmp/thumb.jpg'
      );

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should use original file if ffmpeg conversion fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
      });
      mockExecAsync.mockRejectedValueOnce(new Error('FFmpeg error'));

      const result = await provider.downloadThumbnail(
        'https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg',
        '/tmp/thumb.jpg'
      );

      expect(result).toBe('/tmp/thumb.jpg');
      expect(mockRename).toHaveBeenCalled();
    });

    it('should throw error if download fails', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: false, status: 404 });

      await expect(
        provider.downloadThumbnail(
          'https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg',
          '/tmp/thumb.jpg'
        )
      ).rejects.toMatchObject({
        code: ErrorCode.VIDEO_DOWNLOAD_FAILED,
      });
    });

    it('should handle non-youtube thumbnail URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
      });
      mockExecAsync.mockResolvedValueOnce({ stdout: '' });

      await provider.downloadThumbnail('https://example.com/thumb.jpg', '/tmp/thumb.jpg');

      expect(mockFetch).toHaveBeenCalledWith('https://example.com/thumb.jpg');
    });
  });
});
