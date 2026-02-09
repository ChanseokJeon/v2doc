/**
 * PDF 생성기
 */

import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { PDFDocument as PDFLibDocument, PDFName } from 'pdf-lib';
// Note: puppeteer is loaded dynamically to avoid requiring it when not used
// Puppeteer is optional - loaded dynamically when needed
import { PDFContent, ExecutiveBrief } from '../types/index.js';
import { PDFConfig } from '../types/config.js';
import {
  formatTimestamp,
  buildTimestampUrl,
  cleanSubtitleText,
  deduplicateSubtitles,
  cleanMixedLanguageText,
} from '../utils/index.js';
import { logger } from '../utils/logger.js';
import { downloadImageToBuffer, getKoreanFontPaths, validateKoreanFont } from '../utils/image.js';
import { normalizeTextForPDF } from '../utils/text-normalizer.js';
import BriefGenerator from './brief-generator.js';
import PDFKitRenderer from './pdf/pdfkit-renderer.js';
import PuppeteerRenderer from './pdf/puppeteer-renderer.js';
import { Theme, loadTheme as loadThemeFromModule } from './pdf/themes.js';

// Re-export Theme for backward compatibility
export type { Theme };

// Font paths
const { regular: KOREAN_FONT_REGULAR, bold: KOREAN_FONT_BOLD } = getKoreanFontPaths();

/**
 * Process subtitles: clean, normalize, and deduplicate
 * Extracted helper to avoid DRY violations across multiple methods
 */
function processSubtitles(subtitles: { text: string }[], forPDF: boolean = true): string[] {
  const subtitleTexts = subtitles.map((sub) => {
    const cleaned = cleanSubtitleText(sub.text);
    const mixed = cleanMixedLanguageText(cleaned, 'ko');
    return forPDF ? normalizeTextForPDF(mixed) : mixed;
  });
  return deduplicateSubtitles(subtitleTexts);
}

export class PDFGenerator {
  private config: PDFConfig;
  private theme: Theme;
  private briefGenerator: BriefGenerator;
  private renderer: PDFKitRenderer;
  private puppeteerRenderer: PuppeteerRenderer;

  constructor(config: PDFConfig) {
    this.config = config;
    this.theme = this.loadTheme(config.theme);
    this.renderer = new PDFKitRenderer(config, this.theme);
    this.puppeteerRenderer = new PuppeteerRenderer(config, this.theme);
    this.briefGenerator = new BriefGenerator(config);
  }

  /**
   * PDF 문서에 한글 폰트 등록 (또는 폴백)
   */
  private registerFonts(doc: PDFKit.PDFDocument): void {
    if (validateKoreanFont()) {
      // Check for OTF fonts and warn
      const regularExt = path.extname(KOREAN_FONT_REGULAR).toLowerCase();
      const boldExt = path.extname(KOREAN_FONT_BOLD).toLowerCase();
      if (regularExt === '.otf' || boldExt === '.otf') {
        logger.warn('OTF 폰트는 한글 렌더링 문제가 발생할 수 있습니다. TTF 사용을 권장합니다.');
      }

      doc.registerFont('NotoSansKR-Regular', KOREAN_FONT_REGULAR);
      doc.registerFont('NotoSansKR-Bold', KOREAN_FONT_BOLD);
      logger.debug('한글 폰트 로드 완료');
    } else {
      logger.warn('한글 폰트를 찾을 수 없습니다. 기본 폰트를 사용합니다.');
      this.theme.fonts.title.name = 'Helvetica-Bold';
      this.theme.fonts.heading.name = 'Helvetica-Bold';
      this.theme.fonts.body.name = 'Helvetica';
      this.theme.fonts.timestamp.name = 'Helvetica';
    }
  }

  /**
   * PDF 생성
   */
  async generatePDF(content: PDFContent, outputPath: string): Promise<void> {
    // Use Puppeteer for minimal-neon layout (better Korean text support)
    if (this.config.layout === 'minimal-neon') {
      try {
        return await this.puppeteerRenderer.generatePDFViaPuppeteer(content, outputPath);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn(`Puppeteer PDF 생성 실패, PDFKit으로 폴백: ${errorMessage}`);
        // Fall through to PDFKit
      }
    }

    // 썸네일 다운로드 (비동기)
    let thumbnailBuffer: Buffer | null = null;
    if (content.metadata.thumbnail) {
      logger.debug('썸네일 다운로드 중...');
      thumbnailBuffer = await downloadImageToBuffer(content.metadata.thumbnail);
      if (thumbnailBuffer) {
        logger.debug('썸네일 다운로드 완료');
      }
    }

    return new Promise((resolve, reject) => {
      try {
        logger.info('PDF 생성 시작...');

        const doc = new PDFDocument({
          size: 'A4',
          margins: this.theme.margins,
          info: {
            Title: content.metadata.title,
            Author: content.metadata.channel,
            Subject: `YouTube: ${content.metadata.id}`,
            Creator: 'v2doc',
            Producer: 'v2doc - YouTube to PDF Converter',
            Keywords: 'YouTube, transcript, subtitle, screenshot',
          },
        });

        // Register Korean fonts (or fallback)
        this.registerFonts(doc);

        const writeStream = fs.createWriteStream(outputPath);
        doc.pipe(writeStream);

        // Auto-fill dark background on automatic page breaks for minimal-neon layout
        if (this.config.layout === 'minimal-neon') {
          doc.on('pageAdded', () => {
            this.renderer.fillMinimalNeonBackground(doc);
          });
        }

        // 페이지 푸터 추가 함수
        const addPageFooter = (pageNum: number, totalPages: number) => {
          const bottomY = doc.page.height - 30;
          const savedY = doc.y;
          doc
            .font(this.theme.fonts.timestamp.name)
            .fontSize(9)
            .fillColor(this.theme.colors.secondary);

          // 제목 (왼쪽) - NFC 정규화 적용
          const shortTitle =
            content.metadata.title.length > 45
              ? content.metadata.title.substring(0, 45) + '...'
              : content.metadata.title;
          doc.text(normalizeTextForPDF(shortTitle), this.theme.margins.left, bottomY, {
            width: doc.page.width / 2 - this.theme.margins.left,
            align: 'left',
            lineBreak: false,
          });

          // 페이지 번호 (오른쪽)
          doc.text(`${pageNum} / ${totalPages}`, doc.page.width / 2, bottomY, {
            width: doc.page.width / 2 - this.theme.margins.right,
            align: 'right',
            lineBreak: false,
          });

          doc.y = savedY;
        };

        // 표지 (썸네일 + 요약 포함)
        if (this.config.layout === 'minimal-neon') {
          this.renderer.renderMinimalNeonCoverPage(
            doc,
            content.metadata,
            thumbnailBuffer,
            content.sections.length,
            content.summary
          );
        } else {
          this.renderer.renderCoverPageSync(
            doc,
            content.metadata,
            thumbnailBuffer,
            content.sections.length,
            content.summary
          );
        }

        // 목차 (옵션)
        if (this.config.includeToc) {
          if (this.config.layout === 'minimal-neon') {
            this.renderer.renderMinimalNeonTOC(doc, content.sections, content.metadata.id);
          } else {
            this.renderer.renderTableOfContents(doc, content.sections, content.metadata.id);
          }
        }

        // 섹션 필터링: 최종 처리 후 콘텐츠가 부족한 섹션 제외
        const validSections = content.sections.filter((section) => {
          const dedupedTexts = processSubtitles(section.subtitles);
          const totalWords = dedupedTexts
            .join(' ')
            .split(/\s+/)
            .filter((w) => w.length > 0).length;
          return totalWords >= 10; // 최종 처리 후 10단어 이상만 포함
        });

        // 총 페이지 수 계산 (표지 + 목차? + 유효 섹션들)
        const totalPages = 1 + (this.config.includeToc ? 1 : 0) + validSections.length;
        let currentPage = 1; // 표지는 1페이지

        // PDF 아웃라인(북마크) 추가
        interface PDFDocWithOutline {
          outline?: {
            addItem: (title: string) => void;
          };
        }
        const outline = (doc as unknown as PDFDocWithOutline).outline;

        // 본문 페이지 렌더링 (유효 섹션만)
        for (let i = 0; i < validSections.length; i++) {
          const section = validSections[i];

          if (i > 0 || this.config.includeToc) {
            doc.addPage();
          }
          currentPage++;

          // 북마크 추가 (타임스탬프로)
          const bookmarkTitle = formatTimestamp(section.timestamp);
          if (outline) {
            outline.addItem(bookmarkTitle);
          }

          if (this.config.layout === 'minimal-neon') {
            this.renderer.renderMinimalNeonSection(doc, section, content.metadata.id, i);
          } else if (this.config.layout === 'vertical') {
            this.renderer.renderVerticalSection(doc, section, content.metadata.id);
          } else {
            this.renderer.renderHorizontalSection(doc, section, content.metadata.id);
          }

          // 현재 페이지에 푸터 추가 (표지 제외)
          addPageFooter(currentPage, totalPages);
        }

        doc.end();

        writeStream.on('finish', () => {
          void (async () => {
            try {
              await this.removeEmptyPages(outputPath);
              logger.success(`PDF 생성 완료: ${outputPath}`);
              resolve();
            } catch (e: unknown) {
              // Post-processing failure shouldn't fail the whole generation
              const errMsg = e instanceof Error ? e.message : String(e);
              logger.warn(`빈 페이지 제거 실패: ${errMsg}`);
              resolve();
            }
          })();
        });

        writeStream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Markdown 생성
   */
  async generateMarkdown(content: PDFContent, outputPath: string): Promise<void> {
    let md = `# ${content.metadata.title}\n\n`;
    md += `| 항목 | 내용 |\n`;
    md += `|------|------|\n`;
    md += `| **채널** | ${content.metadata.channel} |\n`;
    md += `| **영상 길이** | ${formatTimestamp(content.metadata.duration)} |\n`;
    md += `| **섹션** | ${content.sections.length}개 |\n`;
    md += `| **원본** | [YouTube](https://youtube.com/watch?v=${content.metadata.id}) |\n`;
    md += `| **생성일** | ${new Date().toISOString().split('T')[0]} |\n\n`;
    md += `---\n\n`;

    // 요약 (있는 경우)
    if (content.summary && content.summary.summary) {
      md += `## 📝 요약\n\n`;
      md += `${content.summary.summary}\n\n`;

      if (content.summary.keyPoints && content.summary.keyPoints.length > 0) {
        md += `### 💡 핵심 포인트\n\n`;
        for (const point of content.summary.keyPoints) {
          md += `- ${point}\n`;
        }
        md += `\n`;
      }
      md += `---\n\n`;
    }

    // 목차
    if (this.config.includeToc) {
      md += `## 목차\n\n`;
      for (const section of content.sections) {
        const timestamp = formatTimestamp(section.timestamp);
        md += `- [${timestamp}](#${timestamp.replace(/:/g, '')})\n`;
      }
      md += `\n---\n\n`;
    }

    // 본문
    for (const section of content.sections) {
      const timestamp = formatTimestamp(section.timestamp);
      const link = buildTimestampUrl(content.metadata.id, section.timestamp);

      md += `## [${timestamp}](${link}) {#${timestamp.replace(/:/g, '')}}\n\n`;

      // 스크린샷 (로컬 파일 참조)
      const imgName = path.basename(section.screenshot.imagePath);
      md += `![${timestamp} 스크린샷](./images/${imgName})\n\n`;

      // 섹션 요약 (있는 경우)
      if (section.sectionSummary && section.sectionSummary.summary) {
        md += `> **요약**: ${section.sectionSummary.summary}\n`;
        if (section.sectionSummary.keyPoints.length > 0) {
          md += `>\n`;
          for (const point of section.sectionSummary.keyPoints) {
            md += `> - ${point}\n`;
          }
        }
        md += `\n`;
      }

      // 자막 - 정리, 혼합 언어 정리, 중복 제거 (Markdown은 PDF 정규화 불필요)
      const dedupedTexts = processSubtitles(section.subtitles, false);

      if (dedupedTexts.length === 0) {
        md += `*(이 구간에 자막이 없습니다)*\n\n`;
      } else {
        for (const text of dedupedTexts) {
          md += `${text}\n\n`;
        }
      }

      md += `---\n\n`;
    }

    // footer
    md += `\n---\n\n*Generated by [v2doc](https://github.com/user/v2doc)*\n\n> 영상 정보 및 자막의 저작권은 원 제작자에게 있습니다.\n`;

    await fs.promises.writeFile(outputPath, md, 'utf-8');
    logger.success(`Markdown 생성 완료: ${outputPath}`);
  }

  /**
   * HTML 생성
   */
  async generateHTML(content: PDFContent, outputPath: string): Promise<void> {
    // Delegate to PuppeteerRenderer
    return this.puppeteerRenderer.generateHTML(content, outputPath);
  }

  async generateBriefPDF(brief: ExecutiveBrief, outputPath: string): Promise<void> {
    return this.briefGenerator.generateBriefPDF(brief, outputPath);
  }

  /**
   * Executive Brief Markdown 생성
   */
  async generateBriefMarkdown(brief: ExecutiveBrief, outputPath: string): Promise<void> {
    return this.briefGenerator.generateBriefMarkdown(brief, outputPath);
  }

  /**
   * Executive Brief HTML 생성
   */
  async generateBriefHTML(brief: ExecutiveBrief, outputPath: string): Promise<void> {
    return this.briefGenerator.generateBriefHTML(brief, outputPath);
  }

  /**
   * 테마 로드 (레이아웃 기반 선택 지원)
   */
  private loadTheme(themeName: string): Theme {
    // 레이아웃 기반 테마 선택
    if (this.config.layout === 'minimal-neon' || themeName === 'minimal-neon') {
      return loadThemeFromModule('minimal-neon');
    }
    return loadThemeFromModule(themeName);
  }

  /**
   * PDF 후처리 - 빈 페이지 제거
   * 콘텐츠 스트림 크기가 200바이트 미만인 페이지를 제거
   */
  private async removeEmptyPages(pdfPath: string): Promise<void> {
    const existingPdfBytes = await fs.promises.readFile(pdfPath);
    const pdfDoc = await PDFLibDocument.load(existingPdfBytes);

    const pages = pdfDoc.getPages();
    const pagesToRemove: number[] = [];

    for (let i = 0; i < pages.length; i++) {
      // 첫 2페이지 (표지 + 목차) 스킵
      if (i < 2) continue;

      const page = pages[i];
      const node = page.node;

      // 콘텐츠 스트림 참조 가져오기
      const contentsRef = node.get(PDFName.of('Contents'));
      let contentSize = 0;

      if (contentsRef) {
        // 실제 콘텐츠 스트림 크기 확인
        interface ResolvedContent {
          contents?: { length: number };
        }
        const resolved = node.context.lookup(contentsRef) as ResolvedContent;
        if (resolved && resolved.contents) {
          contentSize = resolved.contents.length;
        }
      }

      // 300바이트 미만의 페이지는 빈 페이지로 간주 (오버플로우 페이지 포함)
      if (contentSize < 300) {
        pagesToRemove.push(i);
      }
    }

    // 역순으로 제거하여 인덱스 유지
    for (let i = pagesToRemove.length - 1; i >= 0; i--) {
      pdfDoc.removePage(pagesToRemove[i]);
    }

    if (pagesToRemove.length > 0) {
      const pdfBytes = await pdfDoc.save();
      await fs.promises.writeFile(pdfPath, pdfBytes);
      logger.debug(`빈 페이지 ${pagesToRemove.length}개 제거됨`);
    }
  }

  /**
   * 사용 가능한 테마 목록
   */
  static getAvailableThemes(): string[] {
    return ['default', 'note', 'minimal', 'minimal-neon'];
  }

  /**
   * 사용 가능한 레이아웃 목록
   */
  static getAvailableLayouts(): string[] {
    return ['vertical', 'horizontal', 'minimal-neon'];
  }
}
