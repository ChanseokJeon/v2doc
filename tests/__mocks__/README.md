# PDFKit Mock

Comprehensive PDFKit mock for testing PDF generation functionality.

## Features

- **Document Creation**: Mock PDFDocument with configurable options
- **Page Management**: `addPage()`, page dimensions, margins
- **Text Rendering**: `text()`, `widthOfString()`, `heightOfString()`
- **Image Rendering**: `image()` with Buffer or file path
- **Font Management**: `registerFont()`, `font()`, `fontSize()`
- **Color Management**: `fillColor()`, `strokeColor()`
- **Vector Graphics**: `moveTo()`, `lineTo()`, `stroke()`
- **Stream Output**: `pipe()`, `end()`, `on('finish')`
- **Call Tracking**: All method calls are tracked for assertions

## Usage

### Basic Example

```typescript
import PDFDocument from '../__mocks__/pdfkit';

describe('My PDF Generator', () => {
  it('should generate a PDF', () => {
    const doc = new PDFDocument();

    doc
      .font('Helvetica', 12)
      .text('Hello World', 100, 100);

    // Assert calls were made
    expect(doc.calls.font).toHaveLength(1);
    expect(doc.calls.text).toHaveLength(1);
    expect(doc.calls.text[0]).toEqual({
      text: 'Hello World',
      x: 100,
      y: 100,
      options: undefined
    });
  });
});
```

### With Stream Output

```typescript
import PDFDocument from '../__mocks__/pdfkit';
import { Writable } from 'stream';

it('should pipe to a stream and emit finish', (done) => {
  const doc = new PDFDocument();
  const writeStream = new Writable({
    write(chunk, encoding, callback) {
      callback();
    }
  });

  doc.pipe(writeStream);

  doc.on('finish', () => {
    expect(doc.calls.pipe).toHaveLength(1);
    expect(doc.calls.end).toHaveLength(1);
    done();
  });

  doc.text('Content').end();
});
```

### Asserting Font Registration

```typescript
it('should register custom fonts', () => {
  const doc = new PDFDocument();

  doc.registerFont('NotoSansKR-Regular', '/path/to/font.ttf');
  doc.registerFont('NotoSansKR-Bold', '/path/to/bold.ttf');

  expect(doc.calls.registerFont).toHaveLength(2);
  expect(doc.calls.registerFont[0]).toEqual({
    name: 'NotoSansKR-Regular',
    src: '/path/to/font.ttf',
    family: undefined
  });
});
```

### Asserting Images

```typescript
it('should add images', () => {
  const doc = new PDFDocument();
  const imageBuffer = Buffer.from('fake-image-data');

  doc.image(imageBuffer, 100, 200, { width: 300, height: 200 });

  expect(doc.calls.image).toHaveLength(1);
  expect(doc.calls.image[0]).toEqual({
    src: imageBuffer,
    x: 100,
    y: 200,
    options: { width: 300, height: 200 }
  });
});
```

### Resetting Call Tracking

```typescript
it('should reset call tracking between tests', () => {
  const doc = new PDFDocument();

  doc.text('First call');
  expect(doc.calls.text).toHaveLength(1);

  doc.resetCalls();
  expect(doc.calls.text).toHaveLength(0);

  doc.text('Second call');
  expect(doc.calls.text).toHaveLength(1);
});
```

## Call Tracking Interface

All method calls are tracked in `doc.calls`:

```typescript
interface MockCallTracker {
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
```

## Page Properties

Access page information via `doc.page`:

```typescript
const doc = new PDFDocument();

console.log(doc.page.width);   // 612 (letter width)
console.log(doc.page.height);  // 792 (letter height)
console.log(doc.page.margins); // { top: 72, left: 72, bottom: 72, right: 72 }
console.log(doc.page.size);    // 'letter'
console.log(doc.page.layout);  // 'portrait'
```

## Cursor Position

The mock tracks cursor position (`x`, `y`):

```typescript
const doc = new PDFDocument();

console.log(doc.x, doc.y); // Initial position at margins

doc.text('Hello');
console.log(doc.y); // Y position increased after text

doc.moveTo(100, 200);
console.log(doc.x, doc.y); // 100, 200
```

## Advanced Features

### Custom Document Options

```typescript
const doc = new PDFDocument({
  size: 'A4',
  layout: 'landscape',
  margins: { top: 50, left: 50, bottom: 50, right: 50 }
});

expect(doc.page.width).toBe(842);  // A4 landscape width
expect(doc.page.height).toBe(595); // A4 landscape height
```

### Method Chaining

All methods support chaining:

```typescript
doc
  .font('Helvetica', 12)
  .fillColor('#000000')
  .text('Title', { align: 'center' })
  .moveDown(2)
  .fontSize(10)
  .text('Body text');
```

## Testing Tips

1. **Use call tracking**: Instead of trying to mock file system writes, assert on `doc.calls`
2. **Reset between tests**: Use `doc.resetCalls()` or create new document instances
3. **Test method chaining**: Verify methods return `this` for fluent API
4. **Test cursor updates**: Verify `doc.x` and `doc.y` are updated correctly
5. **Test async completion**: Use `done` callback or promises when testing `end()` and `finish` events
