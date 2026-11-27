import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import AppHeader from '../components/AppHeader.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import Icon from '../components/Icon.jsx';
import ImportDialog from '../components/ImportDialog.jsx';
import Menu from '../components/Menu.jsx';
import RenameDialog from '../components/RenameDialog.jsx';
import Shapes from '../components/Shapes.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { docInitial, docTone } from '../utils/docTone.js';
import { ROLE_LABEL, formatDateTime, timeAgo } from '../utils/format.js';

const FILTERS = [
  { key: 'all', label: 'All documents', tone: 'tone-cobalt', test: () => true },
  { key: 'starred', label: 'Starred', tone: 'tone-sun', test: (d) => d.starred },
  { key: 'owned', label: 'Owned by me', tone: 'tone-coral', test: (d) => d.role === 'owner' },
  { key: 'shared', label: 'Shared with me', tone: 'tone-teal', test: (d) => d.role !== 'owner' },
];

const VIEW_KEY = 'union.view';

function readView() {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

function greeting(name) {
  const hour = new Date().getHours();
  const part = hour < 5 ? 'Working late' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return `${part}, ${name.split(' ')[0]}`;
}

function summary(documents) {
  if (!documents?.length) return 'Start a document or bring one in from Word or PDF.';
  const shared = documents.filter((d) => d.role !== 'owner').length;
  const latest = Math.max(...documents.map((d) => d.updatedAt));
  const count = `${documents.length} ${documents.length === 1 ? 'document' : 'documents'}`;
  const sharedText = shared ? `, ${shared} shared with you` : '';
  return `${count}${sharedText}. Last edit ${timeAgo(latest)}.`;
}

function DocumentActions({ doc, onRename, onRemove }) {
  return (
    <Menu
      label={`Actions for ${doc.title}`}
      trigger={({ toggle, ...aria }) => (
        <button className="btn btn-ghost btn-icon btn-sm" onClick={toggle} aria-label={`Actions for ${doc.title}`} {...aria}>
          <Icon name="more" />
        </button>
      )}
    >
      {doc.role !== 'viewer' && (
        <button className="menu-item" role="menuitem" onClick={() => onRename(doc)}>
          Rename
        </button>
      )}
      <button className="menu-item danger" role="menuitem" onClick={() => onRemove(doc)}>
        {doc.role === 'owner' ? 'Delete' : 'Leave'}
      </button>
    </Menu>
  );
}

function StarButton({ doc, onToggle }) {
  return (
    <button
      className="star-btn"
      aria-pressed={doc.starred}
      aria-label={doc.starred ? `Unstar ${doc.title}` : `Star ${doc.title}`}
      onClick={() => onToggle(doc)}
    >
      <Icon name="star" filled={doc.starred} size={15} />
    </button>
  );
}

function DocumentCard({ doc, onToggleStar, onRename, onRemove }) {
  return (
    <li className={`doc-card ${docTone(doc.id)}`}>
      <Link to={`/d/${doc.id}`} className="doc-cover" tabIndex={-1} aria-hidden="true">
        <div className="doc-sheet">
          <strong>{doc.title}</strong>
          {doc.excerpt ? (
            <span className="doc-excerpt">{doc.excerpt}</span>
          ) : (
            <span className="empty-sheet">Nothing written yet</span>
          )}
        </div>
      </Link>
      {doc.role !== 'owner' && <span className="tag">{ROLE_LABEL[doc.role]}</span>}
      <StarButton doc={doc} onToggle={onToggleStar} />
      <div className="doc-card-body">
        <div className="doc-card-text">
          <Link to={`/d/${doc.id}`} className="doc-title-link">
            {doc.title}
          </Link>
          <span className="doc-meta mono" title={formatDateTime(doc.updatedAt)}>
            {doc.role === 'owner' ? 'You' : doc.ownerName} · {timeAgo(doc.updatedAt)}
            {doc.wordCount > 0 && ` · ${doc.wordCount.toLocaleString()} words`}
          </span>
        </div>
        <DocumentActions doc={doc} onRename={onRename} onRemove={onRemove} />
      </div>
    </li>
  );
}

function DocumentTable({ documents, onToggleStar, onRename, onRemove }) {
  return (
    <div className="doc-table-wrap">
      <table className="doc-table">
        <thead>
          <tr>
            <th className="col-title">Title</th>
            <th className="col-owner">Owner</th>
            <th className="col-role">Your access</th>
            <th>Words</th>
            <th>Last edited</th>
            <th className="col-actions">
              <span className="visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.id} className={docTone(doc.id)}>
              <td className="col-title">
                <span className="title-cell">
                  <span className="doc-mark" aria-hidden="true">
                    {docInitial(doc.title)}
                  </span>
                  <Link to={`/d/${doc.id}`} className="doc-title-link">
                    {doc.title}
                  </Link>
                  <StarButton doc={doc} onToggle={onToggleStar} />
                </span>
              </td>
              <td className="col-owner muted">{doc.role === 'owner' ? 'You' : doc.ownerName}</td>
              <td className="col-role muted">{ROLE_LABEL[doc.role]}</td>
              <td className="mono muted">{doc.wordCount.toLocaleString()}</td>
              <td className="mono muted" title={formatDateTime(doc.updatedAt)}>
                {timeAgo(doc.updatedAt)}
              </td>
              <td className="col-actions">
                <DocumentActions doc={doc} onRename={onRename} onRemove={onRemove} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const searchRef = useRef(null);
  const dragDepth = useRef(0);
  const [documents, setDocuments] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [view, setView] = useState(readView);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [importing, setImporting] = useState(null);
  const [dragging, setDragging] = useState(false);

  const load = useCallback(() => {
    api('/documents')
      .then(({ documents }) => setDocuments(documents))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    document.title = 'Documents · The Union';
  }, []);

  useEffect(() => {
    if (params.get('import')) {
      setImporting({ file: null });
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === '/' && !event.target.closest('input, textarea, [contenteditable="true"]')) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const hasFiles = (event) => [...(event.dataTransfer?.types ?? [])].includes('Files');
    const onDragEnter = (event) => {
      if (!hasFiles(event)) return;
      dragDepth.current += 1;
      setDragging(true);
    };
    const onDragLeave = (event) => {
      if (!hasFiles(event)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    };
    const onDragOver = (event) => hasFiles(event) && event.preventDefault();
    const onDrop = (event) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      const file = event.dataTransfer.files[0];
      if (file) setImporting({ file });
    };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  function changeView(next) {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      return;
    }
  }

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.key, documents?.filter(f.test).length ?? 0])),
    [documents],
  );

  const visible = useMemo(() => {
    if (!documents) return [];
    const active = FILTERS.find((f) => f.key === filter);
    const q = query.trim().toLowerCase();
    return documents.filter(
      (d) =>
        active.test(d) &&
        (!q ||
          d.title.toLowerCase().includes(q) ||
          d.ownerName.toLowerCase().includes(q) ||
          d.excerpt.toLowerCase().includes(q)),
    );
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

  async function toggleStar(doc) {
    const starred = !doc.starred;
    setDocuments((docs) => docs.map((d) => (d.id === doc.id ? { ...d, starred } : d)));
    try {
      await api(`/documents/${doc.id}/star`, { method: starred ? 'PUT' : 'DELETE' });
    } catch (err) {
      setError(err.message);
      load();
    }
  }

  async function rename(doc, title) {
    await api(`/documents/${doc.id}`, { method: 'PATCH', body: { title } });
    setDocuments((docs) => docs.map((d) => (d.id === doc.id ? { ...d, title, updatedAt: Date.now() } : d)));
  }

  async function remove(doc) {
    try {
      const owner = doc.role === 'owner';
      await api(owner ? `/documents/${doc.id}` : `/documents/${doc.id}/members/${user.id}`, { method: 'DELETE' });
      setDocuments((docs) => docs.filter((d) => d.id !== doc.id));
    } catch (err) {
      setError(err.message);
    }
  }

  const activeFilter = FILTERS.find((f) => f.key === filter);
  const itemProps = { onToggleStar: toggleStar, onRename: setRenaming, onRemove: setRemoving };

  return (
    <div className="page">
      <AppHeader />
      <div className="library">
        <nav className="library-nav" aria-label="Document filters">
          <p className="nav-heading">Library</p>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`nav-item ${f.tone}`}
              aria-current={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className="mono">{documents ? counts[f.key] : ''}</span>
            </button>
          ))}
        </nav>

        <main className="library-main">
          <section className="band">
            <div className="band-copy">
              <h1>{greeting(user.name)}</h1>
              <p>{summary(documents)}</p>
              <div className="band-actions">
                <button className="btn btn-primary" onClick={createDocument} disabled={creating}>
                  <Icon name="plus" size={14} />
                  {creating ? 'Creating…' : 'New document'}
                </button>
                <button className="btn btn-on-band" onClick={() => setImporting({ file: null })}>
                  <Icon name="upload" size={14} />
                  Import Word or PDF
                </button>
              </div>
            </div>
            <Shapes />
          </section>

          <div className="library-head">
            <h2>{activeFilter.label}</h2>
            <label className="search-field">
              <Icon name="search" size={14} />
              <span className="visually-hidden">Search documents</span>
              <input
                ref={searchRef}
                type="search"
                placeholder="Search titles, owners and text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {!query && <span className="kbd">/</span>}
            </label>
            <div className="segmented" role="group" aria-label="Layout">
              <button aria-pressed={view === 'grid'} aria-label="Grid view" onClick={() => changeView('grid')}>
                <Icon name="grid" size={14} />
              </button>
              <button aria-pressed={view === 'list'} aria-label="List view" onClick={() => changeView('list')}>
                <Icon name="list" size={14} />
              </button>
            </div>
          </div>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          {!documents ? (
            <div className="loading-row">
              <div className="spinner" aria-label="Loading documents" />
            </div>
          ) : visible.length === 0 ? (
            <div className="empty-state">
              <Shapes width={120} height={100} />
              <div>
                {documents.length === 0 ? (
                  <>
                    <h2>No documents yet</h2>
                    <p className="muted">
                      Create a blank document, or drop a Word or PDF file anywhere on this page to import it.
                    </p>
                  </>
                ) : filter === 'starred' && !query ? (
                  <>
                    <h2>Nothing starred</h2>
                    <p className="muted">Star a document to keep it here for quick access.</p>
                  </>
                ) : (
                  <p className="muted">No documents match this filter.</p>
                )}
              </div>
            </div>
          ) : view === 'grid' ? (
            <ul className="doc-grid">
              {visible.map((doc) => (
                <DocumentCard key={doc.id} doc={doc} {...itemProps} />
              ))}
            </ul>
          ) : (
            <DocumentTable documents={visible} {...itemProps} />
          )}
        </main>
      </div>

      {dragging && !importing && (
        <div className="drop-overlay" aria-hidden="true">
          <div>
            <Icon name="upload" size={28} />
            <h2>Drop to import</h2>
            <p className="muted">Word, PDF, Markdown or plain text, up to 10 MB</p>
          </div>
        </div>
      )}
      {importing && <ImportDialog initialFile={importing.file} onClose={() => setImporting(null)} />}
      {renaming && (
        <RenameDialog
          initialTitle={renaming.title}
          onSubmit={(title) => rename(renaming, title)}
          onClose={() => setRenaming(null)}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={removing.role === 'owner' ? 'Delete document' : 'Leave document'}
          message={
            removing.role === 'owner'
              ? `“${removing.title}” will be deleted for everyone, including its history. This cannot be undone.`
              : `You will lose access to “${removing.title}” until someone shares it with you again.`
          }
          confirmLabel={removing.role === 'owner' ? 'Delete' : 'Leave'}
          danger
          onConfirm={() => remove(removing)}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  );
}
