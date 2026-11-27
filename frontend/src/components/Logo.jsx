export function LogoMark({ size = 24 }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="1" y="1" width="22" height="22" rx="6" fill="var(--accent)" />
      <path
        d="M7 6.5v6.2a5 5 0 0 0 10 0V6.5M12 6.5v6"
        fill="none"
        stroke="var(--on-accent)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Logo() {
  return (
    <span className="logo">
      <LogoMark />
      <span>The Union</span>
    </span>
  );
}
