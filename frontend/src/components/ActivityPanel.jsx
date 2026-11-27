import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { formatDateTime, timeAgo } from '../utils/format.js';
import Avatar from './Avatar.jsx';

const REFRESH_MS = 20_000;
const AS_ROLE = { editor: 'an editor', viewer: 'a viewer' };

function describe({ action, detail }) {
  switch (action) {
    case 'document.created':
      return 'created the document';
    case 'document.imported':
      return `imported it from “${detail.file}”`;
    case 'document.renamed':
      return `renamed it to “${detail.to}”`;
    case 'member.added':
      return `invited ${detail.name} as ${AS_ROLE[detail.role]}`;
    case 'member.role_changed':
      return `made ${detail.name} ${AS_ROLE[detail.role]}`;
    case 'member.removed':
      return `removed ${detail.name}`;
    case 'member.left':
      return 'left the document';
    case 'link.created':
      return `created a share link for ${detail.role === 'editor' ? 'editors' : 'viewers'}`;
    case 'link.revoked':
      return 'revoked a share link';
    case 'link.accepted':
      return `joined through a share link as ${AS_ROLE[detail.role]}`;
    case 'version.saved':
      return `saved the version “${detail.label}”`;
    case 'version.restored':
      return detail.label
        ? `restored the version “${detail.label}”`
        : `restored the version from ${formatDateTime(detail.createdAt)}`;
    default:
      return action;
  }
}

const UNKNOWN_USER = { name: 'Deleted user', color: '#6b7381' };

export default function ActivityPanel({ documentId }) {
  const [activity, setActivity] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api(`/documents/${documentId}/activity`)
      .then(({ activity }) => setActivity(activity))
      .catch((err) => setError(err.message));
  }, [documentId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  if (error) return <p className="error small">{error}</p>;
  if (!activity) return <div className="spinner" aria-label="Loading activity" />;

  return (
    <>
      <p className="side-note">Sharing, renames and version changes. Typing is not listed.</p>
      <ol className="activity-list">
        {activity.map((entry) => {
          const user = entry.user ?? UNKNOWN_USER;
          return (
            <li key={entry.id} className="activity-item">
              <Avatar user={user} size={22} />
              <div>
                <p>
                  <strong>{user.name}</strong> {describe(entry)}
                </p>
                <span className="mono muted" title={formatDateTime(entry.createdAt)}>
                  {timeAgo(entry.createdAt)}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
