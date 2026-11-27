import * as Y from 'yjs';

const EXCERPT_LENGTH = 280;

function collectBlocks(node, blocks) {
  for (const child of node.toArray()) {
    if (child instanceof Y.XmlText) {
      const text = child
        .toDelta()
        .map((op) => (typeof op.insert === 'string' ? op.insert : ''))
        .join('');
      if (blocks.length && blocks.at(-1).open) blocks.at(-1).text += text;
      else blocks.push({ text, open: true });
    } else if (child instanceof Y.XmlElement) {
      if (blocks.length) blocks.at(-1).open = false;
      collectBlocks(child, blocks);
      if (blocks.length) blocks.at(-1).open = false;
    }
  }
  return blocks;
}

export function backfillSummaries(repo, fragmentName) {
  let updated = 0;
  for (const { id, state } of repo.documentsWithoutSummary()) {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, state);
    const summary = summarize(doc.getXmlFragment(fragmentName));
    doc.destroy();
    if (summary.wordCount > 0) {
      repo.saveSummary(id, summary);
      updated += 1;
    }
  }
  return updated;
}

export function summarize(fragment) {
  const text = collectBlocks(fragment, [])
    .map((b) => b.text.trim())
    .filter(Boolean)
    .join('\n');
  const words = text.split(/\s+/).filter(Boolean).length;
  const flat = text.replace(/\s+/g, ' ').trim();
  const excerpt = flat.length > EXCERPT_LENGTH ? `${flat.slice(0, EXCERPT_LENGTH).replace(/\s+\S*$/, '')}…` : flat;
  return { excerpt, wordCount: words };
}
