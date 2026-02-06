/**
 * Verification tests for fixtures - demonstrates usage and validates structure
 */

import { describe, it, expect } from '@jest/globals';
import {
  // Video metadata fixtures
  shortVideoMetadata,
  mediumVideoMetadata,
  longVideoMetadata,
  koreanVideoMetadata,
  getMetadataByType,
  getMetadataByDuration,
  // Subtitle fixtures
  shortEnglishSubtitles,
  koreanSubtitles,
  mixedLanguageSubtitles,
  generateSubtitles,
  getFullText,
  // Chapter fixtures
  tutorialChapters,
  conferenceTalkChapters,
  validateChapters,
  generateChapters,
  // Mock factory
  createMockVideoMetadata,
  createMockSubtitles,
  createMockChapters,
  createMockPDFContent,
  createMockE2EDataset,
  createKoreanMockData,
} from './index.js';

describe('Video Metadata Fixtures', () => {
  it('should have valid short video metadata', () => {
    expect(shortVideoMetadata.id).toBe('short123');
    expect(shortVideoMetadata.duration).toBe(180);
    expect(shortVideoMetadata.videoType).toBe('tutorial');
  });

  it('should have chapters in medium video', () => {
    expect(mediumVideoMetadata.chapters).toBeDefined();
    expect(mediumVideoMetadata.chapters?.length).toBe(4);
  });

  it('should have Korean captions in long video', () => {
    const koreanCaptions = longVideoMetadata.availableCaptions.find((c) => c.languageCode === 'ko');
    expect(koreanCaptions).toBeDefined();
  });

  it('should filter by video type', () => {
    const tutorials = getMetadataByType('tutorial');
    expect(tutorials.length).toBeGreaterThan(0);
    expect(tutorials.every((v) => v.videoType === 'tutorial')).toBe(true);
  });

  it('should filter by duration', () => {
    const shortVideos = getMetadataByDuration(0, 300);
    expect(shortVideos.length).toBeGreaterThan(0);
    expect(shortVideos.every((v) => v.duration <= 300)).toBe(true);
  });
});

describe('Subtitle Fixtures', () => {
  it('should have valid English subtitles', () => {
    expect(shortEnglishSubtitles.length).toBeGreaterThan(0);
    expect(shortEnglishSubtitles[0].text).toContain('Hello');
  });

  it('should have Korean subtitle text', () => {
    expect(koreanSubtitles[0].text).toMatch(/[가-힣]/);
  });

  it('should have mixed language subtitles', () => {
    const hasKorean = mixedLanguageSubtitles.some((s) => /[가-힣]/.test(s.text));
    const hasEnglish = mixedLanguageSubtitles.some((s) => /[a-zA-Z]/.test(s.text));
    expect(hasKorean).toBe(true);
    expect(hasEnglish).toBe(true);
  });

  it('should generate subtitles with specified parameters', () => {
    const subs = generateSubtitles(60, 10, 'en');
    expect(subs.length).toBe(6); // 60 seconds / 10 seconds interval
    expect(subs[0].start).toBe(0);
    expect(subs[0].end).toBe(10);
  });

  it('should concatenate subtitle text', () => {
    const fullText = getFullText(shortEnglishSubtitles);
    expect(fullText).toContain('Hello everyone');
    expect(fullText).toContain('TypeScript');
  });
});

describe('Chapter Fixtures', () => {
  it('should have valid tutorial chapters', () => {
    expect(tutorialChapters.length).toBe(5);
    expect(tutorialChapters[0].title).toBe('Introduction');
  });

  it('should have continuous time ranges', () => {
    const isValid = validateChapters(conferenceTalkChapters);
    expect(isValid).toBe(true);
  });

  it('should generate chapters with specified interval', () => {
    const chapters = generateChapters(900, 300, 'en');
    expect(chapters.length).toBe(3); // 900 seconds / 300 seconds interval
    expect(chapters[0].endTime).toBe(chapters[1].startTime);
  });

  it('should handle Korean chapter titles', () => {
    const koreanChaps = generateChapters(600, 300, 'ko');
    expect(koreanChaps[0].title).toContain('챕터');
  });
});

describe('Mock Factory', () => {
  it('should create mock video metadata with defaults', () => {
    const metadata = createMockVideoMetadata();
    expect(metadata.id).toBeDefined();
    expect(metadata.title).toBeDefined();
    expect(metadata.duration).toBeGreaterThan(0);
  });

  it('should override defaults', () => {
    const metadata = createMockVideoMetadata({
      id: 'custom123',
      duration: 1234,
    });
    expect(metadata.id).toBe('custom123');
    expect(metadata.duration).toBe(1234);
  });

  it('should create mock subtitles', () => {
    const subs = createMockSubtitles(10, 5);
    expect(subs.length).toBe(10);
    expect(subs[1].start).toBe(5);
  });

  it('should create mock chapters', () => {
    const chapters = createMockChapters(4, 200);
    expect(chapters.length).toBe(4);
    expect(chapters[0].endTime).toBe(200);
  });

  it('should create complete PDF content', () => {
    const content = createMockPDFContent();
    expect(content.metadata).toBeDefined();
    expect(content.sections.length).toBeGreaterThan(0);
    expect(content.summary).toBeDefined();
  });

  it('should create E2E dataset with all components', () => {
    const dataset = createMockE2EDataset();
    expect(dataset.metadata).toBeDefined();
    expect(dataset.subtitles).toBeDefined();
    expect(dataset.chapters).toBeDefined();
    expect(dataset.screenshots).toBeDefined();
    expect(dataset.pdfContent).toBeDefined();
  });

  it('should create Korean mock data', () => {
    const data = createKoreanMockData();
    expect(data.metadata.title).toMatch(/[가-힣]/);
    expect(data.subtitles[0].text).toMatch(/[가-힣]/);
    expect(data.chapters[0].title).toMatch(/[가-힣]/);
  });
});

describe('Type Safety', () => {
  it('should have proper TypeScript types', () => {
    // This test verifies that fixtures match actual types (compile-time check)
    const metadata = koreanVideoMetadata;
    const _id: string = metadata.id;
    const _duration: number = metadata.duration;
    const _chapters = metadata.chapters;

    expect(metadata).toBeDefined();
  });

  it('should work with destructuring', () => {
    const { id, title, duration } = shortVideoMetadata;
    expect(id).toBe('short123');
    expect(title).toBeDefined();
    expect(duration).toBe(180);
  });
});
