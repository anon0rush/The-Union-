import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { ROLE_LABEL, formatDateTime, timeAgo } from '../lib/format.js';
import Avatar from './Avatar.jsx';
import Modal from './Modal.jsx';

const EXPIRY = [
  ['24', '1 day'],
  ['168', '7 days'],
  ['720', '30 days'],
  ['', 'Never'],
];

export default function ShareDialog({ documentId, role, onClose, notify }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isOwner = role === 'owner';
  const [people, setPeople] = useState(null);
  const [links, setLinks] = useState([]);
  const [invite, setInvite] = useState({ email: '', role: 'editor' });
  const [linkForm, setLinkForm] = useState({ role: 'viewer', expires: '168' });
  const [newLink, setNewLink] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setPeople(await api(`/documents/${documentId}/members`));
      if (isOwner) setLinks((await api(`/documents/${documentId}/links`)).links);
    } catch (err) {
      setError(err.message);
    }
  }, [documentId, isOwner]);

  useEffect(() => {
    load();
  }, [load]);

  const run = (fn) => async (...args) => {
    setError('');
    try {
      await fn(...args);
    } catch (err) {
      setError(err.message);
    }
  };

  const addMember = run(async (e) => {
    e.preventDefault();
    await api(`/documents/${documentId}/members`, { method: 'POST', body: invite });
    notify(`Shared with ${invite.email}`);
    setInvite((i) => ({ ...i, email: '' }));
    load();
  });

  const changeRole = run(async (memberId, newRole) => {
    await api(`/documents/${documentId}/members/${memberId}`, { method: 'PATCH', body: { role: newRole } });
    load();
  });

  const removeMember = run(async (member) => {
    const self = member.id === user.id;
    if (!window.confirm(self ? 'Leave this document? You will lose access.' : `Remove ${member.name}? They will be disconnected immediately.`)) return;
    await api(`/documents/${documentId}/members/${member.id}`, { method: 'DELETE' });
    if (self) navigate('/');
    else load();
  });

  const createLink = run(async (e) => {
    e.preventDefault();
    const body = { role: linkForm.role, expiresInHours: linkForm.expires ? Number(linkForm.expires) : null };
    const { url } = await api(`/documents/${documentId}/links`, { method: 'POST', body });
    setNewLink(url);
    load();
  });

  const revokeLink = run(async (link) => {
    if (!window.confirm('Revoke this link? Anyone who hasn’t opened it yet won’t be able to use it.')) return;
    await api(`/documents/${documentId}/links/${link.id}`, { method: 'DELETE' });
    load();
  });

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      notify('Link copied');
    } catch {
      window.prompt('Copy this link', text);
    }
  }

  return (
    <Modal title="Share document" onClose={onClose} wide>
      {error && <p className="error" role="alert">{error}</p>}

      {isOwner && (
        <form className="row-form" onSubmit={addMember}>
          <input
            type="email"
            required
            placeholder="Add people by email"
            value={invite.email}
            onChange={(e) => setInvite((i) => ({ ...i, email: e.target.value }))}
            aria-label="Email address"
          />
          <select value={invite.role} onChange={(e) => setInvite((i) => ({ ...i, role: e.target.value }))} aria-label="Role">
            <option value="editor">Can edit</option>
            <option value="viewer">Can view</option>
          </select>
          <button className="btn primary">Invite</button>
        </form>
      )}

      <h3 className="section-title">People with access</h3>
      {!people ? (
        <div className="spinner small" />
      ) : (
        <ul className="people">
          <Person person={people.owner} you={people.owner.id === user.id}>
            <span className="muted small">Owner</span>
          </Person>
          {people.members.map((m) => (
            <Person key={m.id} person={m} you={m.id === user.id}>
              {isOwner ? (
                <>
                  <select value={m.role} onChange={(e) => changeRole(m.id, e.target.value)} aria-label={`Role for ${m.name}`}>
                    <option value="editor">Can edit</option>
                    <option value="viewer">Can view</option>
                  </select>
                  <button className="link-btn danger" onClick={() => removeMember(m)}>Remove</button>
                </>
              ) : (
                <>
                  <span className="muted small">{ROLE_LABEL[m.role]}</span>
                  {m.id === user.id && <button className="link-btn danger" onClick={() => removeMember(m)}>Leave</button>}
                </>
              )}
            </Person>
          ))}
        </ul>
      )}

      {isOwner && (
        <>
          <h3 className="section-title">Share links</h3>
          <p className="muted small">
            Anyone with a link can join after signing in. Links are stored hashed, can expire, and can be revoked at any time.
          </p>
          <form className="row-form" onSubmit={createLink}>
            <select value={linkForm.role} onChange={(e) => setLinkForm((f) => ({ ...f, role: e.target.value }))} aria-label="Link role">
              <option value="viewer">Can view</option>
              <option value="editor">Can edit</option>
            </select>
            <select value={linkForm.expires} onChange={(e) => setLinkForm((f) => ({ ...f, expires: e.target.value }))} aria-label="Link expiry">
              {EXPIRY.map(([v, label]) => (
                <option key={label} value={v}>{v ? `Expires in ${label}` : 'Never expires'}</option>
              ))}
            </select>
            <button className="btn">Create link</button>
          </form>

          {newLink && (
            <div className="new-link">
              <input readOnly value={newLink} onFocus={(e) => e.target.select()} aria-label="New share link" />
              <button className="btn primary" onClick={() => copy(newLink)}>Copy</button>
              <p className="muted small">Copy it now — for security the full link is only shown once.</p>
            </div>
          )}

          {links.length > 0 && (
            <ul className="links">
              {links.map((l) => (
                <li key={l.id} className={l.active ? '' : 'inactive'}>
                  <span className={`badge role-${l.role}`}>{ROLE_LABEL[l.role]}</span>
                  <span className="small">
                    Created {timeAgo(l.createdAt)} · {l.uses} {l.uses === 1 ? 'use' : 'uses'} ·{' '}
                    {l.revokedAt
                      ? 'revoked'
                      : l.expiresAt
                        ? `${l.active ? 'expires' : 'expired'} ${formatDateTime(l.expiresAt)}`
                        : 'never expires'}
                  </span>
                  {l.active && <button className="link-btn danger" onClick={() => revokeLink(l)}>Revoke</button>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Modal>
  );
}

function Person({ person, you, children }) {
  return (
    <li className="person">
      <Avatar user={person} size={32} />
      <span className="person-info">
        <strong>{person.name}{you && ' (you)'}</strong>
        <span className="muted small">{person.email}</span>
      </span>
      <span className="person-actions">{children}</span>
    </li>
  );
}
