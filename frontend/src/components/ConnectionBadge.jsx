const STATES = {
  live: ['Saved', 'Connected. Every change is synced.'],
  syncing: ['Syncing', 'Catching up with other people in this document.'],
  connecting: ['Connecting', 'Your edits are kept on this device and will sync when the connection returns.'],
  offline: ['Offline', 'Your edits are kept on this device and will merge when you are back online.'],
};

export default function ConnectionBadge({ state }) {
  const [label, title] = STATES[state];
  return (
    <span className={`conn conn-${state}`} title={title} role="status">
      <span className="conn-dot" aria-hidden="true" />
      <span className="conn-label">{label}</span>
    </span>
  );
}
