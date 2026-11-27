import { useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import { baseExtensions } from '../editor/extensions.js';
import Toolbar from './Toolbar.jsx';

const WORDS_PER_MINUTE = 220;

function renderCaret(user) {
  const caret = document.createElement('span');
  caret.className = 'collaboration-carets__caret';
  caret.style.borderColor = user.color;
  caret.dataset.userId = user.id;

  const label = document.createElement('span');
  label.className = 'collaboration-carets__label';
  label.style.backgroundColor = user.color;
  label.textContent = user.name;
  caret.append(label);
  return caret;
}

function countText(editor) {
  const text = editor.getText();
  const words = text.split(/\s+/).filter(Boolean).length;
  return { words, characters: text.length, minutes: Math.max(1, Math.ceil(words / WORDS_PER_MINUTE)) };
}

export default function CollaborativeEditor({ ydoc, provider, user, editable, onEditor }) {
  const [counts, setCounts] = useState({ words: 0, characters: 0, minutes: 1 });

  const editor = useEditor(
    {
      extensions: [
        ...baseExtensions({ collaborative: true, placeholder: 'Start writing. Anyone else in this document sees it as you type.' }),
        Collaboration.configure({ document: ydoc }),
        CollaborationCaret.configure({
          provider,
          user: { id: user.id, name: user.name, color: user.color },
          render: renderCaret,
        }),
      ],
      editable,
      editorProps: { attributes: { class: 'prose', 'aria-label': 'Document body' } },
      onCreate: ({ editor }) => setCounts(countText(editor)),
      onUpdate: ({ editor }) => setCounts(countText(editor)),
    },
    [ydoc, provider],
  );

  useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    onEditor?.(editor);
    return () => onEditor?.(null);
  }, [editor, onEditor]);

  if (!editor) return null;

  return (
    <div className="editor-shell">
      {editable && <Toolbar editor={editor} />}
      <div className="paper">
        <EditorContent editor={editor} />
      </div>
      <footer className="editor-footer mono">
        <span>{counts.words.toLocaleString()} words</span>
        <span>{counts.characters.toLocaleString()} characters</span>
        <span>{counts.minutes} min read</span>
      </footer>
    </div>
  );
}
