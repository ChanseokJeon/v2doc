/**
 * Golden Master 베이스라인 캡처 스크립트
 *
 * 현재 코드의 출력 해시를 캡처하여 hashes.json에 저장
 * 리팩토링 전에 실행하여 베이스라인을 기록
 */
import {
  normalizeTextForPDF,
  sanitizeForAI,
  sanitizeAndNormalize,
} from '../src/utils/text-normalizer';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const hash = (str: string): string =>
  crypto.createHash('sha256').update(str, 'utf8').digest('hex');

// 테스트 입력 데이터
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

// 각 함수에 대한 해시 생성
const hashes = {
  version: '1.0.0',
  capturedAt: new Date().toISOString(),
  hashes: {
    textNormalizer: {
      normalizeTextForPDF: {
        korean: hash(normalizeTextForPDF(testInputs.korean)),
        mixed: hash(normalizeTextForPDF(testInputs.mixed)),
        special: hash(normalizeTextForPDF(testInputs.special)),
        extendedLatin: hash(normalizeTextForPDF(testInputs.extendedLatin)),
        controlChars: hash(normalizeTextForPDF(testInputs.controlChars)),
        zeroWidth: hash(normalizeTextForPDF(testInputs.zeroWidth)),
        privateUse: hash(normalizeTextForPDF(testInputs.privateUse)),
        hangulExtended: hash(normalizeTextForPDF(testInputs.hangulExtended)),
        garbagePattern: hash(normalizeTextForPDF(testInputs.garbagePattern)),
        emptyString: hash(normalizeTextForPDF('')),
      },
      sanitizeForAI: {
        korean: hash(sanitizeForAI(testInputs.korean)),
        mixed: hash(sanitizeForAI(testInputs.mixed)),
        aiGarbage: hash(sanitizeForAI(testInputs.aiGarbage)),
        hangulExtended: hash(sanitizeForAI(testInputs.hangulExtended)),
        emptyString: hash(sanitizeForAI('')),
      },
      sanitizeAndNormalize: {
        korean: hash(sanitizeAndNormalize(testInputs.korean)),
        mixed: hash(sanitizeAndNormalize(testInputs.mixed)),
        special: hash(sanitizeAndNormalize(testInputs.special)),
        aiGarbage: hash(sanitizeAndNormalize(testInputs.aiGarbage)),
        emptyString: hash(sanitizeAndNormalize('')),
      },
    },
  },
};

// hashes.json 저장
const outputPath = path.join(
  __dirname,
  '..',
  'tests',
  'golden-master',
  'hashes.json'
);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(hashes, null, 2), 'utf8');

console.log('✅ Golden master hashes captured successfully!');
console.log(`📁 Saved to: ${outputPath}`);
console.log('\nSample hashes:');
console.log(
  `  normalizeTextForPDF(korean): ${hashes.hashes.textNormalizer.normalizeTextForPDF.korean.slice(0, 16)}...`
);
console.log(
  `  sanitizeForAI(aiGarbage): ${hashes.hashes.textNormalizer.sanitizeForAI.aiGarbage.slice(0, 16)}...`
);
