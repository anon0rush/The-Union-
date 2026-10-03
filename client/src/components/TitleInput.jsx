import { useEffect, useState } from 'react';

/** The title lives in the shared Y.Doc (`meta.title`), so renames show up live for everyone. */
export default function TitleInput({ ydoc, editable, fallback }) {
  const meta = ydoc.getMap('meta');
  const [title, setTitle] = useState(() => meta.get('title') ?? fallback);

  useEffect(() => {
    const sync = () => setTitle(meta.get('title') ?? fallback);
    sync();
    meta.observe(sync);
    return () => meta.unobserve(sync);
  }, [meta, fallback]);

  useEffect(() => {
    document.title = `${title || 'Untitled document'} · The Union`;
    return () => {
      document.title = 'The Union';
    };
  }, [title]);

  return (
    <input
      className="title-input"
      value={title}
      placeholder="Untitled document"
      maxLength={200}
      readOnly={!editable}
      aria-label="Document title"
      onChange={(e) => meta.set('title', e.target.value)}
      onBlur={(e) => !e.target.value.trim() && meta.set('title', 'Untitled document')}
    />
  );
}
