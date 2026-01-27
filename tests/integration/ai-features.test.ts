/**
 * AI 기능 통합 테스트
 */

// Mock logger first
jest.mock('../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
  },
}));

import { AIProvider } from '../../src/providers/ai';
import { SubtitleSegment, ContentSummary } from '../../src/types/index';

// 실제 API 호출 없이 통합 테스트
// OpenAI API 모킹
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockImplementation(({ messages }) => {
          const systemPrompt = messages[0]?.content || '';
          const userPrompt = messages[1]?.content || '';

          // 요약 요청 감지
          if (systemPrompt.includes('요약 전문가') || userPrompt.includes('요약')) {
            return Promise.resolve({
              choices: [
                {
                  message: {
                    content: `SUMMARY:
이 영상은 기술과 혁신에 대해 다루고 있습니다. 발표자는 미래의 트렌드와 기술 발전에 대해 설명합니다.

KEY_POINTS:
- 인공지능의 발전이 산업을 변화시키고 있습니다
- 자동화가 일자리에 미치는 영향을 분석합니다
- 미래를 대비한 교육의 중요성을 강조합니다`,
                  },
                },
              ],
            });
          }

          // 번역 요청 감지
          if (systemPrompt.includes('번역가')) {
            return Promise.resolve({
              choices: [
                {
                  message: {
                    content: `[0] 안녕하세요, 환영합니다
[1] 오늘은 중요한 주제를 다룹니다
[2] 감사합니다`,
                  },
                },
              ],
            });
          }

          // 언어 감지
          if (systemPrompt.includes('언어를 감지')) {
            if (userPrompt.includes('Hello') || userPrompt.includes('welcome')) {
              return Promise.resolve({
                choices: [{ message: { content: 'en' } }],
              });
            }
            return Promise.resolve({
              choices: [{ message: { content: 'ko' } }],
            });
          }

          return Promise.resolve({
            choices: [{ message: { content: '' } }],
          });
        }),
      },
    },
  }));
});

describe('AI Features Integration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, OPENAI_API_KEY: 'test-api-key' };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Summary Generation Flow', () => {
    it('should generate summary from subtitles', async () => {
      const provider = new AIProvider('test-key');

      const segments: SubtitleSegment[] = [
        { start: 0, end: 10, text: '안녕하세요, 오늘 영상에 오신 것을 환영합니다.' },
        { start: 10, end: 20, text: '오늘은 인공지능에 대해 이야기하겠습니다.' },
        { start: 20, end: 30, text: '자동화가 산업에 미치는 영향을 살펴봅니다.' },
        { start: 30, end: 40, text: '미래를 대비한 교육이 중요합니다.' },
        { start: 40, end: 50, text: '시청해 주셔서 감사합니다.' },
      ];

      const result = await provider.summarize(segments, {
        maxLength: 500,
        language: 'ko',
        style: 'brief',
      });

      expect(result.summary).toBeTruthy();
      expect(result.summary.length).toBeGreaterThan(0);
      expect(result.keyPoints.length).toBeGreaterThan(0);
      expect(result.language).toBe('ko');
    });

    it('should format summary as ContentSummary', async () => {
      const provider = new AIProvider('test-key');

      const segments: SubtitleSegment[] = [
        { start: 0, end: 10, text: '테스트 자막입니다.' },
      ];

      const result = await provider.summarize(segments);

      // ContentSummary 형식으로 변환 가능한지 확인
      const summary: ContentSummary = {
        summary: result.summary,
        keyPoints: result.keyPoints,
        language: result.language,
      };

      expect(summary).toHaveProperty('summary');
      expect(summary).toHaveProperty('keyPoints');
      expect(summary).toHaveProperty('language');
    });
  });

  describe('Translation Flow', () => {
    it('should translate subtitles to target language', async () => {
      const provider = new AIProvider('test-key');

      const segments: SubtitleSegment[] = [
        { start: 0, end: 10, text: 'Hello and welcome to this video.' },
        { start: 10, end: 20, text: 'Today we will discuss an important topic.' },
        { start: 20, end: 30, text: 'Thank you for watching.' },
      ];

      const result = await provider.translate(segments, {
        sourceLanguage: 'en',
        targetLanguage: 'ko',
      });

      expect(result.translatedSegments.length).toBe(segments.length);
      expect(result.sourceLanguage).toBe('en');
      expect(result.targetLanguage).toBe('ko');

      // 타임스탬프가 보존되는지 확인
      result.translatedSegments.forEach((seg, i) => {
        expect(seg.start).toBe(segments[i].start);
        expect(seg.end).toBe(segments[i].end);
      });
    });

    it('should handle auto language detection for translation', async () => {
      const provider = new AIProvider('test-key');

      const segments: SubtitleSegment[] = [
        { start: 0, end: 10, text: 'Hello world' },
      ];

      const result = await provider.translate(segments, {
        targetLanguage: 'ko',
      });

      expect(result.sourceLanguage).toBe('auto');
      expect(result.targetLanguage).toBe('ko');
    });
  });

  describe('Language Detection Flow', () => {
    it('should detect English text', async () => {
      const provider = new AIProvider('test-key');
      const result = await provider.detectLanguage('Hello, welcome to this video.');

      expect(result).toBe('en');
    });

    it('should detect Korean text', async () => {
      const provider = new AIProvider('test-key');
      const result = await provider.detectLanguage('안녕하세요');

      expect(result).toBe('ko');
    });
  });

  describe('Combined Summary + Translation Flow', () => {
    it('should translate then summarize', async () => {
      const provider = new AIProvider('test-key');

      // 1. 영어 자막
      const englishSegments: SubtitleSegment[] = [
        { start: 0, end: 10, text: 'Hello and welcome.' },
        { start: 10, end: 20, text: 'Today we discuss technology.' },
      ];

      // 2. 한국어로 번역
      const translated = await provider.translate(englishSegments, {
        sourceLanguage: 'en',
        targetLanguage: 'ko',
      });

      expect(translated.translatedSegments.length).toBe(2);

      // 3. 번역된 자막으로 요약
      const summary = await provider.summarize(translated.translatedSegments, {
        language: 'ko',
      });

      expect(summary.summary).toBeTruthy();
      expect(summary.language).toBe('ko');
    });
  });

  describe('Error Handling', () => {
    it('should handle empty subtitle array gracefully', async () => {
      const provider = new AIProvider('test-key');

      const summaryResult = await provider.summarize([]);
      expect(summaryResult.summary).toBe('');
      expect(summaryResult.keyPoints).toHaveLength(0);

      const translateResult = await provider.translate([], { targetLanguage: 'ko' });
      expect(translateResult.translatedSegments).toHaveLength(0);
    });

    it('should handle whitespace-only text', async () => {
      const provider = new AIProvider('test-key');

      const segments: SubtitleSegment[] = [
        { start: 0, end: 10, text: '   ' },
        { start: 10, end: 20, text: '\n\t' },
      ];

      const result = await provider.summarize(segments);
      expect(result.summary).toBe('');
    });
  });
});
