import Modal from './Modal.jsx';

export default function ConfirmDialog({ title, message, confirmLabel, danger = false, onConfirm, onClose }) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="muted">{message}</p>
      <footer className="modal-foot">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          className={`btn ${danger ? 'btn-primary btn-danger-fill' : 'btn-primary'}`}
          onClick={() => {
            onConfirm();
            onClose();
          }}
          autoFocus
        >
          {confirmLabel}
        </button>
      </footer>
    </Modal>
  );
}
