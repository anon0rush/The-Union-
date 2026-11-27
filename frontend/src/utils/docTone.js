export const TONES = ['coral', 'teal', 'sun', 'cobalt', 'pink', 'leaf', 'tangerine'];

export function docTone(id = '') {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `tone-${TONES[hash % TONES.length]}`;
}

export const docInitial = (title = '') => (title.trim()[0] ?? '?').toUpperCase();
