import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader.jsx';
import CollaborativeEditor from '../components/CollaborativeEditor.jsx';
import ConnectionBadge from '../components/ConnectionBadge.jsx';
import PresenceBar from '../components/PresenceBar.jsx';
import ShareDialog from '../components/ShareDialog.jsx';
import TitleInput from '../components/TitleInput.jsx';
import VersionPanel from '../components/VersionPanel.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { ROLE_LABEL } from '../lib/format.js';
import { useCollaboration } from '../lib/useCollaboration.js';

const FATAL = {
  404: { title: 'Document not found', message: 'It may have been deleted, or it was never shared with you.' },
  4403: { title: 'Your access was removed', message: 'The owner stopped sharing this document with you.' },
  4404: { title: 'This document was deleted', message: 'The owner deleted it for everyone.' },
};

export default function DocumentPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [meta, setMeta] = useState(null);
  const [fatal, setFatal] = useState(null);
  const [panel, setPanel] = useState(null); // 'share' | 'history' | null
  const [toast, setToast] = useState('');
  const toastTimer = useRef();

  const notify = useCallback((message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4000);
  }, []);

  const loadMeta = useCallback(
    () =>
      api(`/documents/${id}`)
        .then((data) => {
          setMeta((prev) => {
            if (prev && prev.role !== data.role) notify(`Your access changed: ${ROLE_LABEL[data.role].toLowerCase()}`);
            return data;
          });
        })
        .catch((err) => setFatal(FATAL[err.status] ?? { title: 'Something went wrong', message: err.message })),
    [id, notify],
  );

  useEffect(() => {
    setMeta(null);
    setFatal(null);
    loadMeta();
  }, [loadMeta]);

  const onAccessEvent = useCallback(
    (code) => {
      if (FATAL[code]) setFatal(FATAL[code]);
      else loadMeta(); // 4401 token expired / 4409 role changed → fresh token, reconnect
    },
    [loadMeta],
  );

  const { ydoc, provider, connection } = useCollaboration({
    documentId: id,
    token: fatal ? null : meta?.collabToken,
    userId: user.id,
    onAccessEvent,
  });

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  if (fatal) {
    return (
      <div className="page">
        <AppHeader />
        <main className="screen-center">
          <div className="card narrow">
            <h1>{fatal.title}</h1>
            <p className="muted">{fatal.message}</p>
            <Link className="btn primary" to="/">Back to documents</Link>
          </div>
        </main>
      </div>
    );
  }

  const role = meta?.role;
  const canEdit = role === 'owner' || role === 'editor';
  const ready = meta && ydoc && provider;

  return (
    <div className="page document-page">
      <AppHeader>
        {ready && (
          <div className="doc-header">
            <TitleInput ydoc={ydoc} editable={canEdit} fallback={meta.document.title} />
            <ConnectionBadge state={connection} />
            <div className="doc-header-right">
              <PresenceBar provider={provider} self={user} />
              <button className={`btn ${panel === 'history' ? 'active' : ''}`} onClick={() => setPanel(panel === 'history' ? null : 'history')}>
                History
              </button>
              <button className="btn primary" onClick={() => setPanel('share')}>Share</button>
            </div>
          </div>
        )}
      </AppHeader>

      {!ready ? (
        <main className="screen-center"><div className="spinner" aria-label="Loading document" /></main>
      ) : (
        <div className={`workspace${panel === 'history' ? ' with-panel' : ''}`}>
          <main className="editor-column">
            {!canEdit && (
              <p className="readonly-banner">You have view-only access. You’ll see everyone’s changes live.</p>
            )}
            <CollaborativeEditor key={`${id}:${meta.collabToken}`} ydoc={ydoc} provider={provider} user={user} editable={canEdit} />
          </main>
          {panel === 'history' && (
            <VersionPanel documentId={id} canEdit={canEdit} onClose={() => setPanel(null)} notify={notify} />
          )}
        </div>
      )}

      {panel === 'share' && meta && (
        <ShareDialog documentId={id} role={role} onClose={() => setPanel(null)} notify={notify} />
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
