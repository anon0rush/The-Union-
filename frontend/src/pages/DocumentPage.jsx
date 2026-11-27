import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import AppHeader from '../components/AppHeader.jsx';
import CollaborativeEditor from '../components/CollaborativeEditor.jsx';
import ConnectionBadge from '../components/ConnectionBadge.jsx';
import Icon from '../components/Icon.jsx';
import Menu from '../components/Menu.jsx';
import PresenceBar from '../components/PresenceBar.jsx';
import ShareDialog from '../components/ShareDialog.jsx';
import SidePanel, { PANELS } from '../components/SidePanel.jsx';
import TitleInput from '../components/TitleInput.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { MOD, useRegisterCommands } from '../context/CommandContext.jsx';
import { useCollaboration } from '../hooks/useCollaboration.js';
import { docInitial, docTone } from '../utils/docTone.js';
import { downloadFile, fileName, toHtmlDocument, toMarkdown } from '../utils/exportDocument.js';
import { ROLE_LABEL } from '../utils/format.js';

const FATAL = {
  404: { title: 'Document not found', message: 'It may have been deleted, or it was never shared with you.' },
  4403: { title: 'Your access was removed', message: 'The owner stopped sharing this document with you.' },
  4404: { title: 'This document was deleted', message: 'The owner deleted it for everyone.' },
};

const PANEL_ICONS = { outline: 'outline', history: 'history', activity: 'activity' };

export default function DocumentPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const importApplied = useRef(false);
  const [meta, setMeta] = useState(null);
  const [fatal, setFatal] = useState(null);
  const [panel, setPanel] = useState(null);
  const [focusVersionName, setFocusVersionName] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [editor, setEditor] = useState(null);
  const [following, setFollowing] = useState(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef();

  const notify = useCallback((message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3500);
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
    setPanel(null);
    setFollowing(null);
    loadMeta();
  }, [loadMeta]);

  const onAccessEvent = useCallback(
    (code) => {
      if (FATAL[code]) setFatal(FATAL[code]);
      else loadMeta();
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

  const role = meta?.role;
  const canEdit = role === 'owner' || role === 'editor';
  const starred = meta?.document.starred ?? false;

  const currentTitle = useCallback(
    () => ydoc?.getMap('meta').get('title') || meta?.document.title || 'Untitled document',
    [ydoc, meta],
  );

  const togglePanel = useCallback((key) => setPanel((current) => (current === key ? null : key)), []);

  const openVersionNaming = useCallback(() => {
    if (!canEdit) {
      notify('Changes save automatically. Only editors can name versions.');
      return;
    }
    setPanel('history');
    setFocusVersionName((n) => n + 1);
  }, [canEdit, notify]);

  const toggleStar = useCallback(async () => {
    const next = !starred;
    setMeta((m) => ({ ...m, document: { ...m.document, starred: next } }));
    try {
      await api(`/documents/${id}/star`, { method: next ? 'PUT' : 'DELETE' });
      notify(next ? 'Added to starred' : 'Removed from starred');
    } catch (err) {
      setMeta((m) => ({ ...m, document: { ...m.document, starred: !next } }));
      notify(err.message);
    }
  }, [id, starred, notify]);

  const exportAs = useCallback(
    (format) => {
      if (!editor) return;
      const title = currentTitle();
      if (format === 'md') {
        downloadFile(fileName(title, 'md'), toMarkdown(editor.getJSON(), title), 'text/markdown');
      } else if (format === 'html') {
        downloadFile(fileName(title, 'html'), toHtmlDocument(editor.getHTML(), title), 'text/html');
      } else if (format === 'print') {
        window.print();
      } else if (format === 'copy') {
        navigator.clipboard
          .writeText(toMarkdown(editor.getJSON(), title))
          .then(() => notify('Copied as Markdown'))
          .catch(() => notify('Your browser blocked clipboard access'));
      }
    },
    [editor, currentTitle, notify],
  );

  useEffect(() => {
    const imported = location.state?.importedHtml;
    if (!imported || !editor || connection !== 'live' || !canEdit || importApplied.current) return;
    importApplied.current = true;
    editor.commands.setContent(imported, { emitUpdate: true });
    notify(`Imported ${location.state.importedFrom}`);
    navigate(location.pathname, { replace: true, state: null });
  }, [location, editor, connection, canEdit, notify, navigate]);

  useEffect(() => {
    function onKeyDown(event) {
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (mod && key === 's') {
        event.preventDefault();
        openVersionNaming();
      } else if (mod && event.shiftKey && key === 'o') {
        event.preventDefault();
        togglePanel('outline');
      } else if (mod && event.shiftKey && key === 'h') {
        event.preventDefault();
        togglePanel('history');
      } else if (event.key === 'Escape' && following) {
        setFollowing(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openVersionNaming, togglePanel, following]);

  useEffect(() => {
    if (!following || !provider) return undefined;
    const { awareness } = provider;
    let frame;
    const scrollToCaret = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        document
          .querySelector(`.collaboration-carets__caret[data-user-id="${following}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    };
    const onChange = ({ added, updated }) => {
      const changed = [...added, ...updated];
      const moved = changed.some((clientId) => awareness.getStates().get(clientId)?.user?.id === following);
      if (moved) scrollToCaret();
    };
    scrollToCaret();
    awareness.on('change', onChange);
    return () => {
      cancelAnimationFrame(frame);
      awareness.off('change', onChange);
    };
  }, [following, provider]);

  const commands = useMemo(() => {
    if (!meta) return [];
    const list = [
      {
        id: 'doc-share',
        group: 'This document',
        label: 'Share this document',
        icon: 'share',
        run: () => setSharing(true),
      },
      {
        id: 'doc-star',
        group: 'This document',
        label: starred ? 'Remove from starred' : 'Add to starred',
        icon: 'star',
        run: toggleStar,
      },
      ...PANELS.map(([key, label]) => ({
        id: `doc-panel-${key}`,
        group: 'This document',
        label: `Show ${label.toLowerCase()}`,
        icon: PANEL_ICONS[key],
        run: () => setPanel(key),
      })),
      {
        id: 'doc-export-md',
        group: 'Export',
        label: 'Download as Markdown',
        icon: 'download',
        run: () => exportAs('md'),
      },
      {
        id: 'doc-export-html',
        group: 'Export',
        label: 'Download as HTML',
        icon: 'download',
        run: () => exportAs('html'),
      },
      { id: 'doc-copy-md', group: 'Export', label: 'Copy as Markdown', icon: 'doc', run: () => exportAs('copy') },
      {
        id: 'doc-print',
        group: 'Export',
        label: 'Print or save as PDF',
        icon: 'printer',
        run: () => exportAs('print'),
      },
    ];
    if (canEdit) {
      list.splice(2, 0, {
        id: 'doc-name-version',
        group: 'This document',
        label: 'Name the current version',
        icon: 'history',
        shortcut: `${MOD} S`,
        run: openVersionNaming,
      });
    }
    return list;
  }, [meta, starred, canEdit, toggleStar, exportAs, openVersionNaming]);

  useRegisterCommands(commands);

  if (fatal) {
    return (
      <div className="page">
        <AppHeader />
        <main className="center-screen">
          <div className="panel-card">
            <h1>{fatal.title}</h1>
            <p className="muted">{fatal.message}</p>
            <Link className="btn" to="/">
              Back to documents
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const ready = meta && ydoc && provider;

  return (
    <div className="page">
      <AppHeader>
        {ready && (
          <div className={`doc-bar ${docTone(id)}`}>
            <span className="doc-mark" aria-hidden="true">
              {docInitial(ydoc.getMap('meta').get('title') || meta.document.title)}
            </span>
            <TitleInput ydoc={ydoc} editable={canEdit} fallback={meta.document.title} />
            <button
              className="star-btn"
              aria-pressed={starred}
              aria-label={starred ? 'Remove from starred' : 'Add to starred'}
              title={starred ? 'Remove from starred' : 'Add to starred'}
              onClick={toggleStar}
            >
              <Icon name="star" filled={starred} size={15} />
            </button>
            <ConnectionBadge state={connection} />
            <div className="doc-bar-end">
              <PresenceBar provider={provider} self={user} following={following} onFollow={setFollowing} />
              {PANELS.map(([key, label]) => (
                <button
                  key={key}
                  className="btn btn-ghost btn-icon"
                  aria-pressed={panel === key}
                  aria-label={label}
                  title={label}
                  onClick={() => togglePanel(key)}
                >
                  <Icon name={PANEL_ICONS[key]} />
                </button>
              ))}
              <Menu
                label="Export"
                trigger={({ toggle, ...aria }) => (
                  <button className="btn btn-ghost btn-icon" onClick={toggle} aria-label="Export" title="Export" {...aria}>
                    <Icon name="download" />
                  </button>
                )}
              >
                <p className="menu-label">Export</p>
                <button className="menu-item" role="menuitem" onClick={() => exportAs('md')}>
                  Download as Markdown
                </button>
                <button className="menu-item" role="menuitem" onClick={() => exportAs('html')}>
                  Download as HTML
                </button>
                <button className="menu-item" role="menuitem" onClick={() => exportAs('copy')}>
                  Copy as Markdown
                </button>
                <div className="menu-sep" />
                <button className="menu-item" role="menuitem" onClick={() => exportAs('print')}>
                  <Icon name="printer" />
                  Print or save as PDF
                </button>
              </Menu>
              <span className="header-sep" aria-hidden="true" />
              <button className="btn btn-primary btn-sm" onClick={() => setSharing(true)}>
                Share
              </button>
            </div>
          </div>
        )}
      </AppHeader>

      {!ready ? (
        <main className="center-screen">
          <div className="spinner" aria-label="Loading document" />
        </main>
      ) : (
        <div className={`workspace${panel ? ' with-panel' : ''}`}>
          <main className="editor-column">
            <div className="editor-shell">
              {!canEdit && (
                <p className="readonly-note">You can view this document. Other people's changes appear as they type.</p>
              )}
            </div>
            <CollaborativeEditor
              key={`${id}:${meta.collabToken}`}
              ydoc={ydoc}
              provider={provider}
              user={user}
              editable={canEdit}
              onEditor={setEditor}
            />
          </main>
          {panel && (
            <SidePanel
              panel={panel}
              onChange={setPanel}
              onClose={() => setPanel(null)}
              editor={editor}
              documentId={id}
              canEdit={canEdit}
              notify={notify}
              focusVersionName={focusVersionName}
            />
          )}
        </div>
      )}

      {sharing && meta && <ShareDialog documentId={id} role={role} onClose={() => setSharing(false)} notify={notify} />}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
