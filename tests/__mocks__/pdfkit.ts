import { Writable } from 'stream';
import { EventEmitter } from 'events';

/**
 * Comprehensive PDFKit Mock for Testing
 *
 * This mock implements the core PDFKit API used by pdf-generator.ts:
 * - Document creation (new PDFDocument)
 * - Page management (addPage, page info)
 * - Text rendering (text, widthOfString, heightOfString)
 * - Image rendering (image)
 * - Font management (registerFont, font, fontSize)
 * - Color management (fillColor, strokeColor)
 * - Vector graphics (moveTo, lineTo, stroke, etc.)
 * - Stream output (pipe, end, on)
 * - Call tracking for assertions
 */

export interface MockPDFPage {
  width: number;
  height: number;
  margins: {
    top: number;
    left: number;
    bottom: number;
    right: number;
  };
  size: string;
  layout: string;
}

export interface TextOptions {
  width?: number;
  height?: number;
  align?: 'left' | 'center' | 'right' | 'justify';
  lineGap?: number;
  lineBreak?: boolean;
  indent?: number;
  paragraphGap?: number;
  continued?: boolean;
  link?: string;
}

export interface ImageOptions {
  width?: number;
  height?: number;
  fit?: [number, number];
  align?: 'center' | 'right';
  valign?: 'center' | 'bottom';
}

export interface PDFDocumentOptions {
  size?: string | [number, number];
  layout?: 'portrait' | 'landscape';
  margins?: {
    top: number;
    left: number;
    bottom: number;
    right: number;
  };
  autoFirstPage?: boolean;
  bufferPages?: boolean;
}

/**
 * Mock call tracking for assertions
 */
export interface MockCallTracker {
  text: Array<{ text: string; x?: number; y?: number; options?: TextOptions }>;
  image: Array<{ src: Buffer | string; x?: number; y?: number; options?: ImageOptions }>;
  registerFont: Array<{ name: string; src: string; family?: string }>;
  font: Array<{ name: string; size?: number }>;
  fontSize: Array<{ size: number }>;
  fillColor: Array<{ color: string; opacity?: number }>;
  strokeColor: Array<{ color: string; opacity?: number }>;
  addPage: Array<{ options?: PDFDocumentOptions }>;
  moveTo: Array<{ x: number; y: number }>;
  lineTo: Array<{ x: number; y: number }>;
  stroke: Array<{}>;
  moveDown: Array<{ lines: number }>;
  moveUp: Array<{ lines: number }>;
  pipe: Array<{ destination: any }>;
  end: Array<{}>;
}

/**
 * Mock PDFDocument class
 */
export class MockPDFDocument extends EventEmitter {
  public page: MockPDFPage;
  public x: number = 0;
  public y: number = 0;
  public calls: MockCallTracker;

  private currentFont: string = 'Helvetica';
  private currentFontSize: number = 12;
  private currentFillColor: string = '#000000';
  private currentStrokeColor: string = '#000000';
  private pipedStream: Writable | null = null;

  constructor(options?: PDFDocumentOptions) {
    super();

    // Initialize page with defaults or provided options
    const margins = options?.margins || { top: 72, left: 72, bottom: 72, right: 72 };
    const size = options?.size || 'letter';
    const layout = options?.layout || 'portrait';

    let width = 612;  // letter width in points
    let height = 792; // letter height in points

    if (size === 'A4') {
      width = 595;
      height = 842;
    } else if (Array.isArray(size)) {
      [width, height] = size;
    }

    if (layout === 'landscape') {
      [width, height] = [height, width];
    }

    this.page = {
      width,
      height,
      margins,
      size: typeof size === 'string' ? size : 'custom',
      layout
    };

    // Initialize call tracking
    this.calls = {
      text: [],
      image: [],
      registerFont: [],
      font: [],
      fontSize: [],
      fillColor: [],
      strokeColor: [],
      addPage: [],
      moveTo: [],
      lineTo: [],
      stroke: [],
      moveDown: [],
      moveUp: [],
      pipe: [],
      end: []
    };

    // Set initial cursor position
    this.x = margins.left;
    this.y = margins.top;
  }

  // Font methods
  registerFont(name: string, src: string, family?: string): this {
    this.calls.registerFont.push({ name, src, family });
    return this;
  }

  font(name: string, size?: number): this {
    this.calls.font.push({ name, size });
    this.currentFont = name;
    if (size !== undefined) {
      this.currentFontSize = size;
    }
    return this;
  }

  fontSize(size: number): this {
    this.calls.fontSize.push({ size });
    this.currentFontSize = size;
    return this;
  }

  // Color methods
  fillColor(color: string, opacity?: number): this {
    this.calls.fillColor.push({ color, opacity });
    this.currentFillColor = color;
    return this;
  }

  strokeColor(color: string, opacity?: number): this {
    this.calls.strokeColor.push({ color, opacity });
    this.currentStrokeColor = color;
    return this;
  }

  // Text methods
  text(text: string, x?: number, y?: number, options?: TextOptions): this;
  text(text: string, options?: TextOptions): this;
  text(text: string, xOrOptions?: number | TextOptions, y?: number, options?: TextOptions): this {
    let finalX: number | undefined;
    let finalY: number | undefined;
    let finalOptions: TextOptions | undefined;

    if (typeof xOrOptions === 'number') {
      finalX = xOrOptions;
      finalY = y;
      finalOptions = options;
    } else {
      finalOptions = xOrOptions;
    }

    this.calls.text.push({ text, x: finalX, y: finalY, options: finalOptions });

    // Update cursor position (simplified)
    if (finalX !== undefined && finalY !== undefined) {
      this.x = finalX;
      this.y = finalY;
    }

    // Estimate text height and move cursor down (simplified)
    const lineHeight = this.currentFontSize * 1.2;
    const lines = text.split('\n').length;
    this.y += lineHeight * lines;

    return this;
  }

  widthOfString(text: string, options?: TextOptions): number {
    // Simplified: assume average character width is 0.6 * fontSize
    const avgCharWidth = this.currentFontSize * 0.6;
    return text.length * avgCharWidth;
  }

  heightOfString(text: string, options?: TextOptions): number {
    // Simplified: calculate based on line height and number of lines
    const lineHeight = this.currentFontSize * 1.2;
    const width = options?.width || (this.page.width - this.page.margins.left - this.page.margins.right);
    const charWidth = this.currentFontSize * 0.6;
    const charsPerLine = Math.floor(width / charWidth);
    const lines = Math.ceil(text.length / charsPerLine) + (text.split('\n').length - 1);
    return lines * lineHeight;
  }

  // Image methods
  image(src: Buffer | string, x?: number, y?: number, options?: ImageOptions): this;
  image(src: Buffer | string, options?: ImageOptions): this;
  image(src: Buffer | string, xOrOptions?: number | ImageOptions, y?: number, options?: ImageOptions): this {
    let finalX: number | undefined;
    let finalY: number | undefined;
    let finalOptions: ImageOptions | undefined;

    if (typeof xOrOptions === 'number') {
      finalX = xOrOptions;
      finalY = y;
      finalOptions = options;
    } else {
      finalOptions = xOrOptions;
    }

    this.calls.image.push({ src, x: finalX, y: finalY, options: finalOptions });

    // Update cursor position
    const imageHeight = finalOptions?.height || 100;
    this.y += imageHeight;

    return this;
  }

  // Page methods
  addPage(options?: PDFDocumentOptions): this {
    this.calls.addPage.push({ options });

    // Reset cursor to top of new page
    this.x = this.page.margins.left;
    this.y = this.page.margins.top;

    return this;
  }

  // Movement methods
  moveDown(lines: number = 1): this {
    this.calls.moveDown.push({ lines });
    const lineHeight = this.currentFontSize * 1.2;
    this.y += lineHeight * lines;
    return this;
  }

  moveUp(lines: number = 1): this {
    this.calls.moveUp.push({ lines });
    const lineHeight = this.currentFontSize * 1.2;
    this.y -= lineHeight * lines;
    return this;
  }

  // Vector graphics methods
  moveTo(x: number, y: number): this {
    this.calls.moveTo.push({ x, y });
    this.x = x;
    this.y = y;
    return this;
  }

  lineTo(x: number, y: number): this {
    this.calls.lineTo.push({ x, y });
    this.x = x;
    this.y = y;
    return this;
  }

  stroke(): this {
    this.calls.stroke.push({});
    return this;
  }

  // Stream methods
  pipe(destination: Writable): this {
    this.calls.pipe.push({ destination });
    this.pipedStream = destination;
    return this;
  }

  end(): void {
    this.calls.end.push({});

    // Simulate async completion
    process.nextTick(() => {
      this.emit('finish');
      if (this.pipedStream) {
        this.pipedStream.emit('finish');
      }
    });
  }

  // Helper method to reset call tracking (useful for tests)
  resetCalls(): void {
    this.calls = {
      text: [],
      image: [],
      registerFont: [],
      font: [],
      fontSize: [],
      fillColor: [],
      strokeColor: [],
      addPage: [],
      moveTo: [],
      lineTo: [],
      stroke: [],
      moveDown: [],
      moveUp: [],
      pipe: [],
      end: []
    };
  }
}

// Default export matching pdfkit's export style
const PDFDocument = MockPDFDocument;
export default PDFDocument;
