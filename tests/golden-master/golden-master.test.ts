/**
 * Golden Master Tests
 *
 * 리팩토링 전후 동작 일관성 검증
 * - 베이스라인 해시와 현재 출력 해시 비교
 * - 의도하지 않은 동작 변경 감지
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  normalizeTextForPDF,
  sanitizeForAI,
  sanitizeAndNormalize,
} from '../../src/utils/text-normalizer';

const hash = (str: string): string =>
  crypto.createHash('sha256').update(str, 'utf8').digest('hex');

// 테스트 입력 데이터 (capture-golden-hashes.ts와 동일)
const testInputs = {
  korean: '한글 테스트 텍스트입니다.',
  mixed: 'Hello 안녕 World 세계',
  special: '→ ← • ♪ © ® ™',
  extendedLatin: 'Ħħ ıİ łŁ ñÑ øØ ßþÞ đĐ',
  controlChars: 'Hello\x00\x01\x02World\x7F',
  zeroWidth: 'Text\u200B\u200C\u200D\uFEFFHere',
  privateUse: 'Test\uE000\uF8FFText',
  hangulExtended: '한글\uD7B0\uD7FF\uA960\uA97F테스트',
  garbagePattern: '가abc나def라',
  aiGarbage: '이IJKLM것89:;은테스트',
};

describe('Golden Master Tests', () => {
  let baselineHashes: any;

  beforeAll(() => {
    const hashesPath = path.join(__dirname, 'hashes.json');

    if (!fs.existsSync(hashesPath)) {
      throw new Error(
        `Golden master hashes not found at ${hashesPath}. ` +
          'Run "npx tsx scripts/capture-golden-hashes.ts" first.'
      );
    }

    baselineHashes = JSON.parse(fs.readFileSync(hashesPath, 'utf8'));
  });

  describe('normalizeTextForPDF', () => {
    it('should produce consistent output for Korean text', () => {
      const output = normalizeTextForPDF(testInputs.korean);
      const outputHash = hash(output);
      expect(outputHash).toBe(
        baselineHashes.hashes.textNormalizer.normalizeTextForPDF.korean
      );
    });

    it('should produce consistent output for mixed language text', () => {
      const output = normalizeTextForPDF(testInputs.mixed);
      const outputHash = hash(output);
      expect(outputHash).toBe(
        baselineHashes.hashes.textNormalizer.normalizeTextForPDF.mixed
      );
    });

    it('should produce consistent output for special characters', () => {
      const output = normalizeTextForPDF(testInputs.special);
      const outputHash = hash(output);
      expect(outputHash).toBe(
        baselineHashes.hashes.textNormalizer.normalizeTextForPDF.special
      );
    });

    it('should produce consistent output for extended Latin characters', () => {
      const output = normalizeTextForPDF(testInputs.extendedLatin);
      const outputHash = hash(output);
      expect(outputHash).toBe(
        baselineHashes.hashes.textNormalizer.normalizeTextForPDF.extendedLatin
      );
    });

    it('should produce consistent output for control characters', () => {
      const output = normalizeTextForPDF(testInputs.controlChars);
      const outputHash = hash(output);
      expect(outputHash).toBe(
        baselineHashes.hashes.textNormalizer.normalizeTextForPDF.controlChars
      );
    });

    it('should produce consistent output for zero-width characters', () => {
      const output = normalizeTextForPDF(testInputs.zeroWidth);
      const outputHash = hash(output);
      expect(outputHash).toBe(
        baselineHashes.hashes.textNormalizer.normalizeTextForPDF.zeroWidth
      );
    });

    it('should produce consistent output for private use area characters', () => {
      const output = normalizeTextForPDF(testInputs.privateUse);
      const outputHash = hash(output);
      expect(outputHash).toBe(
        baselineHashes.hashes.textNormalizer.normalizeTextForPDF.privateUse
      );
    });

    it('should produce consistent output for Hangul extended characters', () => {
      const output = normalizeTextForPDF(testInputs.hangulExtended);
      const outputHash = hash(output);
      expect(outputHash).toBe(
        baselineHashes.hashes.textNormalizer.normalizeTextForPDF.hangulExtended
      );
    });

    it('should produce consistent output for garbage patterns', () => {
      const output = normalizeTextForPDF(testInputs.garbagePattern);
      const outputHash = hash(output);
      expect(outputHash).toBe(
        baselineHashes.hashes.textNormalizer.normalizeTextForPDF.garbagePattern
      );
    });

    it('should produce consistent output for empty string', () => {
      const output = normalizeTextForPDF('');
      const outputHash = hash(output);
      expect(outputHash).toBe(
        baselineHashes.hashes.textNormalizer.normalizeTextForPDF.emptyString
      );
    });
  });

  describe('sanitizeForAI', () => {
    it('should produce consistent output for Korean text', () => {
      const output = sanitizeForAI(testInputs.korean);
      const outputHash = hash(output);
      expect(outputHash).toBe(
        baselineHashes.hashes.textNormalizer.sanitizeForAI.korean
      );
    });

    it('should produce consistent output for mixed language text', () => {
      const output = sanitizeForAI(testInputs.mixed);
      const outputHash = hash(output);
      expect(outputHash).toBe(
        baselineHashes.hashes.textNormalizer.sanitizeForAI.mixed
      );
    });

    it('should produce consistent output for AI garbage patterns', () => {
      const output = sanitizeForAI(testInputs.aiGarbage);
      const outputHash = hash(output);
      expect(outputHash).toBe(
        baselineHashes.hashes.textNormalizer.sanitizeForAI.aiGarbage
      );
    });

    it('should produce consistent output for Hangul extended characters', () => {
      const output = sanitizeForAI(testInputs.hangulExtended);
      const outputHash = hash(output);
      expect(outputHash).toBe(
        baselineHashes.hashes.textNormalizer.sanitizeForAI.hangulExtended
      );
    });

    it('should produce consistent output for empty string', () => {
      const output = sanitizeForAI('');
      const outputHash = hash(output);
      expect(outputHash).toBe(
        baselineHashes.hashes.textNormalizer.sanitizeForAI.emptyString
      );
    });
  });

  describe('sanitizeAndNormalize', () => {
    it('should produce consistent output for Korean text', () => {
      const output = sanitizeAndNormalize(testInputs.korean);
      const outputHash = hash(output);
      expect(outputHash).toBe(
        baselineHashes.hashes.textNormalizer.sanitizeAndNormalize.korean
      );
    });

    it('should produce consistent output for mixed language text', () => {
      const output = sanitizeAndNormalize(testInputs.mixed);
      const outputHash = hash(output);
      expect(outputHash).toBe(
        baselineHashes.hashes.textNormalizer.sanitizeAndNormalize.mixed
      );
    });

    it('should produce consistent output for special characters', () => {
      const output = sanitizeAndNormalize(testInputs.special);
      const outputHash = hash(output);
      expect(outputHash).toBe(
        baselineHashes.hashes.textNormalizer.sanitizeAndNormalize.special
      );
    });

    it('should produce consistent output for AI garbage patterns', () => {
      const output = sanitizeAndNormalize(testInputs.aiGarbage);
      const outputHash = hash(output);
      expect(outputHash).toBe(
        baselineHashes.hashes.textNormalizer.sanitizeAndNormalize.aiGarbage
      );
    });

    it('should produce consistent output for empty string', () => {
      const output = sanitizeAndNormalize('');
      const outputHash = hash(output);
      expect(outputHash).toBe(
        baselineHashes.hashes.textNormalizer.sanitizeAndNormalize.emptyString
      );
    });
  });

  describe('Meta Tests', () => {
    it('should have valid baseline version', () => {
      expect(baselineHashes.version).toBeDefined();
      expect(baselineHashes.version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should have valid capture timestamp', () => {
      expect(baselineHashes.capturedAt).toBeDefined();
      expect(() => new Date(baselineHashes.capturedAt)).not.toThrow();
    });

    it('should have all expected hash categories', () => {
      expect(baselineHashes.hashes).toBeDefined();
      expect(baselineHashes.hashes.textNormalizer).toBeDefined();
      expect(
        baselineHashes.hashes.textNormalizer.normalizeTextForPDF
      ).toBeDefined();
      expect(baselineHashes.hashes.textNormalizer.sanitizeForAI).toBeDefined();
      expect(
        baselineHashes.hashes.textNormalizer.sanitizeAndNormalize
      ).toBeDefined();
    });
  });
});
