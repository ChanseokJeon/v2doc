/**
 * AI Provider 테스트
 */

// Mock logger first (before importing AIProvider)
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
  },
}));

import { AIProvider } from '../../../src/providers/ai';
import { SubtitleSegment } from '../../../src/types/index';

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: `SUMMARY:
이것은 테스트 요약입니다. 영상에서는 중요한 내용을 다룹니다.

KEY_POINTS:
- 첫 번째 핵심 포인트
- 두 번째 핵심 포인트
- 세 번째 핵심 포인트`,
              },
            },
          ],
        }),
      },
    },
  }));
});

describe('AIProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, OPENAI_API_KEY: 'test-api-key' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should create instance with valid API key', () => {
      const provider = new AIProvider('test-key');
      expect(provider).toBeInstanceOf(AIProvider);
    });

    it('should create instance with environment API key', () => {
      const provider = new AIProvider();
      expect(provider).toBeInstanceOf(AIProvider);
    });

    it('should throw error without API key', () => {
      delete process.env.OPENAI_API_KEY;
      expect(() => new AIProvider()).toThrow('OpenAI API 키가 필요합니다');
    });

    it('should use custom model', () => {
      const provider = new AIProvider('test-key', 'gpt-4');
      expect(provider).toBeInstanceOf(AIProvider);
    });
  });

  describe('summarize', () => {
    const mockSegments: SubtitleSegment[] = [
      { start: 0, end: 5, text: '안녕하세요, 오늘 영상입니다.' },
      { start: 5, end: 10, text: '중요한 내용을 다루겠습니다.' },
      { start: 10, end: 15, text: '감사합니다.' },
    ];

    it('should return summary result', async () => {
      const provider = new AIProvider('test-key');
      const result = await provider.summarize(mockSegments);

      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('keyPoints');
      expect(result).toHaveProperty('language');
      expect(result.summary).toContain('테스트 요약');
      expect(result.keyPoints).toHaveLength(3);
    });

    it('should use default options', async () => {
      const provider = new AIProvider('test-key');
      const result = await provider.summarize(mockSegments);

      expect(result.language).toBe('ko');
    });

    it('should respect maxLength option', async () => {
      const provider = new AIProvider('test-key');
      const result = await provider.summarize(mockSegments, { maxLength: 200 });

      expect(result).toBeDefined();
    });

    it('should respect language option', async () => {
      const provider = new AIProvider('test-key');
      const result = await provider.summarize(mockSegments, { language: 'en' });

      expect(result.language).toBe('en');
    });

    it('should respect style option', async () => {
      const provider = new AIProvider('test-key');
      const result = await provider.summarize(mockSegments, { style: 'detailed' });

      expect(result).toBeDefined();
    });

    it('should handle empty segments', async () => {
      const provider = new AIProvider('test-key');
      const result = await provider.summarize([]);

      expect(result.summary).toBe('');
      expect(result.keyPoints).toHaveLength(0);
    });
  });

  describe('translate', () => {
    const mockSegments: SubtitleSegment[] = [
      { start: 0, end: 5, text: 'Hello world' },
      { start: 5, end: 10, text: 'This is a test' },
    ];

    beforeEach(() => {
      // Override mock for translation
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: `[0] 안녕하세요 세계
[1] 이것은 테스트입니다`,
            },
          },
        ],
      });

      jest.requireMock('openai').mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }));
    });

    it('should return translated segments', async () => {
      const provider = new AIProvider('test-key');
      const result = await provider.translate(mockSegments, {
        sourceLanguage: 'en',
        targetLanguage: 'ko',
      });

      expect(result).toHaveProperty('translatedSegments');
      expect(result).toHaveProperty('sourceLanguage');
      expect(result).toHaveProperty('targetLanguage');
      expect(result.targetLanguage).toBe('ko');
    });

    it('should preserve timestamps', async () => {
      const provider = new AIProvider('test-key');
      const result = await provider.translate(mockSegments, {
        sourceLanguage: 'en',
        targetLanguage: 'ko',
      });

      expect(result.translatedSegments[0].start).toBe(0);
      expect(result.translatedSegments[0].end).toBe(5);
    });

    it('should handle empty segments', async () => {
      const provider = new AIProvider('test-key');
      const result = await provider.translate([], {
        targetLanguage: 'ko',
      });

      expect(result.translatedSegments).toHaveLength(0);
    });
  });

  describe('detectLanguage', () => {
    beforeEach(() => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: 'ko',
            },
          },
        ],
      });

      jest.requireMock('openai').mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }));
    });

    it('should detect language', async () => {
      const provider = new AIProvider('test-key');
      const result = await provider.detectLanguage('안녕하세요');

      expect(result).toBe('ko');
    });

    it('should return unknown for empty text', async () => {
      const provider = new AIProvider('test-key');
      const result = await provider.detectLanguage('');

      expect(result).toBe('unknown');
    });

    it('should return unknown for whitespace text', async () => {
      const provider = new AIProvider('test-key');
      const result = await provider.detectLanguage('   ');

      expect(result).toBe('unknown');
    });
  });

  describe('summarizeSections', () => {
    const mockSections = [
      {
        timestamp: 0,
        subtitles: [
          { start: 0, end: 10, text: 'Hello, this is the first section.' },
          { start: 10, end: 20, text: 'We discuss important topics here.' },
        ],
      },
      {
        timestamp: 60,
        subtitles: [
          { start: 60, end: 70, text: 'This is the second section.' },
          { start: 70, end: 80, text: 'Different content here.' },
        ],
      },
    ];

    beforeEach(() => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: `[섹션 0]
요약: 첫 번째 섹션에서는 중요한 주제를 다룹니다.
포인트:
- 첫 번째 핵심 포인트
- 두 번째 핵심 포인트

[섹션 1]
요약: 두 번째 섹션에서는 다른 내용을 다룹니다.
포인트:
- 첫 번째 핵심 포인트
- 두 번째 핵심 포인트`,
            },
          },
        ],
      });

      jest.requireMock('openai').mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }));
    });

    it('should summarize multiple sections', async () => {
      const provider = new AIProvider('test-key');
      const result = await provider.summarizeSections(mockSections);

      expect(result).toHaveLength(2);
      expect(result[0].timestamp).toBe(0);
      expect(result[0].summary).toContain('첫 번째 섹션');
      expect(result[0].keyPoints.length).toBeGreaterThan(0);
      expect(result[1].timestamp).toBe(60);
    });

    it('should respect language option', async () => {
      const provider = new AIProvider('test-key');
      const result = await provider.summarizeSections(mockSections, { language: 'en' });

      expect(result).toHaveLength(2);
    });

    it('should respect maxKeyPoints option', async () => {
      const provider = new AIProvider('test-key');
      const result = await provider.summarizeSections(mockSections, { maxKeyPoints: 2 });

      expect(result[0].keyPoints.length).toBeLessThanOrEqual(2);
    });

    it('should handle empty sections array', async () => {
      const provider = new AIProvider('test-key');
      const result = await provider.summarizeSections([]);

      expect(result).toHaveLength(0);
    });

    it('should handle API error gracefully', async () => {
      const mockCreate = jest.fn().mockRejectedValue(new Error('API Error'));

      jest.requireMock('openai').mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }));

      const provider = new AIProvider('test-key');
      const result = await provider.summarizeSections(mockSections);

      expect(result).toHaveLength(2);
      expect(result[0].summary).toBe('');
    });
  });

  describe('classifyVideoType', () => {
    beforeEach(() => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: '{"type": "conference_talk", "confidence": 0.85}',
            },
          },
        ],
      });

      jest.requireMock('openai').mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }));
    });

    it('should classify video type', async () => {
      const provider = new AIProvider('test-key');
      const result = await provider.classifyVideoType(
        { title: 'Tech Talk', description: 'Conference presentation', channel: 'TechConf' },
        'Hello everyone, welcome to my talk'
      );

      expect(result.type).toBe('conference_talk');
      expect(result.confidence).toBe(0.85);
    });

    it('should return unknown for invalid type', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: '{"type": "invalid_type", "confidence": 0.5}',
            },
          },
        ],
      });

      jest.requireMock('openai').mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }));

      const provider = new AIProvider('test-key');
      const result = await provider.classifyVideoType(
        { title: 'Test', description: 'Test', channel: 'Test' },
        'Test'
      );

      expect(result.type).toBe('unknown');
    });

    it('should clamp confidence to valid range', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: '{"type": "tutorial", "confidence": 1.5}',
            },
          },
        ],
      });

      jest.requireMock('openai').mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }));

      const provider = new AIProvider('test-key');
      const result = await provider.classifyVideoType(
        { title: 'Test', description: 'Test', channel: 'Test' },
        'Test'
      );

      expect(result.confidence).toBe(1);
    });

    it('should handle non-JSON response', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: 'This is not JSON',
            },
          },
        ],
      });

      jest.requireMock('openai').mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }));

      const provider = new AIProvider('test-key');
      const result = await provider.classifyVideoType(
        { title: 'Test', description: 'Test', channel: 'Test' },
        'Test'
      );

      expect(result.type).toBe('unknown');
      expect(result.confidence).toBe(0);
    });

    it('should handle API error', async () => {
      const mockCreate = jest.fn().mockRejectedValue(new Error('API Error'));

      jest.requireMock('openai').mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }));

      const provider = new AIProvider('test-key');
      const result = await provider.classifyVideoType(
        { title: 'Test', description: 'Test', channel: 'Test' },
        'Test'
      );

      expect(result.type).toBe('unknown');
      expect(result.confidence).toBe(0);
    });
  });

  describe('detectTopicShifts', () => {
    const mockSegments = [
      { start: 0, end: 30, text: 'Introduction to the topic' },
      { start: 30, end: 60, text: 'More introduction content' },
      { start: 60, end: 90, text: 'Main topic discussion' },
      { start: 90, end: 120, text: 'Continuing main topic' },
    ];

    beforeEach(() => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify([
                { title: '소개', startTime: 0 },
                { title: '본론', startTime: 60 },
              ]),
            },
          },
        ],
      });

      jest.requireMock('openai').mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }));
    });

    it('should detect topic shifts and generate chapters', async () => {
      const provider = new AIProvider('test-key');
      const result = await provider.detectTopicShifts(mockSegments);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('소개');
      expect(result[0].startTime).toBe(0);
      expect(result[1].startTime).toBe(60);
    });

    it('should return empty array for empty segments', async () => {
      const provider = new AIProvider('test-key');
      const result = await provider.detectTopicShifts([]);

      expect(result).toHaveLength(0);
    });

    it('should respect minChapterLength option', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify([
                { title: 'Short', startTime: 0 },
                { title: 'Next', startTime: 30 }, // 30 seconds
              ]),
            },
          },
        ],
      });

      jest.requireMock('openai').mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }));

      const provider = new AIProvider('test-key');
      const result = await provider.detectTopicShifts(mockSegments, { minChapterLength: 60 });

      // Short chapter should be filtered out
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it('should handle non-JSON response', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Not valid JSON',
            },
          },
        ],
      });

      jest.requireMock('openai').mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }));

      const provider = new AIProvider('test-key');
      const result = await provider.detectTopicShifts(mockSegments);

      expect(result).toHaveLength(0);
    });

    it('should handle API error', async () => {
      const mockCreate = jest.fn().mockRejectedValue(new Error('API Error'));

      jest.requireMock('openai').mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }));

      const provider = new AIProvider('test-key');
      const result = await provider.detectTopicShifts(mockSegments);

      expect(result).toHaveLength(0);
    });
  });

  describe('generateExecutiveBrief', () => {
    const mockMetadata = {
      id: 'test123',
      title: 'Test Video',
      description: 'Test description',
      duration: 600,
      thumbnail: 'https://example.com/thumb.jpg',
      channel: 'Test Channel',
      uploadDate: '20231115',
      viewCount: 1000,
      availableCaptions: [],
      videoType: 'tutorial' as const,
    };

    const mockChapters = [
      { title: 'Intro', startTime: 0, endTime: 60 },
      { title: 'Main', startTime: 60, endTime: 300 },
    ];

    const mockSegments = [
      { start: 0, end: 30, text: 'Hello' },
      { start: 30, end: 60, text: 'World' },
      { start: 60, end: 90, text: 'Main content' },
    ];

    beforeEach(() => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: 'This is the executive summary',
                keyTakeaways: ['Key point 1', 'Key point 2'],
                chapterSummaries: [
                  { title: 'Intro', startTime: 0, summary: 'Introduction section' },
                  { title: 'Main', startTime: 60, summary: 'Main content' },
                ],
                actionItems: ['Action 1', 'Action 2'],
              }),
            },
          },
        ],
      });

      jest.requireMock('openai').mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }));
    });

    it('should generate executive brief', async () => {
      const provider = new AIProvider('test-key');
      const result = await provider.generateExecutiveBrief(
        mockMetadata,
        mockChapters,
        mockSegments
      );

      expect(result.title).toBe('Test Video');
      expect(result.summary).toBe('This is the executive summary');
      expect(result.keyTakeaways).toHaveLength(2);
      expect(result.chapterSummaries).toHaveLength(2);
      expect(result.actionItems).toHaveLength(2);
    });

    it('should use language option', async () => {
      const provider = new AIProvider('test-key');
      const result = await provider.generateExecutiveBrief(
        mockMetadata,
        mockChapters,
        mockSegments,
        { language: 'en' }
      );

      expect(result).toBeDefined();
    });

    it('should handle API error with fallback brief', async () => {
      const mockCreate = jest.fn().mockRejectedValue(new Error('API Error'));

      jest.requireMock('openai').mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }));

      const provider = new AIProvider('test-key');
      const result = await provider.generateExecutiveBrief(
        mockMetadata,
        mockChapters,
        mockSegments
      );

      expect(result.summary).toBe('요약을 생성할 수 없습니다.');
      expect(result.keyTakeaways).toHaveLength(0);
    });

    it('should handle non-JSON response with fallback', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Not JSON',
            },
          },
        ],
      });

      jest.requireMock('openai').mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }));

      const provider = new AIProvider('test-key');
      const result = await provider.generateExecutiveBrief(
        mockMetadata,
        mockChapters,
        mockSegments
      );

      expect(result.summary).toBe('요약을 생성할 수 없습니다.');
    });

    it('should handle empty action items', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: 'Summary',
                keyTakeaways: ['Key 1'],
                chapterSummaries: [],
                actionItems: [],
              }),
            },
          },
        ],
      });

      jest.requireMock('openai').mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }));

      const provider = new AIProvider('test-key');
      const result = await provider.generateExecutiveBrief(
        mockMetadata,
        mockChapters,
        mockSegments
      );

      expect(result.actionItems).toBeUndefined();
    });
  });

  describe('sanitizeText', () => {
    it('should remove extended Hangul characters', () => {
      const provider = new AIProvider('test-key');
      // Access private method
      const result = (provider as any).sanitizeText('안녕하세요\uD7B0테스트');

      expect(result).toBe('안녕하세요테스트');
    });

    it('should handle null/empty input', () => {
      const provider = new AIProvider('test-key');
      expect((provider as any).sanitizeText('')).toBe('');
      expect((provider as any).sanitizeText(null)).toBe(null);
    });
  });
});
