/**
 * MetadataStage unit tests
 */

// ============================================================
// jest.mock() calls MUST come before imports
// ============================================================

const mockGetMetadata = jest.fn();
jest.mock('../../../../../src/providers/youtube.js', () => ({
  YouTubeProvider: jest.fn().mockImplementation(() => ({
    getMetadata: mockGetMetadata,
  })),
}));

const mockLoggerWarn = jest.fn();
const mockLoggerInfo = jest.fn();
jest.mock('../../../../../src/utils/logger.js', () => ({
  logger: {
    warn: mockLoggerWarn,
    info: mockLoggerInfo,
  },
}));

const mockBuildVideoUrl = jest.fn();
jest.mock('../../../../../src/utils/url.js', () => ({
  buildVideoUrl: mockBuildVideoUrl,
}));

// ============================================================
// Imports
// ============================================================

import { MetadataStage } from '../../../../../src/core/pipeline/stages/metadata-stage.js';
import { PipelineContext } from '../../../../../src/core/pipeline/types.js';
import { ConfigSchema } from '../../../../../src/types/config.js';
import { YouTubeProvider } from '../../../../../src/providers/youtube.js';

describe('MetadataStage', () => {
  let stage: MetadataStage;
  let mockContext: Partial<PipelineContext>;
  let mockYouTube: YouTubeProvider;

  beforeEach(() => {
    jest.clearAllMocks();

    stage = new MetadataStage();
    mockYouTube = new YouTubeProvider({} as any);

    const defaultConfig = ConfigSchema.parse({});

    mockContext = {
      videoId: 'test-video-id',
      config: defaultConfig,
      youtube: mockYouTube,
      onProgress: jest.fn(),
      traceEnabled: false,
      traceSteps: [],
    };

    mockBuildVideoUrl.mockReturnValue('https://www.youtube.com/watch?v=test-video-id');
  });

  describe('name property', () => {
    it('should be "metadata"', () => {
      expect(stage.name).toBe('metadata');
    });
  });

  describe('execute()', () => {
    it('should fetch metadata and set context.metadata and context.chapters', async () => {
      const mockMetadata = {
        videoId: 'test-video-id',
        title: 'Test Video',
        duration: 600,
        chapters: [
          { title: 'Chapter 1', timestamp: 0 },
          { title: 'Chapter 2', timestamp: 300 },
        ],
      };

      mockGetMetadata.mockResolvedValue(mockMetadata);

      await stage.execute(mockContext as PipelineContext);

      expect(mockContext.metadata).toEqual(mockMetadata);
      expect(mockContext.chapters).toEqual(mockMetadata.chapters);
    });

    it('should call onProgress with correct status', async () => {
      const mockMetadata = {
        videoId: 'test-video-id',
        title: 'Test Video',
        duration: 600,
      };

      mockGetMetadata.mockResolvedValue(mockMetadata);

      await stage.execute(mockContext as PipelineContext);

      expect(mockContext.onProgress).toHaveBeenCalledWith({
        status: 'fetching',
        currentStep: '영상 정보 가져오기',
        progress: 5,
      });
    });

    it('should call buildVideoUrl with correct videoId', async () => {
      const mockMetadata = {
        videoId: 'test-video-id',
        title: 'Test Video',
        duration: 600,
      };

      mockGetMetadata.mockResolvedValue(mockMetadata);

      await stage.execute(mockContext as PipelineContext);

      expect(mockBuildVideoUrl).toHaveBeenCalledWith('test-video-id');
      expect(mockGetMetadata).toHaveBeenCalledWith('https://www.youtube.com/watch?v=test-video-id');
    });

    it('should warn when duration exceeds maxDuration', async () => {
      const mockMetadata = {
        videoId: 'test-video-id',
        title: 'Long Video',
        duration: 8000, // > default maxDuration (7200)
      };

      mockGetMetadata.mockResolvedValue(mockMetadata);

      await stage.execute(mockContext as PipelineContext);

      expect(mockLoggerWarn).toHaveBeenCalledWith(
        `영상 길이(8000초)가 제한(7200초)을 초과합니다.`
      );
    });

    it('should not warn when duration is within maxDuration', async () => {
      const mockMetadata = {
        videoId: 'test-video-id',
        title: 'Normal Video',
        duration: 600,
      };

      mockGetMetadata.mockResolvedValue(mockMetadata);

      await stage.execute(mockContext as PipelineContext);

      expect(mockLoggerWarn).not.toHaveBeenCalled();
    });

    it('should use YouTube chapters when useYouTubeChapters is true and chapters exist', async () => {
      const mockMetadata = {
        videoId: 'test-video-id',
        title: 'Test Video',
        duration: 600,
        chapters: [
          { title: 'Chapter 1', timestamp: 0 },
          { title: 'Chapter 2', timestamp: 300 },
        ],
      };

      mockGetMetadata.mockResolvedValue(mockMetadata);

      // Ensure config has useYouTubeChapters = true (default)
      mockContext.config!.chapter.useYouTubeChapters = true;

      await stage.execute(mockContext as PipelineContext);

      expect(mockContext.chapters).toEqual(mockMetadata.chapters);
      expect(mockLoggerInfo).toHaveBeenCalledWith(`YouTube 챕터 발견: 2개`);
    });

    it('should return empty chapters when useYouTubeChapters is false', async () => {
      const mockMetadata = {
        videoId: 'test-video-id',
        title: 'Test Video',
        duration: 600,
        chapters: [
          { title: 'Chapter 1', timestamp: 0 },
          { title: 'Chapter 2', timestamp: 300 },
        ],
      };

      mockGetMetadata.mockResolvedValue(mockMetadata);

      mockContext.config!.chapter.useYouTubeChapters = false;

      await stage.execute(mockContext as PipelineContext);

      expect(mockContext.chapters).toEqual([]);
      expect(mockLoggerInfo).not.toHaveBeenCalled();
    });

    it('should return empty chapters when no chapters exist in metadata', async () => {
      const mockMetadata = {
        videoId: 'test-video-id',
        title: 'Test Video',
        duration: 600,
        // No chapters field
      };

      mockGetMetadata.mockResolvedValue(mockMetadata);

      mockContext.config!.chapter.useYouTubeChapters = true;

      await stage.execute(mockContext as PipelineContext);

      expect(mockContext.chapters).toEqual([]);
      expect(mockLoggerInfo).not.toHaveBeenCalled();
    });

    it('should return empty chapters when chapters array is empty', async () => {
      const mockMetadata = {
        videoId: 'test-video-id',
        title: 'Test Video',
        duration: 600,
        chapters: [],
      };

      mockGetMetadata.mockResolvedValue(mockMetadata);

      mockContext.config!.chapter.useYouTubeChapters = true;

      await stage.execute(mockContext as PipelineContext);

      expect(mockContext.chapters).toEqual([]);
      expect(mockLoggerInfo).not.toHaveBeenCalled();
    });
  });
});
