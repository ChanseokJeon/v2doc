/**
 * 텍스트 처리 유틸리티
 */

/**
 * HTML 엔티티 디코딩
 */
export function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&#x27;': "'",
    '&#x2F;': '/',
    '&#x60;': '`',
    '&#x3D;': '=',
  };

  let result = text;

  // Named entities
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replace(new RegExp(entity, 'gi'), char);
  }

  // Numeric entities (decimal)
  result = result.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));

  // Numeric entities (hex)
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  return result;
}

/**
 * 두 텍스트 간의 겹치는 부분 찾기
 * text1의 끝부분과 text2의 시작부분이 겹치는 길이 반환
 */
function findOverlap(text1: string, text2: string): number {
  const minLen = Math.min(text1.length, text2.length);
  for (let i = minLen; i >= 3; i--) {
    // 최소 3글자 이상 겹쳐야 유효한 중복으로 판단
    if (text1.slice(-i) === text2.slice(0, i)) {
      return i;
    }
  }
  return 0;
}

/**
 * 연속 중복 라인 제거 및 병합
 * YouTube 자동 자막에서 겹치는 부분을 제거하고 자연스럽게 병합
 */
export function deduplicateSubtitles(texts: string[]): string[] {
  if (texts.length === 0) return [];

  const result: string[] = [];
  let accumulated = '';

  for (const text of texts) {
    const trimmed = text.trim();
    if (!trimmed) continue;

    // 완전히 동일한 경우 스킵
    if (trimmed === accumulated) continue;

    // 이전 텍스트가 현재 텍스트의 시작 부분인 경우 (점진적 자막)
    if (accumulated && trimmed.startsWith(accumulated)) {
      accumulated = trimmed;
      continue;
    }

    // 현재 텍스트가 이전 텍스트의 시작 부분인 경우 스킵
    if (accumulated && accumulated.startsWith(trimmed)) {
      continue;
    }

    // 부분 중첩 확인 (YouTube 자동 자막 패턴)
    if (accumulated) {
      const overlap = findOverlap(accumulated, trimmed);
      if (overlap > 0) {
        // 겹치는 부분을 제거하고 병합
        accumulated = accumulated + trimmed.slice(overlap);
        continue;
      }
    }

    // 새로운 문장 시작
    if (accumulated) {
      result.push(accumulated);
    }
    accumulated = trimmed;
  }

  // 마지막 텍스트 추가
  if (accumulated) {
    result.push(accumulated);
  }

  return result;
}

/**
 * 자막 텍스트 정리
 * - HTML 엔티티 디코딩
 * - 중복 제거
 * - 공백 정리
 */
export function cleanSubtitleText(text: string): string {
  let cleaned = decodeHtmlEntities(text);

  // VTT 태그 제거
  cleaned = cleaned.replace(/<[^>]+>/g, '');

  // 연속 공백 정리
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}
