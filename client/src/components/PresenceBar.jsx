import { useEffect, useState } from 'react';
import Avatar from './Avatar.jsx';

const MAX_SHOWN = 5;

/** Who else has this document open right now (from Yjs awareness), one avatar per person. */
export default function PresenceBar({ provider, self }) {
  const [people, setPeople] = useState([]);

  useEffect(() => {
    const { awareness } = provider;
    const update = () => {
      const byId = new Map();
      for (const [clientId, state] of awareness.getStates()) {
        const u = state.user;
        if (!u?.id || clientId === awareness.clientID) continue;
        const entry = byId.get(u.id) ?? { ...u, tabs: 0 };
        entry.tabs += 1;
        byId.set(u.id, entry);
      }
      setPeople([...byId.values()]);
    };
    update();
    awareness.on('change', update);
    return () => awareness.off('change', update);
  }, [provider]);

  const others = people.filter((p) => p.id !== self.id);
  const sameUserElsewhere = people.some((p) => p.id === self.id);

  return (
    <div className="presence" aria-label={`${others.length + 1} people here`}>
      <Avatar user={self} ring title={`You${sameUserElsewhere ? ' (also open in another tab)' : ''}`} />
      {others.slice(0, MAX_SHOWN).map((p) => (
        <Avatar key={p.id} user={p} ring />
      ))}
      {others.length > MAX_SHOWN && (
        <span className="avatar more" title={others.slice(MAX_SHOWN).map((p) => p.name).join(', ')}>
          +{others.length - MAX_SHOWN}
        </span>
      )}
    </div>
  );
}
