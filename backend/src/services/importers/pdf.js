import { getDocumentProxy } from 'unpdf';
import { blocksToHtml } from './html.js';

const BULLET = /^[•●▪◦‣\-–]\s*/;
const PARAGRAPH_GAP = 1.6;
const HEADING_RATIO = 1.25;
const MAX_HEADING_LENGTH = 120;

async function readLines(pdf) {
  const lines = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const { items } = await page.getTextContent();
    let current = null;
    for (const item of items) {
      if (!('str' in item) || item.str === '') continue;
      const y = item.transform[5];
      const size = Math.abs(item.transform[3]) || item.height;
      const sameLine = current && Math.abs(current.y - y) <= Math.max(2, size * 0.3);
      if (!sameLine) {
        if (current) lines.push(current);
        current = { page: pageNumber, y, size, text: '' };
      }
      current.text += item.str;
      current.size = Math.max(current.size, size);
    }
    if (current) lines.push(current);
  }
  return lines.map((l) => ({ ...l, text: l.text.replace(/\s+/g, ' ').trim() })).filter((l) => l.text);
}

function bodyTextSize(lines) {
  const charsBySize = new Map();
  for (const line of lines) {
    const size = Math.round(line.size * 2) / 2;
    charsBySize.set(size, (charsBySize.get(size) ?? 0) + line.text.length);
  }
  let best = 12;
  let most = 0;
  for (const [size, chars] of charsBySize) {
    if (chars > most) [best, most] = [size, chars];
  }
  return best;
}

function headingLevel(line, bodySize) {
  const ratio = line.size / bodySize;
  if (ratio < HEADING_RATIO || line.text.length > MAX_HEADING_LENGTH) return 0;
  if (ratio >= 1.8) return 1;
  if (ratio >= 1.45) return 2;
  return 3;
}

export async function convertPdf(buffer) {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const lines = await readLines(pdf);
  const bodySize = bodyTextSize(lines);
  const blocks = [];
  let paragraph = null;
  let previous = null;

  const flush = () => {
    if (paragraph) blocks.push(paragraph);
    paragraph = null;
  };

  for (const line of lines) {
    const level = headingLevel(line, bodySize);
    const gap = previous && previous.page === line.page ? previous.y - line.y : Infinity;
    const startsBlock = gap > line.size * PARAGRAPH_GAP || gap < 0;

    if (level) {
      flush();
      const last = blocks.at(-1);
      if (last?.type === 'heading' && last.level === level && !startsBlock) last.text += ` ${line.text}`;
      else blocks.push({ type: 'heading', level, text: line.text });
    } else if (BULLET.test(line.text)) {
      flush();
      paragraph = { type: 'bullet', text: line.text.replace(BULLET, '') };
    } else if (paragraph && !startsBlock) {
      paragraph.text = paragraph.text.endsWith('-') ? paragraph.text.slice(0, -1) + line.text : `${paragraph.text} ${line.text}`;
    } else {
      flush();
      paragraph = { type: 'paragraph', text: line.text };
    }
    previous = line;
  }
  flush();
  return { html: blocksToHtml(blocks), pages: pdf.numPages };
}
