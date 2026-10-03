export default function Logo({ large = false }) {
  const size = large ? 40 : 28;
  return (
    <span className={`logo${large ? ' large' : ''}`}>
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill="var(--accent)" />
        <circle cx="12.5" cy="16" r="6.5" fill="none" stroke="#fff" strokeWidth="2.5" />
        <circle cx="19.5" cy="16" r="6.5" fill="none" stroke="#c7d2fe" strokeWidth="2.5" />
      </svg>
      <span>The Union</span>
    </span>
  );
}
