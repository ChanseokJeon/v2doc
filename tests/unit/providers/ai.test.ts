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
});
