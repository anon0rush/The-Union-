import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader.jsx';
import { api } from '../lib/api.js';
import { ROLE_LABEL } from '../lib/format.js';

export default function SharePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/share/${encodeURIComponent(token)}`)
      .then(setInvite)
      .catch((err) => setError(err.message));
  }, [token]);

  async function accept() {
    setBusy(true);
    try {
      const { documentId } = await api(`/share/${encodeURIComponent(token)}/accept`, { method: 'POST' });
      navigate(`/d/${documentId}`, { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <AppHeader />
      <main className="screen-center">
        <div className="card narrow">
          {error ? (
            <>
              <h1>Can’t open this link</h1>
              <p className="error">{error}</p>
              <Link className="btn" to="/">Go to your documents</Link>
            </>
          ) : !invite ? (
            <div className="spinner" />
          ) : (
            <>
              <p className="eyebrow">Shared with you</p>
              <h1>{invite.title}</h1>
              <p className="muted">
                {invite.ownerName} invited you with <strong>{ROLE_LABEL[invite.role].toLowerCase()}</strong> access.
              </p>
              {invite.currentRole && (
                <p className="muted small">You already have {ROLE_LABEL[invite.currentRole].toLowerCase()} access — this link will never reduce it.</p>
              )}
              <button className="btn primary block" onClick={accept} disabled={busy}>
                {busy ? 'Opening…' : 'Open document'}
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
