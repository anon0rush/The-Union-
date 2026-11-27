import { useEffect, useState } from 'react';

function readHeadings(editor) {
  const headings = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading' && node.textContent.trim()) {
      headings.push({ level: node.attrs.level, text: node.textContent, pos });
    }
  });
  return headings;
}

export default function OutlinePanel({ editor }) {
  const [headings, setHeadings] = useState([]);

  useEffect(() => {
    if (!editor) return undefined;
    const update = () => setHeadings(readHeadings(editor));
    update();
    editor.on('update', update);
    return () => editor.off('update', update);
  }, [editor]);

  function jumpTo(pos) {
    editor.view.nodeDOM(pos)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    editor.commands.setTextSelection(pos + 1);
  }

  if (headings.length === 0) {
    return <p className="side-note">Headings you add to the document appear here, so you can jump between sections.</p>;
  }

  return (
    <ul className="outline-list">
      {headings.map((h) => (
        <li key={`${h.pos}-${h.text}`}>
          <button className={`outline-item level-${h.level}`} onClick={() => jumpTo(h.pos)} title={h.text}>
            {h.text}
          </button>
        </li>
      ))}
    </ul>
  );
}
