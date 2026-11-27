import { useEffect, useState } from 'react';
import Avatar from './Avatar.jsx';

const MAX_SHOWN = 4;

export default function PresenceBar({ provider, self, following, onFollow }) {
  const [people, setPeople] = useState([]);

  useEffect(() => {
    const { awareness } = provider;
    const update = () => {
      const byId = new Map();
      for (const [clientId, state] of awareness.getStates()) {
        const user = state.user;
        if (!user?.id || clientId === awareness.clientID || user.id === self.id) continue;
        byId.set(user.id, user);
      }
      setPeople([...byId.values()]);
    };
    update();
    awareness.on('change', update);
    return () => awareness.off('change', update);
  }, [provider, self.id]);

  useEffect(() => {
    if (following && !people.some((p) => p.id === following)) onFollow(null);
  }, [people, following, onFollow]);

  return (
    <div className="presence" aria-label={`${people.length + 1} people in this document`}>
      <Avatar user={self} size={26} ring title="You" />
      {people.slice(0, MAX_SHOWN).map((person) => (
        <button
          key={person.id}
          className="presence-follow"
          aria-pressed={following === person.id}
          title={following === person.id ? `Stop following ${person.name}` : `Follow ${person.name}'s cursor`}
          onClick={() => onFollow(following === person.id ? null : person.id)}
        >
          <Avatar user={person} size={26} ring title={null} />
        </button>
      ))}
      {people.length > MAX_SHOWN && (
        <span className="avatar more" title={people.slice(MAX_SHOWN).map((p) => p.name).join(', ')}>
          +{people.length - MAX_SHOWN}
        </span>
      )}
    </div>
  );
}
