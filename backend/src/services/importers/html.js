export const escapeHtml = (text) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function blocksToHtml(blocks) {
  const html = [];
  let list = null;
  for (const block of blocks) {
    if (block.type === 'bullet') {
      if (!list) {
        list = [];
        html.push(list);
      }
      list.push(`<li><p>${escapeHtml(block.text)}</p></li>`);
      continue;
    }
    list = null;
    const tag = block.type === 'heading' ? `h${block.level}` : 'p';
    html.push(`<${tag}>${escapeHtml(block.text)}</${tag}>`);
  }
  return html.map((part) => (Array.isArray(part) ? `<ul>${part.join('')}</ul>` : part)).join('\n');
}
