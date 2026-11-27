import { api } from '../api/client.js';

export const ACCEPTED_FILES = '.docx,.pdf,.md,.txt';
export const MAX_FILE_MB = 10;

export async function importFile(file) {
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    throw new Error(`${file.name} is larger than ${MAX_FILE_MB} MB`);
  }
  const form = new FormData();
  form.append('file', file);
  const converted = await api('/import', { method: 'POST', body: form });
  const { document } = await api('/documents', {
    method: 'POST',
    body: { title: converted.title, importedFrom: file.name.slice(0, 255) },
  });
  return { documentId: document.id, html: converted.html, fileName: file.name };
}
