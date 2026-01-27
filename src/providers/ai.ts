/**
 * AI Provider - OpenAI GPT for Summary and Translation
 */

import OpenAI from 'openai';
import { ErrorCode, Yt2PdfError, SubtitleSegment } from '../types/index.js';
import { logger } from '../utils/logger.js';

export interface SummaryOptions {
  maxLength?: number; // 최대 문자 수
  language?: string; // 요약 언어
  style?: 'brief' | 'detailed'; // 요약 스타일
}

export interface SectionSummaryOptions {
  language?: string;
  maxSummaryLength?: number;
  maxKeyPoints?: number;
}

export interface SummaryResult {
  summary: string;
  keyPoints: string[];
  language: string;
}

export interface TranslationOptions {
  sourceLanguage?: string;
  targetLanguage: string;
}

export interface TranslationResult {
  translatedSegments: SubtitleSegment[];
  sourceLanguage: string;
  targetLanguage: string;
}

export class AIProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey?: string, model: string = 'gpt-4o-mini') {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Yt2PdfError(
        ErrorCode.API_KEY_MISSING,
        'OpenAI API 키가 필요합니다. OPENAI_API_KEY 환경변수를 설정하세요.'
      );
    }
    this.client = new OpenAI({ apiKey: key });
    this.model = model;
  }

  /**
   * 자막 텍스트를 요약
   */
  async summarize(segments: SubtitleSegment[], options: SummaryOptions = {}): Promise<SummaryResult> {
    const { maxLength = 500, language = 'ko', style = 'brief' } = options;

    // 자막 텍스트 합치기
    const fullText = segments.map((s) => s.text).join(' ');

    if (!fullText.trim()) {
      return {
        summary: '',
        keyPoints: [],
        language,
      };
    }

    const stylePrompt =
      style === 'detailed'
        ? '상세하고 포괄적인 요약을 작성하세요.'
        : '핵심만 간결하게 요약하세요.';

    const languageMap: Record<string, string> = {
      ko: '한국어',
      en: 'English',
      ja: '日本語',
      zh: '中文',
    };

    const targetLang = languageMap[language] || language;

    try {
      logger.debug(`AI 요약 시작: ${segments.length}개 세그먼트, 언어: ${language}`);

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `당신은 영상 콘텐츠 요약 전문가입니다. ${stylePrompt}
응답은 반드시 ${targetLang}로 작성하세요.

응답 형식:
SUMMARY:
[요약 내용]

KEY_POINTS:
- [핵심 포인트 1]
- [핵심 포인트 2]
- [핵심 포인트 3]`,
          },
          {
            role: 'user',
            content: `다음 영상 자막을 ${maxLength}자 이내로 요약하고 주요 포인트를 추출하세요:\n\n${fullText}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content || '';

      // 응답 파싱
      const summaryMatch = content.match(/SUMMARY:\s*([\s\S]*?)(?=KEY_POINTS:|$)/i);
      const keyPointsMatch = content.match(/KEY_POINTS:\s*([\s\S]*?)$/i);

      const summary = summaryMatch ? summaryMatch[1].trim() : content.trim();
      const keyPointsText = keyPointsMatch ? keyPointsMatch[1].trim() : '';

      const keyPoints = keyPointsText
        .split('\n')
        .map((line) => line.replace(/^[-•*]\s*/, '').trim())
        .filter((line) => line.length > 0);

      logger.debug(`AI 요약 완료: ${summary.length}자, ${keyPoints.length}개 핵심 포인트`);

      return {
        summary,
        keyPoints,
        language,
      };
    } catch (error) {
      const err = error as Error;
      logger.error(`AI 요약 실패: ${err.message}`);
      throw new Yt2PdfError(ErrorCode.WHISPER_API_ERROR, `AI 요약 오류: ${err.message}`, err);
    }
  }

  /**
   * 섹션별 요약 생성 (배치 처리)
   */
  async summarizeSections(
    sections: Array<{ timestamp: number; subtitles: SubtitleSegment[] }>,
    options: SectionSummaryOptions = {}
  ): Promise<Array<{ timestamp: number; summary: string; keyPoints: string[] }>> {
    const { language = 'ko', maxSummaryLength = 150, maxKeyPoints = 3 } = options;

    if (sections.length === 0) {
      return [];
    }

    const languageMap: Record<string, string> = {
      ko: '한국어',
      en: 'English',
      ja: '日本語',
      zh: '中文',
    };
    const targetLang = languageMap[language] || language;

    // 섹션 텍스트 준비
    const sectionTexts = sections.map((section, idx) => {
      const text = section.subtitles.map((s) => s.text).join(' ').trim();
      return `[섹션 ${idx}] (${this.formatTimestamp(section.timestamp)})\n${text}`;
    });

    try {
      logger.debug(`섹션별 요약 시작: ${sections.length}개 섹션`);

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `당신은 영상 콘텐츠 분석 전문가입니다. 각 섹션의 핵심 내용을 ${targetLang}로 요약하세요.

각 섹션에 대해 다음 형식으로 응답하세요:
[섹션 N]
요약: (${maxSummaryLength}자 이내의 핵심 내용)
포인트:
- (핵심 포인트 1)
- (핵심 포인트 2)
${maxKeyPoints > 2 ? '- (핵심 포인트 3)' : ''}

요약은 해당 구간에서 다루는 핵심 주제와 인사이트를 담아야 합니다.
원문이 영어라도 반드시 ${targetLang}로 작성하세요.`,
          },
          {
            role: 'user',
            content: `다음 영상 섹션들을 각각 요약하세요:\n\n${sectionTexts.join('\n\n')}`,
          },
        ],
        temperature: 0.3,
        max_tokens: Math.min(4000, sections.length * 300),
      });

      const content = response.choices[0]?.message?.content || '';

      // 응답 파싱
      const results: Array<{ timestamp: number; summary: string; keyPoints: string[] }> = [];

      for (let i = 0; i < sections.length; i++) {
        const sectionRegex = new RegExp(
          `\\[섹션\\s*${i}\\][\\s\\S]*?요약:\\s*([^\\n]+)[\\s\\S]*?포인트:\\s*([\\s\\S]*?)(?=\\[섹션\\s*${i + 1}\\]|$)`,
          'i'
        );
        const match = content.match(sectionRegex);

        if (match) {
          const summary = match[1].trim();
          const pointsText = match[2].trim();
          const keyPoints = pointsText
            .split('\n')
            .map((line) => line.replace(/^[-•*]\s*/, '').trim())
            .filter((line) => line.length > 0)
            .slice(0, maxKeyPoints);

          results.push({
            timestamp: sections[i].timestamp,
            summary,
            keyPoints,
          });
        } else {
          // 파싱 실패시 빈 결과
          results.push({
            timestamp: sections[i].timestamp,
            summary: '',
            keyPoints: [],
          });
        }
      }

      logger.debug(`섹션별 요약 완료: ${results.filter((r) => r.summary).length}/${sections.length}개 성공`);

      return results;
    } catch (error) {
      const err = error as Error;
      logger.error(`섹션별 요약 실패: ${err.message}`);
      // 에러 시 빈 결과 반환
      return sections.map((s) => ({
        timestamp: s.timestamp,
        summary: '',
        keyPoints: [],
      }));
    }
  }

  /**
   * 타임스탬프 포맷
   */
  private formatTimestamp(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  /**
   * 자막 번역
   */
  async translate(
    segments: SubtitleSegment[],
    options: TranslationOptions
  ): Promise<TranslationResult> {
    const { sourceLanguage, targetLanguage } = options;

    if (segments.length === 0) {
      return {
        translatedSegments: [],
        sourceLanguage: sourceLanguage || 'unknown',
        targetLanguage,
      };
    }

    const languageMap: Record<string, string> = {
      ko: '한국어',
      en: 'English',
      ja: '日本語',
      zh: '中文',
      es: 'Español',
      fr: 'Français',
      de: 'Deutsch',
    };

    const targetLang = languageMap[targetLanguage] || targetLanguage;
    const sourceLang = sourceLanguage ? languageMap[sourceLanguage] || sourceLanguage : '원본 언어';

    try {
      logger.debug(
        `AI 번역 시작: ${segments.length}개 세그먼트, ${sourceLang} → ${targetLang}`
      );

      // 배치로 번역 (최대 50개씩)
      const batchSize = 50;
      const translatedSegments: SubtitleSegment[] = [];

      for (let i = 0; i < segments.length; i += batchSize) {
        const batch = segments.slice(i, i + batchSize);
        const textsToTranslate = batch.map((s, idx) => `[${idx}] ${s.text}`).join('\n');

        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: `당신은 전문 번역가입니다. ${sourceLang}에서 ${targetLang}로 자막을 번역하세요.
각 줄의 [번호]를 유지하면서 번역하세요. 자연스럽고 읽기 쉬운 번역을 제공하세요.`,
            },
            {
              role: 'user',
              content: textsToTranslate,
            },
          ],
          temperature: 0.3,
          max_tokens: 4000,
        });

        const content = response.choices[0]?.message?.content || '';
        const lines = content.split('\n').filter((line) => line.trim());

        // 번역된 텍스트 파싱
        const translatedTexts: Map<number, string> = new Map();
        for (const line of lines) {
          const match = line.match(/^\[(\d+)\]\s*(.+)$/);
          if (match) {
            translatedTexts.set(parseInt(match[1], 10), match[2].trim());
          }
        }

        // 세그먼트에 번역 적용
        for (let j = 0; j < batch.length; j++) {
          const original = batch[j];
          const translatedText = translatedTexts.get(j) || original.text;
          translatedSegments.push({
            start: original.start,
            end: original.end,
            text: translatedText,
          });
        }
      }

      logger.debug(`AI 번역 완료: ${translatedSegments.length}개 세그먼트`);

      return {
        translatedSegments,
        sourceLanguage: sourceLanguage || 'auto',
        targetLanguage,
      };
    } catch (error) {
      const err = error as Error;
      logger.error(`AI 번역 실패: ${err.message}`);
      throw new Yt2PdfError(ErrorCode.WHISPER_API_ERROR, `AI 번역 오류: ${err.message}`, err);
    }
  }

  /**
   * 언어 감지
   */
  async detectLanguage(text: string): Promise<string> {
    if (!text.trim()) {
      return 'unknown';
    }

    try {
      const sampleText = text.slice(0, 500);

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              '텍스트의 언어를 감지하세요. ISO 639-1 언어 코드만 반환하세요 (예: ko, en, ja, zh).',
          },
          {
            role: 'user',
            content: sampleText,
          },
        ],
        temperature: 0,
        max_tokens: 10,
      });

      const detectedLang = response.choices[0]?.message?.content?.trim().toLowerCase() || 'unknown';
      logger.debug(`언어 감지 결과: ${detectedLang}`);
      return detectedLang;
    } catch (error) {
      logger.warn('언어 감지 실패, unknown 반환');
      return 'unknown';
    }
  }
}
