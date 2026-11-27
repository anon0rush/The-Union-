import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ACCEPTED_FILES, MAX_FILE_MB, importFile } from '../utils/importFile.js';
import Icon from './Icon.jsx';
import Modal from './Modal.jsx';

const FORMATS = [
  ['tone-cobalt', 'Word .docx'],
  ['tone-coral', 'PDF'],
  ['tone-teal', 'Markdown .md'],
  ['tone-sun', 'Text .txt'],
];

export default function ImportDialog({ initialFile, onClose }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const started = useRef(false);
  const [over, setOver] = useState(false);
  const [busyFile, setBusyFile] = useState(null);
  const [error, setError] = useState('');

  async function start(file) {
    if (!file) return;
    setError('');
    setBusyFile(file.name);
    try {
      const { documentId, html, fileName } = await importFile(file);
      onClose();
      navigate(`/d/${documentId}`, { state: { importedHtml: html, importedFrom: fileName } });
    } catch (err) {
      setError(err.message);
      setBusyFile(null);
    }
  }

  useEffect(() => {
    if (initialFile && !started.current) {
      started.current = true;
      start(initialFile);
    }
  });

  function onDrop(event) {
    event.preventDefault();
    setOver(false);
    start(event.dataTransfer.files[0]);
  }

  return (
    <Modal title="Import a document" onClose={busyFile ? () => {} : onClose}>
      {busyFile ? (
        <div className="import-status" role="status">
          <div className="spinner" />
          <span>
            Converting <strong>{busyFile}</strong>
          </span>
        </div>
      ) : (
        <div
          className={`drop-zone${over ? ' over' : ''}`}
          onDragOver={(event) => {
            event.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
        >
          <Icon name="upload" size={22} />
          <p>
            <strong>Drop a file here</strong> or choose one from your computer.
          </p>
          <button className="btn btn-primary" onClick={() => inputRef.current.click()}>
            Choose file
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_FILES}
            hidden
            onChange={(event) => start(event.target.files[0])}
          />
          <div className="format-list">
            {FORMATS.map(([tone, label]) => (
              <span key={label} className={`tag ${tone}`}>
                {label}
              </span>
            ))}
          </div>
        </div>
      )}
      {error && (
        <p className="error small" role="alert">
          {error}
        </p>
      )}
      <p className="side-note">
        Up to {MAX_FILE_MB} MB. Headings, paragraphs, lists, bold, italic and links are kept. Images and tables are not
        imported. Scanned PDFs without selectable text cannot be read.
      </p>
    </Modal>
  );
}
