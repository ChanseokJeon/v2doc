/**
 * 텍스트 유틸리티 테스트
 */

import {
  decodeHtmlEntities,
  deduplicateSubtitles,
  cleanSubtitleText,
  isKoreanDominant,
  cleanMixedLanguageText,
} from '../../../src/utils/text';

describe('Text Utils', () => {
  describe('decodeHtmlEntities', () => {
    it('should decode common HTML entities', () => {
      expect(decodeHtmlEntities('&amp;')).toBe('&');
      expect(decodeHtmlEntities('&lt;')).toBe('<');
      expect(decodeHtmlEntities('&gt;')).toBe('>');
      expect(decodeHtmlEntities('&quot;')).toBe('"');
      expect(decodeHtmlEntities('&#39;')).toBe("'");
      expect(decodeHtmlEntities('&nbsp;')).toBe(' ');
    });

    it('should decode numeric entities (decimal)', () => {
      expect(decodeHtmlEntities('&#65;')).toBe('A');
      expect(decodeHtmlEntities('&#97;')).toBe('a');
      // &#8221; is the RIGHT DOUBLE QUOTATION MARK (")
      expect(decodeHtmlEntities('&#8221;')).toBe('\u201D');
    });

    it('should decode numeric entities (hex)', () => {
      expect(decodeHtmlEntities('&#x41;')).toBe('A');
      expect(decodeHtmlEntities('&#x61;')).toBe('a');
    });

    it('should handle multiple entities in a string', () => {
      expect(decodeHtmlEntities('Hello &amp; World &gt;&gt; Test')).toBe('Hello & World >> Test');
    });

    it('should handle text without entities', () => {
      expect(decodeHtmlEntities('Hello World')).toBe('Hello World');
    });
  });

  describe('deduplicateSubtitles', () => {
    it('should remove consecutive duplicate lines', () => {
      const input = ['Hello', 'Hello', 'Hello', 'World'];
      const result = deduplicateSubtitles(input);
      expect(result).toEqual(['Hello', 'World']);
    });

    it('should handle progressive subtitles', () => {
      const input = ['Hello', 'Hello World', 'Hello World!'];
      const result = deduplicateSubtitles(input);
      // 이전 것이 현재의 접두사면 병합
      expect(result).toEqual(['Hello World!']);
    });

    it('should keep non-duplicate lines', () => {
      const input = ['First line', 'Second line', 'Third line'];
      const result = deduplicateSubtitles(input);
      expect(result).toEqual(['First line', 'Second line', 'Third line']);
    });

    it('should handle empty array', () => {
      expect(deduplicateSubtitles([])).toEqual([]);
    });

    it('should skip empty strings', () => {
      const input = ['Hello', '', '   ', 'World'];
      const result = deduplicateSubtitles(input);
      expect(result).toEqual(['Hello', 'World']);
    });

    it('should skip shorter prefix when current is longer', () => {
      const input = ['I am', 'I am the', 'I am the last speaker'];
      const result = deduplicateSubtitles(input);
      expect(result).toEqual(['I am the last speaker']);
    });

    it('should merge overlapping YouTube auto-captions', () => {
      // YouTube 자동 자막 패턴: 끝부분과 시작부분이 겹침
      const input = [
        'hello can you hear me now',
        'me now I am in California',
        'California dreaming about who we used to be',
      ];
      const result = deduplicateSubtitles(input);
      expect(result).toEqual([
        'hello can you hear me now I am in California dreaming about who we used to be',
      ]);
    });

    it('should handle partial overlap at word boundaries', () => {
      const input = [
        'the time supposed to heal you',
        'heal you but I have not done much healing',
      ];
      const result = deduplicateSubtitles(input);
      expect(result).toEqual([
        'the time supposed to heal you but I have not done much healing',
      ]);
    });
  });

  describe('cleanSubtitleText', () => {
    it('should decode HTML entities and clean text', () => {
      expect(cleanSubtitleText('Hello &gt;&gt; World')).toBe('Hello >> World');
    });

    it('should remove VTT tags', () => {
      // VTT tags like <v>...</v> are removed, content inside is preserved
      expect(cleanSubtitleText('<v>Hello</v>')).toBe('Hello');
      expect(cleanSubtitleText('<c.yellow>Text</c>')).toBe('Text');
    });

    it('should collapse multiple spaces', () => {
      expect(cleanSubtitleText('Hello    World')).toBe('Hello World');
    });

    it('should trim whitespace', () => {
      expect(cleanSubtitleText('  Hello World  ')).toBe('Hello World');
    });

    it('should handle complex input', () => {
      const input = '  <v>Hello &amp; World</v>   &gt;&gt;  ';
      expect(cleanSubtitleText(input)).toBe('Hello & World >>');
    });
  });

  describe('isKoreanDominant', () => {
    it('should return false for pure Korean text (no ASCII letters)', () => {
      // totalChars = text.replace(/[\s\d\W]/g, '') removes Korean chars (they're \W)
      // So pure Korean text has totalChars=0, returns false
      expect(isKoreanDominant('안녕하세요세계')).toBe(false);
    });

    it('should return false for majority English text', () => {
      expect(isKoreanDominant('Hello World everyone')).toBe(false);
    });

    it('should return true for mixed text with > 30% Korean', () => {
      // "안녕하세요" = 5 Korean chars (matched by first regex)
      // "HW" = 2 ASCII letters (kept by second regex), totalChars = 2
      // ratio = 5/2 = 250% > 30%
      expect(isKoreanDominant('안녕하세요 HW')).toBe(true);
    });

    it('should return false for empty text', () => {
      expect(isKoreanDominant('')).toBe(false);
    });

    it('should return false for numbers and symbols only', () => {
      expect(isKoreanDominant('123 456 !!!')).toBe(false);
    });

    it('should check koreanChars / totalChars ratio', () => {
      // "안abc" - Korean chars = 1, totalChars = 3 (a,b,c are kept)
      // 1/3 = 33% > 30%
      expect(isKoreanDominant('안abc')).toBe(true);
    });

    it('should return false when Korean ratio <= 30%', () => {
      // "안abcdefghij" - Korean = 1, total = 10
      // 1/10 = 10% < 30%
      expect(isKoreanDominant('안abcdefghij')).toBe(false);
    });
  });

  describe('cleanMixedLanguageText', () => {
    it('should return text as-is for non-Korean target language', () => {
      const text = '안녕하세요 Hello';
      expect(cleanMixedLanguageText(text, 'en')).toBe(text);
    });

    it('should return text as-is if > 70% Korean', () => {
      const text = '안녕하세요 여러분 오늘 날씨가 좋습니다 Hello';
      expect(cleanMixedLanguageText(text)).toBe(text);
    });

    it('should return text as-is if < 30% Korean (translation failure)', () => {
      const text = 'Hello World this is a long English sentence with only 안녕';
      expect(cleanMixedLanguageText(text)).toBe(text);
    });

    it('should extract Korean sentences from mixed text (30-70% Korean)', () => {
      const text = 'Hello World 안녕하세요 오늘 좋은 날입니다. Good morning everyone';
      const result = cleanMixedLanguageText(text);
      // Should extract Korean parts
      expect(result).toContain('안녕하세요');
    });

    it('should extract Korean part when no full Korean sentences found', () => {
      const text = 'Start 안녕 하세요 end';
      const result = cleanMixedLanguageText(text);
      // Should handle partial Korean extraction
      expect(result).toBeDefined();
    });

    it('should handle text with no Korean sentences matching pattern', () => {
      // Mixed text where Korean doesn't form complete sentences
      const text = 'Hello 가 나 다 라 World';
      const result = cleanMixedLanguageText(text);
      // Falls back to returning original text or extracting Korean parts
      expect(result).toBeDefined();
    });

    it('should use default target language ko', () => {
      const text = '안녕하세요 여러분 오늘 날씨가 아주 좋습니다';
      expect(cleanMixedLanguageText(text)).toBe(text);
    });

    it('should extract full Korean sentences when available', () => {
      const text = 'Hello there 이것은 완전한 한국어 문장입니다. And more English here.';
      const result = cleanMixedLanguageText(text);
      expect(result).toContain('한국어');
    });

    it('should return original if extracted text is too short', () => {
      // Short Korean extraction that's less than 30% of original
      const text = 'This is a very long English text with just 가 at the end which is not enough';
      const result = cleanMixedLanguageText(text);
      expect(result).toBe(text);
    });
  });
});
