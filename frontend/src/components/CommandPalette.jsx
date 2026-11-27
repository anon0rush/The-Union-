import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useCommands } from '../context/CommandContext.jsx';
import Icon from './Icon.jsx';

function matches(text, query) {
  const haystack = text.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

export default function CommandPalette() {
  const { commands, paletteOpen, setPaletteOpen } = useCommands();
  const navigate = useNavigate();
  const dialogRef = useRef(null);
  const listRef = useRef(null);
  const [query, setQuery] = useState('');
  const [documents, setDocuments] = useState([]);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (paletteOpen && !dialog.open) {
      dialog.showModal();
      setQuery('');
      setSelected(0);
      api('/documents')
        .then(({ documents }) => setDocuments(documents))
        .catch(() => setDocuments([]));
    } else if (!paletteOpen && dialog.open) {
      dialog.close();
    }
  }, [paletteOpen]);

  const items = useMemo(() => {
    const actionItems = commands
      .filter((c) => !query || matches(`${c.label} ${c.keywords ?? ''}`, query))
      .map((c) => ({ ...c, group: c.group ?? 'Actions' }));
    const docItems = documents
      .filter((d) => !query || matches(d.title, query))
      .slice(0, query ? 8 : 5)
      .map((d) => ({
        id: `doc:${d.id}`,
        group: query ? 'Documents' : 'Recent documents',
        label: d.title,
        icon: 'doc',
        hint: d.role === 'owner' ? 'Yours' : d.ownerName,
        run: () => navigate(`/d/${d.id}`),
      }));
    return [...actionItems, ...docItems];
  }, [commands, documents, query, navigate]);

  useEffect(() => setSelected(0), [query]);

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  function close() {
    setPaletteOpen(false);
  }

  function run(item) {
    close();
    item.run();
  }

  function onKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelected((i) => Math.min(i + 1, items.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelected((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter' && items[selected]) {
      event.preventDefault();
      run(items[selected]);
    }
  }

  let lastGroup = null;

  return (
    <dialog
      ref={dialogRef}
      className="palette"
      aria-label="Command menu"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => event.target === dialogRef.current && close()}
    >
      {paletteOpen && (
        <>
          <div className="palette-search">
            <Icon name="search" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Type a command or document name"
              aria-label="Search commands and documents"
              role="combobox"
              aria-expanded="true"
              aria-controls="palette-list"
            />
          </div>
          {items.length === 0 ? (
            <p className="palette-empty">No commands or documents match “{query}”.</p>
          ) : (
            <ul className="palette-list" id="palette-list" role="listbox" ref={listRef}>
              {items.map((item, index) => {
                const header = item.group !== lastGroup ? item.group : null;
                lastGroup = item.group;
                return (
                  <li key={item.id} role="presentation">
                    {header && <div className="palette-group">{header}</div>}
                    <div
                      className="palette-item"
                      role="option"
                      aria-selected={index === selected}
                      onMouseMove={() => setSelected(index)}
                      onClick={() => run(item)}
                    >
                      <Icon name={item.icon ?? 'enter'} />
                      <span>{item.label}</span>
                      {item.hint && <small className="small">{item.hint}</small>}
                      {item.shortcut && <kbd className="kbd">{item.shortcut}</kbd>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <footer className="palette-foot">
            <span>
              <kbd className="kbd">↑</kbd>
              <kbd className="kbd">↓</kbd> move
            </span>
            <span>
              <kbd className="kbd">↵</kbd> open
            </span>
            <span>
              <kbd className="kbd">esc</kbd> close
            </span>
          </footer>
        </>
      )}
    </dialog>
  );
}
