import { useState } from 'react';
import Modal from './Modal.jsx';

export default function RenameDialog({ initialTitle, onSubmit, onClose }) {
  const [title, setTitle] = useState(initialTitle);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || trimmed === initialTitle) return onClose();
    setBusy(true);
    try {
      await onSubmit(trimmed);
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Rename document" onClose={onClose}>
      <form onSubmit={submit} className="row-form">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={200}
          aria-label="Document title"
          autoFocus
          onFocus={(event) => event.target.select()}
        />
        <button className="btn btn-primary" disabled={busy}>
          Save
        </button>
      </form>
      {error && <p className="error small">{error}</p>}
    </Modal>
  );
}
