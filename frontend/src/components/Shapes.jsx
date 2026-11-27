export default function Shapes({ width = 240, height = 200 }) {
  return (
    <svg className="shapes" width={width} height={height} viewBox="0 0 240 200" aria-hidden="true">
      <circle cx="160" cy="80" r="58" fill="var(--coral-ink)" />
      <rect x="52" y="88" width="80" height="80" rx="8" transform="rotate(-12 92 128)" fill="var(--teal-ink)" />
      <path d="M150 200a50 50 0 0 1 100 0z" fill="var(--sun-ink)" />
      <circle cx="62" cy="40" r="16" fill="none" stroke="var(--cobalt-ink)" strokeWidth="8" />
      <path d="M0 200v-62a62 62 0 0 1 62 62z" fill="var(--pink-ink)" />
      <rect x="120" y="34" width="3" height="44" fill="var(--band-fg)" />
      <rect x="120" y="24" width="38" height="14" rx="3" fill="var(--leaf-ink)" />
      <rect x="196" y="118" width="3" height="40" fill="var(--band-fg)" />
      <rect x="196" y="108" width="30" height="14" rx="3" fill="var(--cobalt-ink)" />
    </svg>
  );
}
