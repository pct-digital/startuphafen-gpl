import fontkit from '@pdf-lib/fontkit';
import {
  formatAddressLine,
  formatGermanDate,
  HwkFormData,
  HwkFormShareholder,
  joinNonEmpty,
  NOT_APPLICABLE,
} from '@startuphafen/startuphafen-common';
import { PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib';

const PAGE_WIDTH = 595.28; // A4 portrait, in points
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 56;
const MARGIN_TOP = 56;
const MARGIN_BOTTOM = 56;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN_X;

const TEXT_COLOR = rgb(0.1, 0.1, 0.1);
const LABEL_SIZE = 9;
const VALUE_SIZE = 11;
const HEADING_SIZE = 14;
const SUBHEADING_SIZE = 11;
const LINE_GAP = 6;

// Vertical space a gender row and the gap after a block consume. A labeled
// line's height is no longer fixed: its value can wrap onto several lines, so
// it is measured per value (see labeledLineHeight).
const GENDER_ROW_HEIGHT = VALUE_SIZE + LINE_GAP;
const BLOCK_TRAILING_GAP = 8;
// Leading between wrapped continuation lines of a single value; tighter than
// LINE_GAP, which separates distinct rows.
const WRAP_LINE_GAP = 2;

interface DrawContext {
  doc: PDFDocument;
  font: PDFFont;
  fontBold: PDFFont;
  page: PDFPage;
  y: number;
}

/**
 * Builds a supplementary PDF page listing the shareholders that do not fit onto
 * the official HWK form (which only offers person a) and b)). The first
 * additional shareholder is placed onto the form itself, so this sheet starts
 * with the third shareholder (additionalShareholders[1]). Returns null when no
 * extra page is required.
 */
export async function buildAdditionalShareholdersPdf(
  data: HwkFormData,
  fontBytes: Uint8Array
): Promise<Uint8Array | null> {
  const overflowShareholders = (data.additionalShareholders ?? []).slice(1);
  if (overflowShareholders.length === 0) {
    return null;
  }

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: true });

  const ctx: DrawContext = {
    doc,
    font,
    fontBold: font,
    page: addPage(doc),
    y: PAGE_HEIGHT - MARGIN_TOP,
  };

  drawHeader(ctx, data, false);

  for (const [position, shareholder] of overflowShareholders.entries()) {
    // person a) and b) live on the form, so the extra sheet continues at c).
    const letter = letterFor(position + 2);
    drawShareholder(ctx, shareholder, data, letter);
  }

  return doc.save();
}

function addPage(doc: PDFDocument): PDFPage {
  return doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
}

function letterFor(index: number): string {
  // 0 -> 'a', 1 -> 'b', 2 -> 'c', ...
  return String.fromCharCode('a'.charCodeAt(0) + index);
}

function startContinuationPage(ctx: DrawContext, data: HwkFormData): void {
  ctx.page = addPage(ctx.doc);
  ctx.y = PAGE_HEIGHT - MARGIN_TOP;
  drawHeader(ctx, data, true);
}

type ShareholderRow =
  | { kind: 'labeled'; label: string; value: string }
  | { kind: 'gender'; gender: 'männlich' | 'weiblich' | null };

// The ordered rows of a shareholder block, built once so measurement and
// drawing share a single source of truth for both labels and (wrappable)
// values. A company has no personal attributes, so Geschlecht /
// Staatsangehörigkeit / Geburtsdatum become not-applicable dash lines instead
// of a gender checkbox row.
function buildShareholderRows(
  shareholder: HwkFormShareholder,
  letter: string
): ShareholderRow[] {
  const nameLabel = shareholder.isCompany ? 'Firma' : 'Vor- und Zuname';
  const name = shareholder.isCompany
    ? shareholder.companyName ?? ''
    : joinNonEmpty([shareholder.firstName, shareholder.lastName], ' ');

  const rows: ShareholderRow[] = [
    { kind: 'labeled', label: `${letter}) ${nameLabel}`, value: name },
  ];

  if (shareholder.isCompany) {
    rows.push({ kind: 'labeled', label: 'Geschlecht', value: NOT_APPLICABLE });
    rows.push({
      kind: 'labeled',
      label: 'Staatsangehörigkeit',
      value: NOT_APPLICABLE,
    });
    rows.push({
      kind: 'labeled',
      label: 'Geburtsdatum / Geburtsort',
      value: NOT_APPLICABLE,
    });
  } else {
    rows.push({ kind: 'gender', gender: shareholder.gender });
    rows.push({
      kind: 'labeled',
      label: 'Staatsangehörigkeit',
      value: shareholder.nationality ?? '',
    });
    rows.push({
      kind: 'labeled',
      label: 'Geburtsdatum / Geburtsort',
      value: joinNonEmpty(
        [formatGermanDate(shareholder.birthDate), shareholder.birthPlace],
        '  /  '
      ),
    });
  }

  rows.push({
    kind: 'labeled',
    label: 'Straße, Hausnummer, Postleitzahl, Ort',
    value: formatAddressLine(shareholder.address),
  });

  return rows;
}

// Height a shareholder block needs, so it can be page-broken as a unit instead
// of splitting a person's rows across pages. Long values wrap, so each labeled
// line is measured against its actual content.
function measureRows(font: PDFFont, rows: ShareholderRow[]): number {
  let height = 0;
  for (const row of rows) {
    height +=
      row.kind === 'gender'
        ? GENDER_ROW_HEIGHT
        : labeledLineHeight(font, row.value);
  }
  return height + BLOCK_TRAILING_GAP;
}

// Vertical space a labeled line consumes once its value is wrapped to fit
// CONTENT_WIDTH. Must stay in sync with drawLabeledLine, which wraps the same
// value the same way.
function labeledLineHeight(font: PDFFont, value: string): number {
  const lines = wrapText(font, value || '—', VALUE_SIZE, CONTENT_WIDTH);
  const valueHeight =
    lines.length * VALUE_SIZE + (lines.length - 1) * WRAP_LINE_GAP + LINE_GAP;
  return LABEL_SIZE + 2 + valueHeight;
}

function drawText(
  ctx: DrawContext,
  text: string,
  options: { x: number; y: number; size: number; bold?: boolean }
): void {
  ctx.page.drawText(text, {
    x: options.x,
    y: options.y,
    size: options.size,
    font: options.bold ? ctx.fontBold : ctx.font,
    color: TEXT_COLOR,
  });
}

/**
 * Splits text into lines that each fit within maxWidth at the given font size.
 * pdf-lib's drawText never wraps on its own, so without this a long value would
 * run off the right edge of the page. Text that already fits is returned
 * unchanged as a single line, preserving its original spacing. A single word
 * wider than maxWidth is hard-broken on character boundaries so it can never
 * overflow.
 */
function wrapText(
  font: PDFFont,
  text: string,
  size: number,
  maxWidth: number
): string[] {
  if (text.length === 0) return [''];
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return [text];

  const lines: string[] = [];
  let current = '';

  for (const word of text.split(/\s+/).filter((w) => w.length > 0)) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = '';
    }

    if (font.widthOfTextAtSize(word, size) > maxWidth) {
      const chunks = breakLongWord(font, word, size, maxWidth);
      lines.push(...chunks.slice(0, -1));
      current = chunks[chunks.length - 1];
    } else {
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

// Breaks a single word with no spaces onto character boundaries so it never
// extends past maxWidth (e.g. an absurdly long company name or URL).
function breakLongWord(
  font: PDFFont,
  word: string,
  size: number,
  maxWidth: number
): string[] {
  const chunks: string[] = [];
  let chunk = '';
  for (const char of word) {
    const candidate = chunk + char;
    if (chunk && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      chunks.push(chunk);
      chunk = char;
    } else {
      chunk = candidate;
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

function drawHeader(
  ctx: DrawContext,
  data: HwkFormData,
  isContinuation: boolean
): void {
  drawText(ctx, 'Anlage zum Antrag auf Eintragung eines Betriebes', {
    x: MARGIN_X,
    y: ctx.y,
    size: HEADING_SIZE,
    bold: true,
  });
  ctx.y -= HEADING_SIZE + LINE_GAP;

  const subtitle = isContinuation
    ? 'Weitere Anteilseigner / Gesellschafter (Fortsetzung)'
    : 'Weitere Anteilseigner / Gesellschafter';
  drawText(ctx, subtitle, {
    x: MARGIN_X,
    y: ctx.y,
    size: SUBHEADING_SIZE,
    bold: true,
  });
  ctx.y -= SUBHEADING_SIZE + LINE_GAP;

  const companyParts = [data.business.name, data.legalForm].filter(Boolean);
  if (companyParts.length > 0) {
    const lines = wrapText(
      ctx.font,
      `Betrieb: ${companyParts.join(' – ')}`,
      LABEL_SIZE,
      CONTENT_WIDTH
    );
    for (const line of lines) {
      drawText(ctx, line, { x: MARGIN_X, y: ctx.y, size: LABEL_SIZE });
      ctx.y -= LABEL_SIZE + LINE_GAP;
    }
  }

  drawDivider(ctx);
  ctx.y -= 10;
}

function drawDivider(ctx: DrawContext): void {
  ctx.page.drawLine({
    start: { x: MARGIN_X, y: ctx.y },
    end: { x: MARGIN_X + CONTENT_WIDTH, y: ctx.y },
    thickness: 0.75,
    color: rgb(0.6, 0.6, 0.6),
  });
}

function drawShareholder(
  ctx: DrawContext,
  shareholder: HwkFormShareholder,
  data: HwkFormData,
  letter: string
): void {
  const rows = buildShareholderRows(shareholder, letter);

  // Keep the whole block together: if it would cross the bottom margin, move it
  // to a fresh (re-headed) page rather than splitting the person's rows.
  if (ctx.y - measureRows(ctx.font, rows) < MARGIN_BOTTOM) {
    startContinuationPage(ctx, data);
  }

  for (const row of rows) {
    if (row.kind === 'gender') {
      drawGenderRow(ctx, row.gender);
    } else {
      drawLabeledLine(ctx, row.label, row.value);
    }
  }

  ctx.y -= BLOCK_TRAILING_GAP;
}

function drawLabeledLine(ctx: DrawContext, label: string, value: string): void {
  drawText(ctx, label, {
    x: MARGIN_X,
    y: ctx.y,
    size: LABEL_SIZE,
    bold: true,
  });
  ctx.y -= LABEL_SIZE + 2;

  const lines = wrapText(ctx.font, value || '—', VALUE_SIZE, CONTENT_WIDTH);
  for (const [index, line] of lines.entries()) {
    drawText(ctx, line, {
      x: MARGIN_X,
      y: ctx.y,
      size: VALUE_SIZE,
    });
    const isLast = index === lines.length - 1;
    ctx.y -= VALUE_SIZE + (isLast ? LINE_GAP : WRAP_LINE_GAP);
  }
}

function drawGenderRow(
  ctx: DrawContext,
  gender: 'männlich' | 'weiblich' | null
): void {
  const boxSize = 9;
  let x = MARGIN_X;
  const baseline = ctx.y;

  const options: Array<{ label: string; checked: boolean }> = [
    { label: 'männlich', checked: gender === 'männlich' },
    { label: 'weiblich', checked: gender === 'weiblich' },
  ];

  for (const option of options) {
    ctx.page.drawRectangle({
      x,
      y: baseline - 1,
      width: boxSize,
      height: boxSize,
      borderColor: TEXT_COLOR,
      borderWidth: 0.75,
    });
    if (option.checked) {
      drawText(ctx, 'X', {
        x: x + 1.5,
        y: baseline,
        size: boxSize - 1,
        bold: true,
      });
    }
    drawText(ctx, option.label, {
      x: x + boxSize + 4,
      y: baseline,
      size: LABEL_SIZE,
    });
    x +=
      boxSize + 4 + ctx.font.widthOfTextAtSize(option.label, LABEL_SIZE) + 24;
  }

  ctx.y -= VALUE_SIZE + LINE_GAP;
}
