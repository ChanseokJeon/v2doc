/**
 * 콘텐츠 병합기 테스트
 */

import { ContentMerger } from '../../../src/core/content-merger';
import { VideoMetadata, SubtitleResult, Screenshot, SubtitleSegment } from '../../../src/types';

describe('ContentMerger', () => {
  let merger: ContentMerger;

  beforeEach(() => {
    merger = new ContentMerger({
      screenshotConfig: { interval: 60, quality: 'low' },
    });
  });

  const mockMetadata: VideoMetadata = {
    id: 'test123',
    title: 'Test Video',
    description: '',
    duration: 300,
    thumbnail: '',
    channel: 'Test Channel',
    uploadDate: '20250101',
    viewCount: 0,
    availableCaptions: [],
  };

  // AND 조건 충족: 단어 15개 이상 + 음성 비율 20% 이상
  const mockSubtitles: SubtitleResult = {
    source: 'youtube',
    language: 'ko',
    segments: [
      // Section 0 (0-60s): 30s speech, ~20 words
      { start: 0, end: 15, text: 'This is the first segment of the video with many words to fill the content requirement' },
      { start: 30, end: 45, text: 'And this is the second segment here with additional words for testing purposes today' },
      // Section 1 (60-120s): 30s speech, ~20 words
      { start: 60, end: 75, text: 'Now we are in the third segment text with extra content to meet the threshold requirement' },
      { start: 90, end: 105, text: 'The fourth segment continues the story and adds more words to ensure proper filtering' },
      // Section 2 (120-180s): 30s speech, ~20 words
      { start: 120, end: 135, text: 'Finally the fifth segment wraps it up nicely with enough words to pass the filter' },
      { start: 150, end: 165, text: 'And here is a sixth segment to make sure we have enough content for the last section' },
    ],
  };

  const mockScreenshots: Screenshot[] = [
    { timestamp: 0, imagePath: '/tmp/0.jpg', width: 854, height: 480 },
    { timestamp: 60, imagePath: '/tmp/60.jpg', width: 854, height: 480 },
    { timestamp: 120, imagePath: '/tmp/120.jpg', width: 854, height: 480 },
  ];

  describe('merge', () => {
    it('should create sections for each screenshot', () => {
      const content = merger.merge(mockMetadata, mockSubtitles, mockScreenshots);

      expect(content.sections).toHaveLength(3);
      expect(content.metadata).toBe(mockMetadata);
    });

    it('should match subtitles to correct sections', () => {
      const content = merger.merge(mockMetadata, mockSubtitles, mockScreenshots);

      // 0-60초 구간 (2개 세그먼트)
      expect(content.sections[0].subtitles).toHaveLength(2);
      expect(content.sections[0].subtitles[0].text).toContain('first segment');
      expect(content.sections[0].subtitles[1].text).toContain('second segment');

      // 60-120초 구간 (2개 세그먼트)
      expect(content.sections[1].subtitles).toHaveLength(2);
      expect(content.sections[1].subtitles[0].text).toContain('third segment');
      expect(content.sections[1].subtitles[1].text).toContain('fourth segment');

      // 120-180초 구간 (2개 세그먼트)
      expect(content.sections[2].subtitles).toHaveLength(2);
      expect(content.sections[2].subtitles[0].text).toContain('fifth segment');
      expect(content.sections[2].subtitles[1].text).toContain('sixth segment');
    });

    it('should include screenshot in each section', () => {
      const content = merger.merge(mockMetadata, mockSubtitles, mockScreenshots);

      content.sections.forEach((section, i) => {
        expect(section.screenshot).toBe(mockScreenshots[i]);
        expect(section.timestamp).toBe(mockScreenshots[i].timestamp);
      });
    });
  });

  describe('combineSubtitleText', () => {
    it('should combine subtitle texts', () => {
      const segments: SubtitleSegment[] = [
        { start: 0, end: 10, text: 'Hello' },
        { start: 10, end: 20, text: 'World' },
      ];

      const combined = merger.combineSubtitleText(segments);
      expect(combined).toBe('Hello World');
    });

    it('should remove duplicate texts', () => {
      const segments: SubtitleSegment[] = [
        { start: 0, end: 10, text: 'Hello' },
        { start: 10, end: 20, text: 'Hello' },
        { start: 20, end: 30, text: 'World' },
      ];

      const combined = merger.combineSubtitleText(segments);
      expect(combined).toBe('Hello World');
    });

    it('should trim whitespace', () => {
      const segments: SubtitleSegment[] = [
        { start: 0, end: 10, text: '  Hello  ' },
        { start: 10, end: 20, text: '  World  ' },
      ];

      const combined = merger.combineSubtitleText(segments);
      expect(combined).toBe('Hello World');
    });
  });

  describe('groupByChapter', () => {
    it('should group sections into chapters', () => {
      const content = merger.merge(mockMetadata, mockSubtitles, mockScreenshots);
      const chapters = merger.groupByChapter(content.sections, 120); // 2분 챕터

      expect(chapters.length).toBeGreaterThan(0);
    });

    it('should create new chapter when duration exceeds threshold', () => {
      const sections = [
        { timestamp: 0, screenshot: mockScreenshots[0], subtitles: mockSubtitles.segments.slice(0, 2) },
        { timestamp: 60, screenshot: mockScreenshots[1], subtitles: mockSubtitles.segments.slice(2, 4) },
        { timestamp: 120, screenshot: mockScreenshots[2], subtitles: mockSubtitles.segments.slice(4, 6) },
      ];

      const chapters = merger.groupByChapter(sections, 60);

      expect(chapters.length).toBe(3);
    });

    it('should handle empty sections array', () => {
      const chapters = merger.groupByChapter([], 60);

      expect(chapters).toHaveLength(0);
    });
  });

  describe('mergeWithChapters', () => {
    const chapters = [
      { title: 'Intro', startTime: 0, endTime: 60 },
      { title: 'Main Content', startTime: 60, endTime: 120 },
      { title: 'Conclusion', startTime: 120, endTime: 180 },
    ];

    it('should merge content based on chapters', () => {
      const content = merger.mergeWithChapters(
        mockMetadata,
        mockSubtitles,
        mockScreenshots,
        chapters
      );

      expect(content.sections.length).toBe(3);
      expect(content.sections[0].sectionSummary?.summary).toBe('Intro');
      expect(content.sections[1].sectionSummary?.summary).toBe('Main Content');
      expect(content.sections[2].sectionSummary?.summary).toBe('Conclusion');
    });

    it('should skip chapters without screenshots', () => {
      const fewerScreenshots = mockScreenshots.slice(0, 2);
      const content = merger.mergeWithChapters(
        mockMetadata,
        mockSubtitles,
        fewerScreenshots,
        chapters
      );

      expect(content.sections.length).toBe(2);
    });

    it('should filter out chapters without enough content', () => {
      const sparseSubtitles: SubtitleResult = {
        source: 'youtube',
        language: 'ko',
        segments: [
          { start: 0, end: 5, text: 'Short text' }, // Not enough words
          { start: 60, end: 75, text: 'This is the third segment text with extra content to meet the threshold requirement' },
          { start: 90, end: 105, text: 'The fourth segment continues the story and adds more words to ensure proper filtering' },
        ],
      };

      const content = merger.mergeWithChapters(
        mockMetadata,
        sparseSubtitles,
        mockScreenshots,
        chapters
      );

      // First chapter should be filtered out due to insufficient content
      expect(content.sections.length).toBeLessThan(3);
    });

    it('should use chapter startTime as timestamp', () => {
      const content = merger.mergeWithChapters(
        mockMetadata,
        mockSubtitles,
        mockScreenshots,
        chapters
      );

      content.sections.forEach((section, i) => {
        expect(section.timestamp).toBe(chapters[i].startTime);
      });
    });
  });

  describe('merge edge cases', () => {
    it('should filter sections with insufficient word count', () => {
      const shortSubtitles: SubtitleResult = {
        source: 'youtube',
        language: 'ko',
        segments: [
          { start: 0, end: 30, text: 'Short text only five words here' }, // < 15 words
        ],
      };

      const content = merger.merge(mockMetadata, shortSubtitles, [mockScreenshots[0]]);

      expect(content.sections).toHaveLength(0);
    });

    it('should filter sections with insufficient speech ratio', () => {
      const lowRatioSubtitles: SubtitleResult = {
        source: 'youtube',
        language: 'ko',
        segments: [
          // Only 5 seconds of speech in 60 second interval = 8.3% < 20%
          { start: 0, end: 5, text: 'One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen' },
        ],
      };

      const content = merger.merge(mockMetadata, lowRatioSubtitles, [mockScreenshots[0]]);

      expect(content.sections).toHaveLength(0);
    });

    it('should handle subtitles spanning across sections', () => {
      const spanningSubtitles: SubtitleResult = {
        source: 'youtube',
        language: 'ko',
        segments: [
          // This segment spans from 50 to 70, should appear in both sections
          { start: 50, end: 70, text: 'Segment spanning across section boundaries with enough words for testing one two three four five' },
          { start: 0, end: 15, text: 'First segment of the video with many words to fill the content requirement for filtering' },
          { start: 30, end: 50, text: 'Second segment of the video continuing with more content to pass the threshold check' },
          { start: 70, end: 90, text: 'Third segment continues in second section with additional words for complete coverage' },
          { start: 100, end: 120, text: 'Fourth segment concludes the second section nicely with plenty of words for the test' },
        ],
      };

      const content = merger.merge(mockMetadata, spanningSubtitles, mockScreenshots.slice(0, 2));

      // Spanning segment should appear in first section (end in range)
      const firstSectionTexts = content.sections[0].subtitles.map((s) => s.text);
      expect(firstSectionTexts.some((t) => t.includes('spanning'))).toBe(true);
    });

    it('should handle empty screenshots array', () => {
      const content = merger.merge(mockMetadata, mockSubtitles, []);

      expect(content.sections).toHaveLength(0);
      expect(content.metadata).toBe(mockMetadata);
    });

    it('should handle zero interval gracefully', () => {
      const zeroIntervalMerger = new ContentMerger({
        screenshotConfig: { interval: 0, quality: 'low' },
      });

      const content = zeroIntervalMerger.merge(mockMetadata, mockSubtitles, mockScreenshots);

      // With zero interval, duration ratio check would be 0
      expect(content.sections).toHaveLength(0);
    });
  });

  describe('combineSubtitleText edge cases', () => {
    it('should handle empty array', () => {
      const combined = merger.combineSubtitleText([]);
      expect(combined).toBe('');
    });

    it('should skip empty text segments', () => {
      const segments: SubtitleSegment[] = [
        { start: 0, end: 10, text: 'Hello' },
        { start: 10, end: 20, text: '' },
        { start: 20, end: 30, text: '   ' },
        { start: 30, end: 40, text: 'World' },
      ];

      const combined = merger.combineSubtitleText(segments);
      expect(combined).toBe('Hello World');
    });
  });
});
