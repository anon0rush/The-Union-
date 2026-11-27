import path from 'node:path';
import { HttpError } from '../utils/HttpError.js';
import { convertDocx } from './importers/docx.js';
import { convertPdf } from './importers/pdf.js';
import { convertText } from './importers/text.js';

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

const startsWith = (buffer, signature) => buffer.subarray(0, signature.length).equals(Buffer.from(signature));

const FORMATS = {
  '.pdf': { name: 'pdf', matches: (b) => startsWith(b, '%PDF-') },
  '.docx': { name: 'docx', matches: (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]) },
  '.txt': { name: 'text', matches: (b) => !b.includes(0) },
  '.md': { name: 'markdown', matches: (b) => !b.includes(0) },
};

export const SUPPORTED_EXTENSIONS = Object.keys(FORMATS);

function titleFromFileName(fileName) {
  const base = path.basename(fileName, path.extname(fileName)).replace(/[_-]+/g, ' ').trim();
  return (base || 'Imported document').slice(0, 200);
}

export async function importDocument({ fileName, buffer }) {
  const extension = path.extname(fileName).toLowerCase();
  const format = FORMATS[extension];
  if (!format) {
    throw new HttpError(415, 'Only Word (.docx), PDF, Markdown and plain text files can be imported');
  }
  if (!format.matches(buffer)) {
    throw new HttpError(415, `This file is not a valid ${extension.slice(1).toUpperCase()} file`);
  }

  let html;
  let pages = null;
  try {
    if (format.name === 'pdf') ({ html, pages } = await convertPdf(buffer));
    else if (format.name === 'docx') html = await convertDocx(buffer);
    else html = convertText(buffer);
  } catch {
    throw new HttpError(422, 'The file could not be read. It may be damaged or password protected.');
  }

  if (!html.replace(/<[^>]+>/g, '').trim()) {
    throw new HttpError(
      422,
      format.name === 'pdf'
        ? 'This PDF has no selectable text. It may be a scanned image.'
        : 'This file does not contain any text to import.',
    );
  }

  return { title: titleFromFileName(fileName), format: format.name, pages, html };
}
