/**
 * Pipeline types - type compatibility tests
 * TDD Step 1 RED→GREEN: Verify types compile and are compatible
 */

import { PipelineStage, PipelineContext, PipelineResult } from '../../../../src/core/pipeline/types.js';
import { Config, ConvertOptions } from '../../../../src/types/config.js';
import { PipelineState, Chapter, ConvertResult } from '../../../../src/types/index.js';
import { ConfigSchema } from '../../../../src/types/config.js';

describe('Pipeline Types', () => {
  describe('PipelineStage interface', () => {
    it('should be implementable with name and execute', () => {
      const stage: PipelineStage = {
        name: 'test-stage',
        execute: async (_context: PipelineContext): Promise<void> => {
          // no-op
        },
      };

      expect(stage.name).toBe('test-stage');
      expect(typeof stage.execute).toBe('function');
    });

    it('should allow class-based implementation', () => {
      class TestStage implements PipelineStage {
        readonly name = 'test-stage';

        async execute(context: PipelineContext): Promise<void> {
          context.metadata = undefined; // stages can mutate context
        }
      }

      const stage = new TestStage();
      expect(stage.name).toBe('test-stage');
    });
  });

  describe('PipelineContext interface', () => {
    it('should be constructable with required fields', () => {
      const config = ConfigSchema.parse({});

      const context: PipelineContext = {
        videoId: 'test123',
        options: { url: 'https://youtube.com/watch?v=test123' } as ConvertOptions,
        config,
        tempDir: '/tmp/test',
        youtube: {} as any,
        ffmpeg: {} as any,
        whisper: undefined,
        ai: undefined,
        unifiedProcessor: undefined,
        cache: undefined,
        onProgress: (_state: Partial<PipelineState>) => {},
        traceEnabled: false,
        traceSteps: [],
      };

      expect(context.videoId).toBe('test123');
      expect(context.metadata).toBeUndefined();
      expect(context.chapters).toBeUndefined();
    });

    it('should allow accumulating state through stages', () => {
      const config = ConfigSchema.parse({});

      const context: PipelineContext = {
        videoId: 'test123',
        options: { url: 'https://youtube.com/watch?v=test123' } as ConvertOptions,
        config,
        tempDir: '/tmp/test',
        youtube: {} as any,
        ffmpeg: {} as any,
        whisper: undefined,
        ai: undefined,
        unifiedProcessor: undefined,
        cache: undefined,
        onProgress: () => {},
        traceEnabled: false,
        traceSteps: [],
      };

      // Stage 1 sets metadata
      context.metadata = {
        id: 'test123',
        title: 'Test Video',
        description: 'Test',
        duration: 600,
        thumbnail: 'https://example.com/thumb.jpg',
        channel: 'Test Channel',
        uploadDate: '2024-01-01',
        viewCount: 1000,
        availableCaptions: [],
      };

      // Stage 2 sets chapters
      context.chapters = [
        { title: 'Chapter 1', startTime: 0, endTime: 300 },
      ] as Chapter[];

      expect(context.metadata?.title).toBe('Test Video');
      expect(context.chapters).toHaveLength(1);
    });

    it('should support trace steps accumulation', () => {
      const config = ConfigSchema.parse({});

      const context: PipelineContext = {
        videoId: 'test123',
        options: { url: 'https://youtube.com/watch?v=test123' } as ConvertOptions,
        config,
        tempDir: '/tmp/test',
        youtube: {} as any,
        ffmpeg: {} as any,
        whisper: undefined,
        ai: undefined,
        unifiedProcessor: undefined,
        cache: undefined,
        onProgress: () => {},
        traceEnabled: true,
        traceSteps: [],
      };

      context.traceSteps.push({ name: 'metadata', ms: 150 });
      context.traceSteps.push({ name: 'subtitles', ms: 300, detail: { segments: 100 } });

      expect(context.traceSteps).toHaveLength(2);
      expect(context.traceSteps[0].name).toBe('metadata');
    });
  });

  describe('PipelineResult interface', () => {
    it('should wrap ConvertResult with optional trace', () => {
      const pipelineResult: PipelineResult = {
        result: {
          success: true,
          outputPath: '/output/test.pdf',
          metadata: {
            id: 'test123',
            title: 'Test',
            description: 'Test',
            duration: 600,
            thumbnail: 'https://example.com/thumb.jpg',
            channel: 'Test',
            uploadDate: '2024-01-01',
            viewCount: 1000,
            availableCaptions: [],
          },
          stats: {
            pages: 10,
            fileSize: 1024000,
            duration: 600,
            screenshotCount: 10,
          },
        } as ConvertResult,
      };

      expect(pipelineResult.result.outputPath).toBe('/output/test.pdf');
      expect(pipelineResult.traceSteps).toBeUndefined();
    });
  });

  describe('Stage pipeline flow simulation', () => {
    it('should simulate sequential stage execution with shared context', async () => {
      const config = ConfigSchema.parse({});
      const progressUpdates: Partial<PipelineState>[] = [];

      const context: PipelineContext = {
        videoId: 'test123',
        options: { url: 'https://youtube.com/watch?v=test123' } as ConvertOptions,
        config,
        tempDir: '/tmp/test',
        youtube: {} as any,
        ffmpeg: {} as any,
        whisper: undefined,
        ai: undefined,
        unifiedProcessor: undefined,
        cache: undefined,
        onProgress: (state) => progressUpdates.push(state),
        traceEnabled: false,
        traceSteps: [],
      };

      // Simulate two stages
      const stage1: PipelineStage = {
        name: 'metadata',
        execute: async (ctx) => {
          ctx.onProgress({ status: 'fetching', progress: 5 });
          ctx.metadata = {
            id: ctx.videoId,
            title: 'Test',
            description: 'Test',
            duration: 600,
            thumbnail: 'https://example.com/thumb.jpg',
            channel: 'Test',
            uploadDate: '2024-01-01',
            viewCount: 1000,
            availableCaptions: [],
          };
        },
      };

      const stage2: PipelineStage = {
        name: 'subtitles',
        execute: async (ctx) => {
          ctx.onProgress({ status: 'processing', progress: 30 });
          ctx.processedSegments = [{ start: 0, end: 5, text: 'Hello' }];
        },
      };

      // Execute stages sequentially
      const stages: PipelineStage[] = [stage1, stage2];
      for (const stage of stages) {
        await stage.execute(context);
      }

      // Verify accumulated state
      expect(context.metadata?.title).toBe('Test');
      expect(context.processedSegments).toHaveLength(1);
      expect(progressUpdates).toHaveLength(2);
      expect(progressUpdates[0].status).toBe('fetching');
      expect(progressUpdates[1].status).toBe('processing');
    });
  });
});
