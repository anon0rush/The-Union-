import { useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import { baseExtensions } from '../lib/extensions.js';
import Toolbar from './Toolbar.jsx';

export default function CollaborativeEditor({ ydoc, provider, user, editable }) {
  const [counts, setCounts] = useState({ words: 0, characters: 0 });

  const editor = useEditor(
    {
      extensions: [
        ...baseExtensions({ collaborative: true, placeholder: 'Start writing — everyone here sees it as you type…' }),
        Collaboration.configure({ document: ydoc }),
        CollaborationCaret.configure({ provider, user: { id: user.id, name: user.name, color: user.color } }),
      ],
      editable,
      editorProps: { attributes: { class: 'prose', 'aria-label': 'Document body' } },
      onCreate: ({ editor }) => setCounts(count(editor)),
      onUpdate: ({ editor }) => setCounts(count(editor)),
    },
    [ydoc, provider],
  );

  useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable);
  }, [editor, editable]);

  if (!editor) return null;

  return (
    <div className="editor-shell">
      {editable && <Toolbar editor={editor} />}
      <div className="paper">
        <EditorContent editor={editor} />
      </div>
      <footer className="editor-footer muted small">
        {counts.words.toLocaleString()} words · {counts.characters.toLocaleString()} characters
      </footer>
    </div>
  );
}

function count(editor) {
  const text = editor.getText();
  return { words: text.split(/\s+/).filter(Boolean).length, characters: text.length };
}
