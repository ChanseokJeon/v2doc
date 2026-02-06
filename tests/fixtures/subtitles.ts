/**
 * Test fixtures for subtitle data
 */

import { SubtitleSegment, SubtitleResult } from '../../src/types/index.js';

/**
 * Short English subtitle segments (tutorial-style)
 */
export const shortEnglishSubtitles: SubtitleSegment[] = [
  { start: 0, end: 3.5, text: 'Hello everyone, welcome back!' },
  { start: 3.5, end: 7.2, text: "Today we're going to learn about TypeScript generics." },
  { start: 7.2, end: 11.8, text: 'Generics allow you to write flexible and reusable code.' },
  { start: 11.8, end: 15.5, text: 'Let me show you a simple example.' },
  { start: 15.5, end: 20.0, text: 'Here we have a function that works with any type.' },
];

/**
 * Korean subtitle segments (lecture-style)
 */
export const koreanSubtitles: SubtitleSegment[] = [
  { start: 0, end: 4.2, text: '안녕하세요, 오늘은 리액트 훅에 대해 알아보겠습니다.' },
  { start: 4.2, end: 8.5, text: '훅은 함수 컴포넌트에서 상태와 생명주기를 사용할 수 있게 해줍니다.' },
  { start: 8.5, end: 13.0, text: '가장 기본적인 훅은 useState와 useEffect입니다.' },
  { start: 13.0, end: 17.8, text: 'useState는 컴포넌트의 상태를 관리하는데 사용됩니다.' },
  { start: 17.8, end: 23.0, text: 'useEffect는 부수 효과를 처리하는데 사용됩니다.' },
];

/**
 * Mixed language subtitles (Korean with English technical terms)
 */
export const mixedLanguageSubtitles: SubtitleSegment[] = [
  { start: 0, end: 5.0, text: 'API를 호출할 때는 async/await 패턴을 사용하세요.' },
  { start: 5.0, end: 10.2, text: 'try-catch 블록으로 error handling을 해야 합니다.' },
  { start: 10.2, end: 15.5, text: 'Promise를 반환하는 함수는 async 키워드를 붙입니다.' },
  { start: 15.5, end: 20.0, text: 'await는 async 함수 내에서만 사용할 수 있습니다.' },
];

/**
 * Long-form subtitle segments (conference talk)
 */
export const longConferenceSubtitles: SubtitleSegment[] = [
  {
    start: 0,
    end: 6.0,
    text: "Good morning everyone. I'm excited to be here at JSConf to talk about the future of JavaScript.",
  },
  {
    start: 6.0,
    end: 12.5,
    text: "We've come a long way since ES5, and the language continues to evolve at a rapid pace.",
  },
  {
    start: 12.5,
    end: 18.0,
    text: 'Today I want to focus on three major areas: type safety, async patterns, and tooling.',
  },
  {
    start: 18.0,
    end: 24.5,
    text: 'First, let\'s talk about type safety. TypeScript has become the de facto standard for large applications.',
  },
  {
    start: 24.5,
    end: 30.0,
    text: "But we're also seeing new proposals for native type annotations in JavaScript.",
  },
  {
    start: 30.0,
    end: 36.0,
    text: 'This could fundamentally change how we write JavaScript in the future.',
  },
  {
    start: 36.0,
    end: 42.0,
    text: 'Moving on to async patterns, async/await has revolutionized how we handle asynchronous code.',
  },
  {
    start: 42.0,
    end: 48.0,
    text: 'But there are still pain points, especially around error handling and cancellation.',
  },
  {
    start: 48.0,
    end: 54.0,
    text: "That's where proposals like async context and abort signals come into play.",
  },
  {
    start: 54.0,
    end: 60.0,
    text: 'Finally, tooling has never been better. Build tools are faster, developer experience is improving.',
  },
];

/**
 * Subtitles with duplicates (for deduplication testing)
 */
export const subtitlesWithDuplicates: SubtitleSegment[] = [
  { start: 0, end: 2.0, text: 'Hello world' },
  { start: 2.0, end: 4.0, text: 'Hello world' },
  { start: 4.0, end: 6.0, text: 'This is a test' },
  { start: 6.0, end: 8.0, text: 'This is a test' },
  { start: 8.0, end: 10.0, text: 'Different content' },
];

/**
 * Subtitles with special characters and formatting
 */
export const subtitlesWithSpecialChars: SubtitleSegment[] = [
  { start: 0, end: 3.0, text: '[Music playing]' },
  { start: 3.0, end: 6.0, text: 'Use `async` and `await` keywords' },
  { start: 6.0, end: 9.0, text: 'The function returns a Promise<T>' },
  { start: 9.0, end: 12.0, text: "Don't forget error handling!" },
  { start: 12.0, end: 15.0, text: 'Check out https://example.com' },
];

/**
 * Subtitles with timestamps close together (rapid speech)
 */
export const rapidSubtitles: SubtitleSegment[] = [
  { start: 0, end: 1.0, text: 'First,' },
  { start: 1.0, end: 2.0, text: 'install the package.' },
  { start: 2.0, end: 3.0, text: 'Then,' },
  { start: 3.0, end: 4.0, text: 'import it.' },
  { start: 4.0, end: 5.0, text: 'Finally,' },
  { start: 5.0, end: 6.0, text: 'use it!' },
];

/**
 * Empty subtitle segments (edge case)
 */
export const emptySubtitles: SubtitleSegment[] = [];

/**
 * SubtitleResult with YouTube source (Korean)
 */
export const koreanYouTubeResult: SubtitleResult = {
  source: 'youtube',
  language: 'ko',
  segments: koreanSubtitles,
};

/**
 * SubtitleResult with YouTube source (English)
 */
export const englishYouTubeResult: SubtitleResult = {
  source: 'youtube',
  language: 'en',
  segments: shortEnglishSubtitles,
};

/**
 * SubtitleResult with Whisper source
 */
export const whisperResult: SubtitleResult = {
  source: 'whisper',
  language: 'en',
  segments: longConferenceSubtitles,
};

/**
 * Multiple subtitle results (for testing subtitle selection)
 */
export const multipleSubtitleResults: SubtitleResult[] = [
  koreanYouTubeResult,
  englishYouTubeResult,
  whisperResult,
];

/**
 * Helper: Generate subtitle segments for a given duration
 */
export function generateSubtitles(
  durationSeconds: number,
  intervalSeconds: number = 5,
  language: 'en' | 'ko' = 'en'
): SubtitleSegment[] {
  const segments: SubtitleSegment[] = [];
  const templates = {
    en: [
      'This is segment',
      'Here we discuss',
      'Moving on to',
      'Let me explain',
      'As you can see',
      'This demonstrates',
    ],
    ko: [
      '이것은 섹션입니다',
      '여기서 다루는 내용은',
      '다음으로 넘어가서',
      '설명드리겠습니다',
      '보시는 것처럼',
      '이것이 보여주는 것은',
    ],
  };

  let currentTime = 0;
  let index = 0;

  while (currentTime < durationSeconds) {
    const template = templates[language][index % templates[language].length];
    segments.push({
      start: currentTime,
      end: Math.min(currentTime + intervalSeconds, durationSeconds),
      text: `${template} ${index + 1}`,
    });
    currentTime += intervalSeconds;
    index++;
  }

  return segments;
}

/**
 * Helper: Get subtitle text concatenated
 */
export function getFullText(segments: SubtitleSegment[]): string {
  return segments.map((s) => s.text).join(' ');
}

/**
 * Helper: Get subtitles for a time range
 */
export function getSubtitlesInRange(
  segments: SubtitleSegment[],
  startTime: number,
  endTime: number
): SubtitleSegment[] {
  return segments.filter((s) => s.start >= startTime && s.end <= endTime);
}
