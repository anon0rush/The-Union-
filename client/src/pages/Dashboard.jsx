import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { ROLE_LABEL, timeAgo } from '../lib/format.js';

const FILTERS = [
  ['all', 'All documents'],
  ['owned', 'Owned by me'],
  ['shared', 'Shared with me'],
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    api('/documents')
      .then(({ documents }) => setDocuments(documents))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(load, [load]);

  const visible = useMemo(() => {
    if (!documents) return [];
    const q = query.trim().toLowerCase();
    return documents.filter((d) => {
      if (filter === 'owned' && d.role !== 'owner') return false;
      if (filter === 'shared' && d.role === 'owner') return false;
      return !q || d.title.toLowerCase().includes(q) || d.ownerName.toLowerCase().includes(q);
    });
  }, [documents, filter, query]);

  async function createDocument() {
    setCreating(true);
    try {
      const { document } = await api('/documents', { method: 'POST', body: {} });
      navigate(`/d/${document.id}`);
    } catch (err) {
      setError(err.message);
      setCreating(false);
    }
  }

  async function rename(doc) {
    const title = window.prompt('Rename document', doc.title)?.trim();
    if (!title || title === doc.title) return;
    try {
      await api(`/documents/${doc.id}`, { method: 'PATCH', body: { title } });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(doc) {
    const owner = doc.role === 'owner';
    const message = owner
      ? `Delete “${doc.title}” for everyone? This cannot be undone.`
      : `Leave “${doc.title}”? You will lose access until someone shares it again.`;
    if (!window.confirm(message)) return;
    try {
      await api(owner ? `/documents/${doc.id}` : `/documents/${doc.id}/members/${user.id}`, { method: 'DELETE' });
      setDocuments((docs) => docs.filter((d) => d.id !== doc.id));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <AppHeader />
      <main className="dashboard">
        <div className="dashboard-top">
          <div>
            <h1>Documents</h1>
            <p className="muted">Everything you own or that has been shared with you.</p>
          </div>
          <button className="btn primary" onClick={createDocument} disabled={creating}>
            <span aria-hidden>＋</span> {creating ? 'Creating…' : 'New document'}
          </button>
        </div>

        <div className="dashboard-controls">
          <div className="segmented" role="tablist">
            {FILTERS.map(([key, label]) => (
              <button key={key} role="tab" aria-selected={filter === key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>
                {label}
              </button>
            ))}
          </div>
          <input className="search" type="search" placeholder="Search by title or owner…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        {error && <p className="error" role="alert">{error}</p>}

        {!documents ? (
          <div className="screen-center"><div className="spinner" /></div>
        ) : visible.length === 0 ? (
          <div className="empty">
            {documents.length === 0 ? (
              <>
                <h2>No documents yet</h2>
                <p className="muted">Create one, then invite people to write with you.</p>
                <button className="btn primary" onClick={createDocument}>Create your first document</button>
              </>
            ) : (
              <p className="muted">Nothing matches that filter.</p>
            )}
          </div>
        ) : (
          <ul className="doc-grid">
            {visible.map((doc) => (
              <li key={doc.id} className="doc-card">
                <Link to={`/d/${doc.id}`} className="doc-card-link">
                  <div className="doc-thumb" aria-hidden><span /><span /><span /><span /></div>
                  <h3>{doc.title}</h3>
                  <p className="muted small">
                    {doc.role === 'owner' ? 'You' : doc.ownerName} · edited {timeAgo(doc.updatedAt)}
                  </p>
                </Link>
                <div className="doc-card-footer">
                  <span className={`badge role-${doc.role}`}>{ROLE_LABEL[doc.role]}</span>
                  <span className="doc-actions">
                    {doc.role !== 'viewer' && <button className="link-btn" onClick={() => rename(doc)}>Rename</button>}
                    <button className="link-btn danger" onClick={() => remove(doc)}>{doc.role === 'owner' ? 'Delete' : 'Leave'}</button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
