import { blocksToHtml } from './html.js';

const BULLET = /^\s*[-*•]\s+/;
const HEADING = /^(#{1,3})\s+(.*)$/;

export function convertText(buffer) {
  const lines = buffer.toString('utf8').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let paragraph = [];

  const flush = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    const heading = line.match(HEADING);
    if (!line) {
      flush();
    } else if (heading) {
      flush();
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
    } else if (BULLET.test(line)) {
      flush();
      blocks.push({ type: 'bullet', text: line.replace(BULLET, '') });
    } else {
      paragraph.push(line);
    }
  }
  flush();
  return blocksToHtml(blocks);
}
