const STATES = {
  live: ['Live', 'All changes synced'],
  syncing: ['Syncing…', 'Catching up with collaborators'],
  connecting: ['Connecting…', 'Edits are kept on this device and will sync when the connection returns'],
  offline: ['Offline', 'Edits are kept on this device and will merge automatically when you’re back online'],
};

export default function ConnectionBadge({ state }) {
  const [label, title] = STATES[state];
  return (
    <span className={`conn conn-${state}`} title={title} role="status">
      <span className="conn-dot" aria-hidden />
      {label}
    </span>
  );
}
