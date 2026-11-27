import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { formatDateTime, timeAgo } from '../utils/format.js';
import Avatar from './Avatar.jsx';
import VersionPreview from './VersionPreview.jsx';

const KIND_LABEL = { auto: 'Autosave', manual: 'Named version', restore: 'Before restore' };
const REFRESH_MS = 30_000;

export default function VersionsPanel({ documentId, canEdit, notify, focusNameField }) {
  const [versions, setVersions] = useState(null);
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const [previewing, setPreviewing] = useState(null);
  const nameRef = useRef(null);

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

  useEffect(() => {
    if (focusNameField) nameRef.current?.focus();
  }, [focusNameField]);

  async function save(event) {
    event.preventDefault();
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
    <>
      {canEdit && (
        <form className="row-form compact" onSubmit={save}>
          <input
            ref={nameRef}
            placeholder="Name this version"
            value={label}
            maxLength={120}
            required
            onChange={(event) => setLabel(event.target.value)}
            aria-label="Version name"
          />
          <button className="btn btn-primary">Save</button>
        </form>
      )}
      <p className="side-note">
        A snapshot is also taken every few minutes while people edit, and when the last person leaves.
      </p>
      {error && <p className="error small">{error}</p>}

      {!versions ? (
        <div className="spinner" aria-label="Loading versions" />
      ) : versions.length === 0 ? (
        <p className="side-note">No versions yet.</p>
      ) : (
        <ol className="version-list">
          {versions.map((v) => (
            <li key={v.id}>
              <button className="version-item" onClick={() => setPreviewing(v)}>
                <span className="version-title">{v.label || KIND_LABEL[v.kind]}</span>
                <span className="mono muted" title={formatDateTime(v.createdAt)}>
                  {v.label && `${KIND_LABEL[v.kind]} · `}
                  {timeAgo(v.createdAt)}
                  {v.createdBy && ` · ${v.createdBy.name}`}
                </span>
                {v.authors.length > 0 && (
                  <span className="version-authors" aria-label={`Edited by ${v.authors.map((a) => a.name).join(', ')}`}>
                    {v.authors.map((a) => (
                      <Avatar key={a.id} user={a} size={18} />
                    ))}
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
    </>
  );
}
