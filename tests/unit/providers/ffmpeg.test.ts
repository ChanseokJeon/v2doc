/**
 * FFmpeg Wrapper 테스트
 */

// Mock child_process before imports
const mockExecFileAsync = jest.fn();
jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));

jest.mock('util', () => ({
  promisify: () => mockExecFileAsync,
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

import { FFmpegWrapper } from '../../../src/providers/ffmpeg';
import { ErrorCode } from '../../../src/types/index';

describe('FFmpegWrapper', () => {
  let wrapper: FFmpegWrapper;

  beforeEach(() => {
    jest.clearAllMocks();
    wrapper = new FFmpegWrapper();
  });

  describe('constructor', () => {
    it('should create instance with default ffmpeg path', () => {
      const w = new FFmpegWrapper();
      expect(w).toBeInstanceOf(FFmpegWrapper);
    });

    it('should create instance with custom ffmpeg path', () => {
      const w = new FFmpegWrapper('/custom/ffmpeg');
      expect(w).toBeInstanceOf(FFmpegWrapper);
    });

    it('should use environment variable for ffmpeg path', () => {
      process.env.FFMPEG_PATH = '/env/ffmpeg';
      const w = new FFmpegWrapper();
      expect(w).toBeInstanceOf(FFmpegWrapper);
      delete process.env.FFMPEG_PATH;
    });
  });

  describe('checkInstallation', () => {
    it('should return true when ffmpeg is installed', async () => {
      mockExecFileAsync.mockResolvedValueOnce({ stdout: 'ffmpeg version 6.0' });
      const result = await FFmpegWrapper.checkInstallation();
      expect(result).toBe(true);
    });

    it('should return false when ffmpeg is not installed', async () => {
      mockExecFileAsync.mockRejectedValueOnce(new Error('command not found'));
      const result = await FFmpegWrapper.checkInstallation();
      expect(result).toBe(false);
    });
  });

  describe('captureFrame', () => {
    it('should capture frame with default settings', async () => {
      mockExecFileAsync.mockResolvedValueOnce({ stdout: '' });

      await wrapper.captureFrame('/video.mp4', 60, '/output/frame.jpg');

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        'ffmpeg',
        expect.arrayContaining(['-ss', '00:01:00.000'])
      );
    });

    it('should capture frame with low quality', async () => {
      mockExecFileAsync.mockResolvedValueOnce({ stdout: '' });

      await wrapper.captureFrame('/video.mp4', 30, '/output/frame.jpg', 'low');

      const call = mockExecFileAsync.mock.calls[0];
      expect(call[1]).toEqual(
        expect.arrayContaining(['-vf', expect.stringContaining('scale=854:480')])
      );
    });

    it('should capture frame with medium quality', async () => {
      mockExecFileAsync.mockResolvedValueOnce({ stdout: '' });

      await wrapper.captureFrame('/video.mp4', 30, '/output/frame.jpg', 'medium');

      const call = mockExecFileAsync.mock.calls[0];
      expect(call[1]).toEqual(
        expect.arrayContaining(['-vf', expect.stringContaining('scale=1280:720')])
      );
    });

    it('should capture frame with high quality', async () => {
      mockExecFileAsync.mockResolvedValueOnce({ stdout: '' });

      await wrapper.captureFrame('/video.mp4', 30, '/output/frame.jpg', 'high');

      const call = mockExecFileAsync.mock.calls[0];
      expect(call[1]).toEqual(
        expect.arrayContaining(['-vf', expect.stringContaining('scale=1920:1080')])
      );
    });

    it('should include timestamp overlay by default', async () => {
      mockExecFileAsync.mockResolvedValueOnce({ stdout: '' });

      await wrapper.captureFrame('/video.mp4', 65, '/output/frame.jpg');

      const call = mockExecFileAsync.mock.calls[0];
      const vfArg = call[1].find((arg: string) => arg.includes('drawtext'));
      expect(vfArg).toBeDefined();
      expect(vfArg).toContain('01\\:05'); // Escaped colon
    });

    it('should not include timestamp overlay when disabled', async () => {
      mockExecFileAsync.mockResolvedValueOnce({ stdout: '' });

      await wrapper.captureFrame('/video.mp4', 60, '/output/frame.jpg', 'low', false);

      const call = mockExecFileAsync.mock.calls[0];
      const vfArg = call[1].find((arg: string) => arg.includes('drawtext'));
      expect(vfArg).toBeUndefined();
    });

    it('should format hour timestamp correctly', async () => {
      mockExecFileAsync.mockResolvedValueOnce({ stdout: '' });

      // 1 hour 23 minutes 45 seconds
      await wrapper.captureFrame('/video.mp4', 5025, '/output/frame.jpg');

      const call = mockExecFileAsync.mock.calls[0];
      const vfArg = call[1].find((arg: string) => arg.includes('1\\:23\\:45'));
      expect(vfArg).toBeDefined();
    });

    it('should throw error on capture failure', async () => {
      mockExecFileAsync.mockRejectedValueOnce(new Error('FFmpeg error'));

      await expect(
        wrapper.captureFrame('/video.mp4', 60, '/output/frame.jpg')
      ).rejects.toMatchObject({
        code: ErrorCode.SCREENSHOT_FAILED,
      });
    });
  });

  describe('captureFrames', () => {
    it('should capture multiple frames', async () => {
      mockExecFileAsync
        .mockResolvedValueOnce({ stdout: '' })
        .mockResolvedValueOnce({ stdout: '' })
        .mockResolvedValueOnce({ stdout: '' });

      const timestamps = [0, 60, 120];
      const result = await wrapper.captureFrames('/video.mp4', timestamps, '/output');

      expect(result).toHaveLength(3);
      expect(result[0]).toBe('/output/screenshot_0000.jpg');
      expect(result[1]).toBe('/output/screenshot_0001.jpg');
      expect(result[2]).toBe('/output/screenshot_0002.jpg');
    });

    it('should use specified quality', async () => {
      mockExecFileAsync.mockResolvedValueOnce({ stdout: '' });

      await wrapper.captureFrames('/video.mp4', [0], '/output', 'high');

      const call = mockExecFileAsync.mock.calls[0];
      expect(call[1]).toEqual(
        expect.arrayContaining(['-vf', expect.stringContaining('1920:1080')])
      );
    });

    it('should return empty array for empty timestamps', async () => {
      const result = await wrapper.captureFrames('/video.mp4', [], '/output');
      expect(result).toHaveLength(0);
    });
  });

  describe('extractAudio', () => {
    it('should extract audio to mp3', async () => {
      mockExecFileAsync.mockResolvedValueOnce({ stdout: '' });

      await wrapper.extractAudio('/video.mp4', '/output/audio.mp3');

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        'ffmpeg',
        expect.arrayContaining(['-acodec', 'libmp3lame'])
      );
    });

    it('should throw error on extraction failure', async () => {
      mockExecFileAsync.mockRejectedValueOnce(new Error('FFmpeg error'));

      await expect(
        wrapper.extractAudio('/video.mp4', '/output/audio.mp3')
      ).rejects.toMatchObject({
        code: ErrorCode.VIDEO_DOWNLOAD_FAILED,
      });
    });
  });

  describe('getVideoInfo', () => {
    const mockVideoInfo = {
      format: {
        duration: '300.5',
      },
      streams: [
        {
          codec_type: 'video',
          width: 1920,
          height: 1080,
          r_frame_rate: '30/1',
        },
        {
          codec_type: 'audio',
        },
      ],
    };

    it('should get video info successfully', async () => {
      mockExecFileAsync.mockResolvedValueOnce({ stdout: JSON.stringify(mockVideoInfo) });

      const result = await wrapper.getVideoInfo('/video.mp4');

      expect(result.duration).toBe(300.5);
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
      expect(result.fps).toBe(30);
    });

    it('should handle fractional fps', async () => {
      const info = {
        ...mockVideoInfo,
        streams: [{ codec_type: 'video', width: 1920, height: 1080, r_frame_rate: '30000/1001' }],
      };
      mockExecFileAsync.mockResolvedValueOnce({ stdout: JSON.stringify(info) });

      const result = await wrapper.getVideoInfo('/video.mp4');

      expect(result.fps).toBeCloseTo(29.97, 1);
    });

    it('should handle missing duration', async () => {
      const info = {
        format: {},
        streams: [{ codec_type: 'video', width: 1920, height: 1080 }],
      };
      mockExecFileAsync.mockResolvedValueOnce({ stdout: JSON.stringify(info) });

      const result = await wrapper.getVideoInfo('/video.mp4');

      expect(result.duration).toBe(0);
    });

    it('should handle missing video stream', async () => {
      const info = {
        format: { duration: '100' },
        streams: [{ codec_type: 'audio' }],
      };
      mockExecFileAsync.mockResolvedValueOnce({ stdout: JSON.stringify(info) });

      const result = await wrapper.getVideoInfo('/video.mp4');

      expect(result.width).toBe(0);
      expect(result.height).toBe(0);
      expect(result.fps).toBe(30); // default
    });

    it('should handle missing fps', async () => {
      const info = {
        format: { duration: '100' },
        streams: [{ codec_type: 'video', width: 1920, height: 1080 }],
      };
      mockExecFileAsync.mockResolvedValueOnce({ stdout: JSON.stringify(info) });

      const result = await wrapper.getVideoInfo('/video.mp4');

      expect(result.fps).toBe(30); // default
    });

    it('should handle fps without denominator', async () => {
      const info = {
        format: { duration: '100' },
        streams: [{ codec_type: 'video', width: 1920, height: 1080, r_frame_rate: '25' }],
      };
      mockExecFileAsync.mockResolvedValueOnce({ stdout: JSON.stringify(info) });

      const result = await wrapper.getVideoInfo('/video.mp4');

      expect(result.fps).toBe(25);
    });

    it('should handle fps with zero denominator', async () => {
      const info = {
        format: { duration: '100' },
        streams: [{ codec_type: 'video', width: 1920, height: 1080, r_frame_rate: '30/0' }],
      };
      mockExecFileAsync.mockResolvedValueOnce({ stdout: JSON.stringify(info) });

      const result = await wrapper.getVideoInfo('/video.mp4');

      expect(result.fps).toBe(30);
    });

    it('should throw error on probe failure', async () => {
      mockExecFileAsync.mockRejectedValueOnce(new Error('FFprobe error'));

      await expect(wrapper.getVideoInfo('/video.mp4')).rejects.toMatchObject({
        code: ErrorCode.VIDEO_DOWNLOAD_FAILED,
      });
    });
  });

  describe('generateTimestamps', () => {
    it('should generate timestamps at regular intervals', () => {
      const result = wrapper.generateTimestamps(300, 60);

      expect(result).toEqual([0, 60, 120, 180, 240]);
    });

    it('should handle duration shorter than interval', () => {
      const result = wrapper.generateTimestamps(30, 60);

      expect(result).toEqual([0]);
    });

    it('should handle zero duration', () => {
      const result = wrapper.generateTimestamps(0, 60);

      expect(result).toEqual([]);
    });

    it('should handle small intervals', () => {
      const result = wrapper.generateTimestamps(10, 2);

      expect(result).toEqual([0, 2, 4, 6, 8]);
    });
  });
});
