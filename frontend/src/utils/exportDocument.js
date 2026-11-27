const MARK_WRAPPERS = { bold: '**', italic: '_', strike: '~~', code: '`' };

function inlineMarkdown(nodes = []) {
  return nodes
    .map((node) => {
      if (node.type === 'hardBreak') return '  \n';
      if (node.type !== 'text') return '';
      let text = node.text;
      const marks = node.marks ?? [];
      for (const mark of marks) {
        const wrapper = MARK_WRAPPERS[mark.type];
        if (wrapper) text = `${wrapper}${text}${wrapper}`;
      }
      const link = marks.find((m) => m.type === 'link');
      return link ? `[${text}](${link.attrs.href})` : text;
    })
    .join('');
}

function indentLines(text, prefix) {
  return text
    .split('\n')
    .map((line, i) => (i === 0 || !line ? line : prefix + line))
    .join('\n');
}

function listItems(node, marker) {
  return (node.content ?? [])
    .map((item, index) => {
      const bullet = marker(item, index);
      const body = (item.content ?? []).map(blockMarkdown).join('\n');
      return bullet + indentLines(body, ' '.repeat(bullet.length));
    })
    .join('\n');
}

function blockMarkdown(node) {
  switch (node.type) {
    case 'heading':
      return `${'#'.repeat(node.attrs.level)} ${inlineMarkdown(node.content)}`;
    case 'paragraph':
      return inlineMarkdown(node.content);
    case 'bulletList':
      return listItems(node, () => '- ');
    case 'orderedList':
      return listItems(node, (_item, i) => `${(node.attrs?.start ?? 1) + i}. `);
    case 'taskList':
      return listItems(node, (item) => `- [${item.attrs?.checked ? 'x' : ' '}] `);
    case 'blockquote':
      return (node.content ?? [])
        .map(blockMarkdown)
        .join('\n\n')
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n');
    case 'codeBlock':
      return `\`\`\`${node.attrs?.language ?? ''}\n${(node.content ?? []).map((t) => t.text).join('')}\n\`\`\``;
    case 'horizontalRule':
      return '---';
    default:
      return inlineMarkdown(node.content);
  }
}

export function toMarkdown(json, title) {
  const body = (json.content ?? []).map(blockMarkdown).join('\n\n');
  return `# ${title}\n\n${body}\n`;
}

const escapeHtml = (text) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function toHtmlDocument(bodyHtml, title) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
body { max-width: 720px; margin: 48px auto; padding: 0 16px; font: 17px/1.7 Georgia, serif; color: #15181d; }
h1, h2, h3 { line-height: 1.25; }
pre { background: #1b1f26; color: #e6e9ef; padding: 16px; border-radius: 6px; overflow-x: auto; }
code { font-family: Menlo, Consolas, monospace; font-size: 0.85em; }
blockquote { margin: 0; padding-left: 16px; border-left: 2px solid #b9bfc9; color: #4f5764; }
mark { background: #fbe7a1; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${bodyHtml}
</body>
</html>
`;
}

export function fileName(title, extension) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'document'}.${extension}`;
}

export function downloadFile(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
