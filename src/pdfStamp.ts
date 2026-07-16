import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

const MARGIN = 18;
const FONT_SIZE = 1;
const CM_TO_PT = 72 / 2.54;
const BOX_WIDTH_PT = 4 * CM_TO_PT;
const BOX_HEIGHT_PT = 2.5 * CM_TO_PT;
const LINE_HEIGHT = FONT_SIZE * 1.2;
const LINES_PER_BOX = Math.max(1, Math.floor(BOX_HEIGHT_PT / LINE_HEIGHT));

const CHAR_REPLACEMENTS: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "–": "-",
  "—": "-",
  "…": "...",
  " ": " ",
  "•": "-",
};

function sanitizeForWinAnsi(text: string): string {
  let result = "";
  for (const char of text) {
    const replacement = CHAR_REPLACEMENTS[char];
    if (replacement !== undefined) {
      result += replacement;
      continue;
    }
    const code = char.codePointAt(0) ?? 0;
    // WinAnsi only covers this range; drop anything else rather than throwing.
    result += code <= 0xff ? char : "?";
  }
  return result;
}

function wrapToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? current + " " + word : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawLines(page: PDFPage, lines: string[], x: number, topY: number, font: PDFFont) {
  lines.forEach((line, i) => {
    page.drawText(line, {
      x,
      y: topY - i * LINE_HEIGHT,
      size: FONT_SIZE,
      font,
      color: rgb(0, 0, 0),
    });
  });
}

export async function stampTopLeft(file: File, text: string): Promise<Uint8Array> {
  const bytes = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(bytes);
  const page = pdfDoc.getPages()[0];
  if (!page) throw new Error("This PDF has no pages.");

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const { width, height } = page.getSize();
  const allLines = wrapToWidth(sanitizeForWinAnsi(text), font, FONT_SIZE, BOX_WIDTH_PT);

  const firstBoxLines = allLines.slice(0, LINES_PER_BOX);
  const overflowLines = allLines.slice(LINES_PER_BOX, LINES_PER_BOX * 2);
  // Anything beyond both boxes is intentionally dropped, not drawn.

  drawLines(page, firstBoxLines, MARGIN, height - MARGIN, font);

  if (overflowLines.length > 0) {
    const rightBoxX = width - MARGIN - BOX_WIDTH_PT;
    drawLines(page, overflowLines, rightBoxX, height - MARGIN, font);
  }

  return pdfDoc.save();
}
