import { useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import * as Y from 'yjs';
import { yXmlFragmentToProsemirrorJSON } from '@tiptap/y-tiptap';
import { api } from '../lib/api.js';
import { baseExtensions } from '../lib/extensions.js';
import { formatDateTime } from '../lib/format.js';
import Modal from './Modal.jsx';

function decodeSnapshot(base64) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const doc = new Y.Doc();
  Y.applyUpdate(doc, bytes);
  const content = yXmlFragmentToProsemirrorJSON(doc.getXmlFragment('default'));
  const title = doc.getMap('meta').get('title');
  doc.destroy();
  return { content, title };
}

export default function VersionPreview({ documentId, version, canRestore, onClose, onRestored }) {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/documents/${documentId}/versions/${version.id}`)
      .then(({ state }) => setSnapshot(decodeSnapshot(state)))
      .catch((err) => setError(err.message));
  }, [documentId, version.id]);

  const editor = useEditor(
    { extensions: baseExtensions(), editable: false, content: snapshot?.content ?? '', editorProps: { attributes: { class: 'prose' } } },
    [snapshot],
  );

  async function restore() {
    if (!window.confirm('Restore this version for everyone? The current content is saved as a version first, so you can undo this.')) return;
    setBusy(true);
    try {
      await api(`/documents/${documentId}/versions/${version.id}/restore`, { method: 'POST' });
      onRestored();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={version.label || `Version from ${formatDateTime(version.createdAt)}`} onClose={onClose} wide>
      <p className="muted small">
        {formatDateTime(version.createdAt)}
        {snapshot?.title && <> · titled “{snapshot.title}”</>}
      </p>
      {error && <p className="error">{error}</p>}
      <div className="paper preview">{snapshot ? <EditorContent editor={editor} /> : <div className="spinner small" />}</div>
      <footer className="modal-footer">
        <button className="btn" onClick={onClose}>Close</button>
        {canRestore && (
          <button className="btn primary" onClick={restore} disabled={busy || !snapshot}>
            {busy ? 'Restoring…' : 'Restore this version'}
          </button>
        )}
      </footer>
    </Modal>
  );
}
