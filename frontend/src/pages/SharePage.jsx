import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import AppHeader from '../components/AppHeader.jsx';
import { ROLE_LABEL } from '../utils/format.js';

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
      <main className="center-screen">
        <div className="panel-card">
          {error ? (
            <>
              <h1>This link can't be opened</h1>
              <p className="error">{error}</p>
              <Link className="btn" to="/">
                Go to your documents
              </Link>
            </>
          ) : !invite ? (
            <div className="spinner" aria-label="Loading invite" />
          ) : (
            <>
              <h1>{invite.title}</h1>
              <p className="muted">
                {invite.ownerName} shared this document with you. You will be able to{' '}
                {invite.role === 'editor' ? 'edit it' : 'read it'}.
              </p>
              {invite.currentRole && (
                <p className="muted small">
                  You already have access ({ROLE_LABEL[invite.currentRole].toLowerCase()}). Opening this link never
                  lowers it.
                </p>
              )}
              <button className="btn btn-primary btn-block" onClick={accept} disabled={busy}>
                {busy ? 'Opening…' : 'Open document'}
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
