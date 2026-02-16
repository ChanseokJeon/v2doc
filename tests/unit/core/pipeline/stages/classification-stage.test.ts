/**
 * Unit tests for ClassificationStage
 */

import { ClassificationStage } from '../../../../../src/core/pipeline/stages/classification-stage.js';
import { PipelineContext } from '../../../../../src/core/pipeline/types.js';
import { logger } from '../../../../../src/utils/logger.js';
import { SubtitleSegment, Chapter } from '../../../../../src/types/index.js';
import { ConfigSchema } from '../../../../../src/types/config.js';

// Mock dependencies
jest.mock('../../../../../src/utils/logger.js');

describe('ClassificationStage', () => {
  let stage: ClassificationStage;
  let mockContext: PipelineContext;

  beforeEach(() => {
    jest.clearAllMocks();

    stage = new ClassificationStage();

    // Base context
    const config = ConfigSchema.parse({});
    mockContext = {
      videoId: 'test-video-id',
      tempDir: '/tmp/test',
      config,
      options: { format: 'pdf' },
      youtube: {} as any,
      ffmpeg: {} as any,
      whisper: undefined,
      ai: undefined,
      unifiedProcessor: undefined,
      cache: {} as any,
      metadata: {
        videoId: 'test-video-id',
        title: 'Test Video',
        description: 'Test Description',
        channel: 'Test Channel',
        duration: 100,
        availableCaptions: ['en'],
        chapters: [],
      },
      chapters: [],
      processedSegments: [],
      onProgress: jest.fn(),
      traceEnabled: false,
      traceSteps: [],
    };
  });

  describe('name', () => {
    it('should be "classification"', () => {
      expect(stage.name).toBe('classification');
    });
  });

  describe('execute', () => {
    describe('Video type classification', () => {
      it('should call ai.classifyVideoType with correct args and set metadata.videoType', async () => {
        const mockSegments: SubtitleSegment[] = [
          { start: 0, end: 5, text: 'Hello' },
          { start: 5, end: 10, text: 'World' },
          { start: 10, end: 15, text: 'This' },
          { start: 15, end: 20, text: 'is' },
          { start: 20, end: 25, text: 'a' },
          { start: 25, end: 30, text: 'test' },
          { start: 30, end: 35, text: 'video' },
          { start: 35, end: 40, text: 'about' },
          { start: 40, end: 45, text: 'coding' },
          { start: 45, end: 50, text: 'tutorials' },
        ];
        mockContext.processedSegments = mockSegments;
        mockContext.ai = {
          classifyVideoType: jest.fn().mockResolvedValue({
            type: 'tutorial',
            confidence: 0.95,
          }),
        } as any;

        await stage.execute(mockContext);

        expect(mockContext.onProgress).toHaveBeenCalledWith({
          currentStep: '영상 유형 분류',
          progress: 34,
        });
        expect(mockContext.ai.classifyVideoType).toHaveBeenCalledWith(
          {
            title: 'Test Video',
            description: 'Test Description',
            channel: 'Test Channel',
          },
          'Hello World This is a test video about coding tutorials'
        );
        expect(mockContext.metadata!.videoType).toBe('tutorial');
        expect(mockContext.metadata!.videoTypeConfidence).toBe(0.95);
        expect(logger.info).toHaveBeenCalledWith('영상 유형: tutorial (신뢰도: 95%)');
      });

      it('should use first 10 segments for subtitle sample', async () => {
        const mockSegments: SubtitleSegment[] = Array.from({ length: 20 }, (_, i) => ({
          start: i * 5,
          end: (i + 1) * 5,
          text: `Segment ${i + 1}`,
        }));
        mockContext.processedSegments = mockSegments;
        mockContext.ai = {
          classifyVideoType: jest.fn().mockResolvedValue({
            type: 'lecture',
            confidence: 0.8,
          }),
        } as any;

        await stage.execute(mockContext);

        const expectedSample = mockSegments
          .slice(0, 10)
          .map((s) => s.text)
          .join(' ');
        expect(mockContext.ai.classifyVideoType).toHaveBeenCalledWith(
          expect.any(Object),
          expectedSample
        );
      });

      it('should log warning when classifyVideoType throws error', async () => {
        mockContext.processedSegments = [{ start: 0, end: 5, text: 'Hello' }];
        const error = new Error('Classification failed');
        mockContext.ai = {
          classifyVideoType: jest.fn().mockRejectedValue(error),
        } as any;

        await stage.execute(mockContext);

        expect(logger.warn).toHaveBeenCalledWith('영상 유형 분류 실패', error);
        expect(mockContext.metadata!.videoType).toBeUndefined();
      });

      it('should skip classification when dev mode enabled with skipClassification', async () => {
        mockContext.config.dev = { enabled: true };
        mockContext.processedSegments = [{ start: 0, end: 5, text: 'Hello' }];
        mockContext.ai = {
          classifyVideoType: jest.fn(),
        } as any;

        await stage.execute(mockContext);

        expect(logger.info).toHaveBeenCalledWith('[DEV MODE] 영상 분류 생략');
        expect(mockContext.ai.classifyVideoType).not.toHaveBeenCalled();
      });

      it('should skip classification when ai is undefined', async () => {
        mockContext.processedSegments = [{ start: 0, end: 5, text: 'Hello' }];
        mockContext.ai = undefined;

        await stage.execute(mockContext);

        expect(mockContext.metadata!.videoType).toBeUndefined();
      });

      it('should skip classification when processedSegments is empty', async () => {
        mockContext.processedSegments = [];
        mockContext.ai = {
          classifyVideoType: jest.fn(),
        } as any;

        await stage.execute(mockContext);

        expect(mockContext.ai.classifyVideoType).not.toHaveBeenCalled();
      });
    });

    describe('Chapter auto-generation', () => {
      it('should call ai.detectTopicShifts when no chapters and autoGenerate enabled', async () => {
        const mockSegments: SubtitleSegment[] = [
          { start: 0, end: 5, text: 'Hello' },
          { start: 5, end: 10, text: 'World' },
        ];
        const generatedChapters: Chapter[] = [
          { title: 'Introduction', timestamp: 0 },
          { title: 'Main Content', timestamp: 60 },
        ];
        mockContext.processedSegments = mockSegments;
        mockContext.chapters = [];
        mockContext.config.chapter.autoGenerate = true;
        mockContext.ai = {
          detectTopicShifts: jest.fn().mockResolvedValue(generatedChapters),
        } as any;

        await stage.execute(mockContext);

        expect(mockContext.onProgress).toHaveBeenCalledWith({
          currentStep: '챕터 자동 생성',
          progress: 35,
        });
        expect(logger.info).toHaveBeenCalledWith('AI 기반 챕터 자동 생성 중...');
        expect(mockContext.ai.detectTopicShifts).toHaveBeenCalledWith(mockSegments, {
          minChapterLength: mockContext.config.chapter.minChapterLength,
          maxChapters: mockContext.config.chapter.maxChapters,
          language: mockContext.config.translation.defaultLanguage,
        });
        expect(logger.info).toHaveBeenCalledWith('AI 생성 챕터: 2개');
        expect(mockContext.chapters).toEqual(generatedChapters);
      });

      it('should use summary.language if set for chapter generation', async () => {
        const mockSegments: SubtitleSegment[] = [{ start: 0, end: 5, text: 'Hello' }];
        mockContext.processedSegments = mockSegments;
        mockContext.chapters = [];
        mockContext.config.chapter.autoGenerate = true;
        mockContext.config.summary.language = 'en';
        mockContext.config.translation.defaultLanguage = 'ko';
        mockContext.ai = {
          detectTopicShifts: jest.fn().mockResolvedValue([]),
        } as any;

        await stage.execute(mockContext);

        expect(mockContext.ai.detectTopicShifts).toHaveBeenCalledWith(mockSegments, {
          minChapterLength: mockContext.config.chapter.minChapterLength,
          maxChapters: mockContext.config.chapter.maxChapters,
          language: 'en',
        });
      });

      it('should log warning when detectTopicShifts throws error', async () => {
        mockContext.processedSegments = [{ start: 0, end: 5, text: 'Hello' }];
        mockContext.chapters = [];
        mockContext.config.chapter.autoGenerate = true;
        const error = new Error('Chapter generation failed');
        mockContext.ai = {
          detectTopicShifts: jest.fn().mockRejectedValue(error),
        } as any;

        await stage.execute(mockContext);

        expect(logger.warn).toHaveBeenCalledWith('챕터 자동 생성 실패', error);
        expect(mockContext.chapters).toEqual([]);
      });

      it('should skip chapter generation when dev mode enabled with skipChapterGeneration', async () => {
        mockContext.config.dev = { enabled: true };
        mockContext.processedSegments = [{ start: 0, end: 5, text: 'Hello' }];
        mockContext.chapters = [];
        mockContext.config.chapter.autoGenerate = true;
        mockContext.ai = {
          detectTopicShifts: jest.fn(),
        } as any;

        await stage.execute(mockContext);

        expect(logger.info).toHaveBeenCalledWith('[DEV MODE] AI 챕터 생성 생략');
        expect(mockContext.ai.detectTopicShifts).not.toHaveBeenCalled();
      });

      it('should skip chapter generation when chapters already exist', async () => {
        const existingChapters: Chapter[] = [{ title: 'Existing', timestamp: 0 }];
        mockContext.processedSegments = [{ start: 0, end: 5, text: 'Hello' }];
        mockContext.chapters = existingChapters;
        mockContext.config.chapter.autoGenerate = true;
        mockContext.ai = {
          detectTopicShifts: jest.fn(),
        } as any;

        await stage.execute(mockContext);

        expect(mockContext.ai.detectTopicShifts).not.toHaveBeenCalled();
        expect(mockContext.chapters).toEqual(existingChapters);
      });

      it('should skip chapter generation when autoGenerate is false', async () => {
        mockContext.processedSegments = [{ start: 0, end: 5, text: 'Hello' }];
        mockContext.chapters = [];
        mockContext.config.chapter.autoGenerate = false;
        mockContext.ai = {
          detectTopicShifts: jest.fn(),
        } as any;

        await stage.execute(mockContext);

        expect(mockContext.ai.detectTopicShifts).not.toHaveBeenCalled();
      });

      it('should skip chapter generation when ai is undefined', async () => {
        mockContext.processedSegments = [{ start: 0, end: 5, text: 'Hello' }];
        mockContext.chapters = [];
        mockContext.config.chapter.autoGenerate = true;
        mockContext.ai = undefined;

        await stage.execute(mockContext);

        expect(mockContext.chapters).toEqual([]);
      });

      it('should skip chapter generation when processedSegments is empty', async () => {
        mockContext.processedSegments = [];
        mockContext.chapters = [];
        mockContext.config.chapter.autoGenerate = true;
        mockContext.ai = {
          detectTopicShifts: jest.fn(),
        } as any;

        await stage.execute(mockContext);

        expect(mockContext.ai.detectTopicShifts).not.toHaveBeenCalled();
      });
    });

    describe('Metadata chapters mutation', () => {
      it('should set metadata.chapters when AI generates chapters and metadata.chapters not set', async () => {
        const generatedChapters: Chapter[] = [
          { title: 'Chapter 1', timestamp: 0 },
          { title: 'Chapter 2', timestamp: 60 },
        ];
        mockContext.processedSegments = [{ start: 0, end: 5, text: 'Hello' }];
        mockContext.chapters = [];
        mockContext.config.chapter.autoGenerate = true;
        mockContext.metadata!.chapters = undefined;
        mockContext.ai = {
          detectTopicShifts: jest.fn().mockResolvedValue(generatedChapters),
        } as any;

        await stage.execute(mockContext);

        expect(mockContext.metadata!.chapters).toEqual(generatedChapters);
      });

      it('should not overwrite metadata.chapters when already set', async () => {
        const existingMetadataChapters: Chapter[] = [{ title: 'Existing', timestamp: 0 }];
        const generatedChapters: Chapter[] = [{ title: 'Generated', timestamp: 0 }];
        mockContext.processedSegments = [{ start: 0, end: 5, text: 'Hello' }];
        mockContext.chapters = [];
        mockContext.config.chapter.autoGenerate = true;
        mockContext.metadata!.chapters = existingMetadataChapters;
        mockContext.ai = {
          detectTopicShifts: jest.fn().mockResolvedValue(generatedChapters),
        } as any;

        await stage.execute(mockContext);

        expect(mockContext.metadata!.chapters).toEqual(existingMetadataChapters);
      });

      it('should set metadata.chapters when initial chapters provided', async () => {
        const initialChapters: Chapter[] = [{ title: 'Initial', timestamp: 0 }];
        mockContext.processedSegments = [{ start: 0, end: 5, text: 'Hello' }];
        mockContext.chapters = initialChapters;
        mockContext.metadata!.chapters = undefined;

        await stage.execute(mockContext);

        expect(mockContext.metadata!.chapters).toEqual(initialChapters);
      });
    });

    describe('Sets context.chapters', () => {
      it('should update context.chapters with result', async () => {
        const generatedChapters: Chapter[] = [{ title: 'Chapter', timestamp: 0 }];
        mockContext.processedSegments = [{ start: 0, end: 5, text: 'Hello' }];
        mockContext.chapters = [];
        mockContext.config.chapter.autoGenerate = true;
        mockContext.ai = {
          detectTopicShifts: jest.fn().mockResolvedValue(generatedChapters),
        } as any;

        await stage.execute(mockContext);

        expect(mockContext.chapters).toEqual(generatedChapters);
      });

      it('should preserve initial chapters when no generation occurs', async () => {
        const initialChapters: Chapter[] = [{ title: 'Initial', timestamp: 0 }];
        mockContext.processedSegments = [{ start: 0, end: 5, text: 'Hello' }];
        mockContext.chapters = initialChapters;
        mockContext.config.chapter.autoGenerate = false;

        await stage.execute(mockContext);

        expect(mockContext.chapters).toEqual(initialChapters);
      });
    });
  });
});
