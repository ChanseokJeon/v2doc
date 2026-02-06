import PDFDocument, { MockPDFDocument } from './pdfkit';
import { Writable } from 'stream';

describe('PDFKit Mock', () => {
  let doc: MockPDFDocument;

  beforeEach(() => {
    doc = new PDFDocument();
  });

  describe('Document Creation', () => {
    it('should create a document with default options', () => {
      expect(doc.page.width).toBe(612); // letter width
      expect(doc.page.height).toBe(792); // letter height
      expect(doc.page.margins).toEqual({
        top: 72,
        left: 72,
        bottom: 72,
        right: 72
      });
      expect(doc.page.size).toBe('letter');
      expect(doc.page.layout).toBe('portrait');
    });

    it('should create a document with A4 size', () => {
      const a4Doc = new PDFDocument({ size: 'A4' });
      expect(a4Doc.page.width).toBe(595);
      expect(a4Doc.page.height).toBe(842);
    });

    it('should create a document with custom size', () => {
      const customDoc = new PDFDocument({ size: [500, 700] });
      expect(customDoc.page.width).toBe(500);
      expect(customDoc.page.height).toBe(700);
    });

    it('should create a document with landscape layout', () => {
      const landscapeDoc = new PDFDocument({ layout: 'landscape' });
      expect(landscapeDoc.page.width).toBe(792);
      expect(landscapeDoc.page.height).toBe(612);
    });

    it('should create a document with custom margins', () => {
      const customDoc = new PDFDocument({
        margins: { top: 50, left: 50, bottom: 50, right: 50 }
      });
      expect(customDoc.page.margins).toEqual({
        top: 50,
        left: 50,
        bottom: 50,
        right: 50
      });
    });
  });

  describe('Font Methods', () => {
    it('should register a font', () => {
      doc.registerFont('CustomFont', '/path/to/font.ttf');
      expect(doc.calls.registerFont).toHaveLength(1);
      expect(doc.calls.registerFont[0]).toEqual({
        name: 'CustomFont',
        src: '/path/to/font.ttf',
        family: undefined
      });
    });

    it('should set font', () => {
      doc.font('Helvetica');
      expect(doc.calls.font).toHaveLength(1);
      expect(doc.calls.font[0]).toEqual({
        name: 'Helvetica',
        size: undefined
      });
    });

    it('should set font with size', () => {
      doc.font('Helvetica', 14);
      expect(doc.calls.font).toHaveLength(1);
      expect(doc.calls.font[0]).toEqual({
        name: 'Helvetica',
        size: 14
      });
    });

    it('should set font size', () => {
      doc.fontSize(16);
      expect(doc.calls.fontSize).toHaveLength(1);
      expect(doc.calls.fontSize[0]).toEqual({ size: 16 });
    });

    it('should support method chaining', () => {
      const result = doc.font('Helvetica').fontSize(14);
      expect(result).toBe(doc);
    });
  });

  describe('Color Methods', () => {
    it('should set fill color', () => {
      doc.fillColor('#FF0000');
      expect(doc.calls.fillColor).toHaveLength(1);
      expect(doc.calls.fillColor[0]).toEqual({
        color: '#FF0000',
        opacity: undefined
      });
    });

    it('should set fill color with opacity', () => {
      doc.fillColor('#FF0000', 0.5);
      expect(doc.calls.fillColor).toHaveLength(1);
      expect(doc.calls.fillColor[0]).toEqual({
        color: '#FF0000',
        opacity: 0.5
      });
    });

    it('should set stroke color', () => {
      doc.strokeColor('#00FF00');
      expect(doc.calls.strokeColor).toHaveLength(1);
      expect(doc.calls.strokeColor[0]).toEqual({
        color: '#00FF00',
        opacity: undefined
      });
    });

    it('should support method chaining', () => {
      const result = doc.fillColor('#FF0000').strokeColor('#00FF00');
      expect(result).toBe(doc);
    });
  });

  describe('Text Methods', () => {
    it('should add text at current position', () => {
      doc.text('Hello World');
      expect(doc.calls.text).toHaveLength(1);
      expect(doc.calls.text[0]).toEqual({
        text: 'Hello World',
        x: undefined,
        y: undefined,
        options: undefined
      });
    });

    it('should add text at specific position', () => {
      doc.text('Hello World', 100, 200);
      expect(doc.calls.text).toHaveLength(1);
      expect(doc.calls.text[0]).toEqual({
        text: 'Hello World',
        x: 100,
        y: 200,
        options: undefined
      });
    });

    it('should add text with options', () => {
      doc.text('Hello World', { width: 300, align: 'center' });
      expect(doc.calls.text).toHaveLength(1);
      expect(doc.calls.text[0]).toEqual({
        text: 'Hello World',
        x: undefined,
        y: undefined,
        options: { width: 300, align: 'center' }
      });
    });

    it('should add text with position and options', () => {
      doc.text('Hello World', 100, 200, { width: 300 });
      expect(doc.calls.text).toHaveLength(1);
      expect(doc.calls.text[0]).toEqual({
        text: 'Hello World',
        x: 100,
        y: 200,
        options: { width: 300 }
      });
    });

    it('should calculate width of string', () => {
      doc.fontSize(12);
      const width = doc.widthOfString('Hello');
      expect(width).toBeGreaterThan(0);
      expect(typeof width).toBe('number');
    });

    it('should calculate height of string', () => {
      doc.fontSize(12);
      const height = doc.heightOfString('Hello\nWorld');
      expect(height).toBeGreaterThan(0);
      expect(typeof height).toBe('number');
    });

    it('should update cursor position after text', () => {
      const initialY = doc.y;
      doc.text('Hello World');
      expect(doc.y).toBeGreaterThan(initialY);
    });

    it('should support method chaining', () => {
      const result = doc.text('Hello').text('World');
      expect(result).toBe(doc);
      expect(doc.calls.text).toHaveLength(2);
    });
  });

  describe('Image Methods', () => {
    it('should add image at current position', () => {
      const buffer = Buffer.from('fake-image');
      doc.image(buffer);
      expect(doc.calls.image).toHaveLength(1);
      expect(doc.calls.image[0].src).toBe(buffer);
    });

    it('should add image at specific position', () => {
      const buffer = Buffer.from('fake-image');
      doc.image(buffer, 100, 200);
      expect(doc.calls.image).toHaveLength(1);
      expect(doc.calls.image[0]).toEqual({
        src: buffer,
        x: 100,
        y: 200,
        options: undefined
      });
    });

    it('should add image with options', () => {
      const buffer = Buffer.from('fake-image');
      doc.image(buffer, { width: 200, height: 150 });
      expect(doc.calls.image).toHaveLength(1);
      expect(doc.calls.image[0]).toEqual({
        src: buffer,
        x: undefined,
        y: undefined,
        options: { width: 200, height: 150 }
      });
    });

    it('should add image from file path', () => {
      doc.image('/path/to/image.jpg');
      expect(doc.calls.image).toHaveLength(1);
      expect(doc.calls.image[0].src).toBe('/path/to/image.jpg');
    });

    it('should support method chaining', () => {
      const result = doc.image(Buffer.from('test'));
      expect(result).toBe(doc);
    });
  });

  describe('Page Methods', () => {
    it('should add a new page', () => {
      doc.addPage();
      expect(doc.calls.addPage).toHaveLength(1);
    });

    it('should reset cursor position after adding page', () => {
      doc.y = 500;
      doc.addPage();
      expect(doc.y).toBe(doc.page.margins.top);
      expect(doc.x).toBe(doc.page.margins.left);
    });

    it('should add page with options', () => {
      doc.addPage({ size: 'A4' });
      expect(doc.calls.addPage).toHaveLength(1);
      expect(doc.calls.addPage[0].options).toEqual({ size: 'A4' });
    });

    it('should support method chaining', () => {
      const result = doc.addPage();
      expect(result).toBe(doc);
    });
  });

  describe('Movement Methods', () => {
    it('should move down by default (1 line)', () => {
      const initialY = doc.y;
      doc.moveDown();
      expect(doc.y).toBeGreaterThan(initialY);
      expect(doc.calls.moveDown).toHaveLength(1);
    });

    it('should move down by specified lines', () => {
      const initialY = doc.y;
      doc.moveDown(3);
      expect(doc.y).toBeGreaterThan(initialY);
      expect(doc.calls.moveDown[0].lines).toBe(3);
    });

    it('should move up by default (1 line)', () => {
      doc.y = 200;
      const initialY = doc.y;
      doc.moveUp();
      expect(doc.y).toBeLessThan(initialY);
      expect(doc.calls.moveUp).toHaveLength(1);
    });

    it('should move up by specified lines', () => {
      doc.y = 200;
      const initialY = doc.y;
      doc.moveUp(2);
      expect(doc.y).toBeLessThan(initialY);
      expect(doc.calls.moveUp[0].lines).toBe(2);
    });

    it('should support method chaining', () => {
      const result = doc.moveDown().moveUp();
      expect(result).toBe(doc);
    });
  });

  describe('Vector Graphics Methods', () => {
    it('should move to position', () => {
      doc.moveTo(100, 200);
      expect(doc.calls.moveTo).toHaveLength(1);
      expect(doc.calls.moveTo[0]).toEqual({ x: 100, y: 200 });
      expect(doc.x).toBe(100);
      expect(doc.y).toBe(200);
    });

    it('should draw line to position', () => {
      doc.lineTo(300, 400);
      expect(doc.calls.lineTo).toHaveLength(1);
      expect(doc.calls.lineTo[0]).toEqual({ x: 300, y: 400 });
    });

    it('should stroke path', () => {
      doc.stroke();
      expect(doc.calls.stroke).toHaveLength(1);
    });

    it('should support method chaining for drawing', () => {
      const result = doc.moveTo(0, 0).lineTo(100, 100).stroke();
      expect(result).toBe(doc);
      expect(doc.calls.moveTo).toHaveLength(1);
      expect(doc.calls.lineTo).toHaveLength(1);
      expect(doc.calls.stroke).toHaveLength(1);
    });
  });

  describe('Stream Methods', () => {
    it('should pipe to a writable stream', () => {
      const writeStream = new Writable();
      doc.pipe(writeStream);
      expect(doc.calls.pipe).toHaveLength(1);
      expect(doc.calls.pipe[0].destination).toBe(writeStream);
    });

    it('should emit finish event on end', (done) => {
      doc.on('finish', () => {
        expect(doc.calls.end).toHaveLength(1);
        done();
      });
      doc.end();
    });

    it('should emit finish on piped stream', (done) => {
      const writeStream = new Writable({
        write(chunk, encoding, callback) {
          callback();
        }
      });

      writeStream.on('finish', () => {
        done();
      });

      doc.pipe(writeStream);
      doc.end();
    });

    it('should support method chaining', () => {
      const writeStream = new Writable();
      const result = doc.pipe(writeStream);
      expect(result).toBe(doc);
    });
  });

  describe('Call Tracking', () => {
    it('should track all method calls', () => {
      doc
        .registerFont('CustomFont', '/path/to/font.ttf')
        .font('CustomFont', 12)
        .fontSize(14)
        .fillColor('#FF0000')
        .strokeColor('#00FF00')
        .text('Hello World')
        .image(Buffer.from('test'))
        .moveDown()
        .addPage()
        .moveTo(0, 0)
        .lineTo(100, 100)
        .stroke();

      expect(doc.calls.registerFont).toHaveLength(1);
      expect(doc.calls.font).toHaveLength(1);
      expect(doc.calls.fontSize).toHaveLength(1);
      expect(doc.calls.fillColor).toHaveLength(1);
      expect(doc.calls.strokeColor).toHaveLength(1);
      expect(doc.calls.text).toHaveLength(1);
      expect(doc.calls.image).toHaveLength(1);
      expect(doc.calls.moveDown).toHaveLength(1);
      expect(doc.calls.addPage).toHaveLength(1);
      expect(doc.calls.moveTo).toHaveLength(1);
      expect(doc.calls.lineTo).toHaveLength(1);
      expect(doc.calls.stroke).toHaveLength(1);
    });

    it('should reset call tracking', () => {
      doc.text('Hello');
      doc.image(Buffer.from('test'));
      expect(doc.calls.text).toHaveLength(1);
      expect(doc.calls.image).toHaveLength(1);

      doc.resetCalls();

      expect(doc.calls.text).toHaveLength(0);
      expect(doc.calls.image).toHaveLength(0);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle typical PDF generation workflow', () => {
      const writeStream = new Writable({
        write(chunk, encoding, callback) {
          callback();
        }
      });

      doc
        .pipe(writeStream)
        .registerFont('NotoSansKR-Regular', '/path/to/font.ttf')
        .font('NotoSansKR-Regular', 12)
        .fillColor('#000000')
        .text('Title', 72, 72, { width: 400, align: 'center' })
        .moveDown(2)
        .fontSize(10)
        .text('Body text goes here', { width: 400 })
        .addPage()
        .text('Page 2 content')
        .end();

      expect(doc.calls.pipe).toHaveLength(1);
      expect(doc.calls.registerFont).toHaveLength(1);
      expect(doc.calls.font).toHaveLength(1);
      expect(doc.calls.fillColor).toHaveLength(1);
      expect(doc.calls.text).toHaveLength(3);
      expect(doc.calls.moveDown).toHaveLength(1);
      expect(doc.calls.fontSize).toHaveLength(1);
      expect(doc.calls.addPage).toHaveLength(1);
      expect(doc.calls.end).toHaveLength(1);
    });

    it('should handle drawing decorative elements', () => {
      doc
        .moveTo(72, 100)
        .lineTo(540, 100)
        .strokeColor('#CCCCCC')
        .stroke();

      expect(doc.calls.moveTo).toHaveLength(1);
      expect(doc.calls.lineTo).toHaveLength(1);
      expect(doc.calls.strokeColor).toHaveLength(1);
      expect(doc.calls.stroke).toHaveLength(1);
    });
  });
});
