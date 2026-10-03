import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { formatDateTime, timeAgo } from '../lib/format.js';
import Avatar from './Avatar.jsx';
import VersionPreview from './VersionPreview.jsx';

const KIND_LABEL = { auto: 'Autosave', manual: 'Named version', restore: 'Before restore' };
const REFRESH_MS = 30_000;

export default function VersionPanel({ documentId, canEdit, onClose, notify }) {
  const [versions, setVersions] = useState(null);
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const [previewing, setPreviewing] = useState(null);

  const load = useCallback(() => {
    api(`/documents/${documentId}/versions`)
      .then(({ versions }) => setVersions(versions))
      .catch((err) => setError(err.message));
  }, [documentId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      await api(`/documents/${documentId}/versions`, { method: 'POST', body: { label } });
      setLabel('');
      notify('Version saved');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <aside className="side-panel" aria-label="Version history">
      <header className="side-panel-header">
        <h2>Version history</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Close history">✕</button>
      </header>

      {canEdit && (
        <form className="row-form compact" onSubmit={save}>
          <input placeholder="Name this version…" value={label} maxLength={120} required onChange={(e) => setLabel(e.target.value)} />
          <button className="btn primary">Save</button>
        </form>
      )}
      <p className="muted small">Snapshots are also taken automatically while people edit and when the last person leaves.</p>
      {error && <p className="error">{error}</p>}

      {!versions ? (
        <div className="spinner small" />
      ) : versions.length === 0 ? (
        <p className="muted">No versions yet.</p>
      ) : (
        <ol className="versions">
          {versions.map((v) => (
            <li key={v.id}>
              <button className="version" onClick={() => setPreviewing(v)}>
                <span className="version-title">{v.label || KIND_LABEL[v.kind]}</span>
                <span className="muted small" title={formatDateTime(v.createdAt)}>
                  {v.label && `${KIND_LABEL[v.kind]} · `}
                  {timeAgo(v.createdAt)}
                  {v.createdBy && ` · by ${v.createdBy.name}`}
                </span>
                {v.authors.length > 0 && (
                  <span className="version-authors" aria-label={`Edited by ${v.authors.map((a) => a.name).join(', ')}`}>
                    {v.authors.map((a) => <Avatar key={a.id} user={a} size={20} />)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ol>
      )}

      {previewing && (
        <VersionPreview
          documentId={documentId}
          version={previewing}
          canRestore={canEdit}
          onClose={() => setPreviewing(null)}
          onRestored={() => {
            setPreviewing(null);
            notify('Version restored for everyone');
            load();
          }}
        />
      )}
    </aside>
  );
}
